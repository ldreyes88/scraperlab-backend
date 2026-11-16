# Estándar y Patrón de Creación de Pipelines para Futuros Bots en ScraperLab

Este documento define la **fórmula estándar, automática y desacoplada** para crear y aprovisionar pipelines conversacionales de WhatsApp en **ScraperLab** cada vez que se registre una nueva empresa o sucursal.

---

## 1. El Patrón Canónico de 3 Nodos

Todo bot conversacional de WhatsApp en ScraperLab implementa la siguiente terna de nodos:

```
[ TRIGGER (WhatsApp) ] 
       │
       ▼
[ AI_PROMPT (AgentOrchestrator con Memoria y RAG) ] 
       │
       ▼
[ API_REQUEST (Despacho a Meta con configOverride) ]
```

```mermaid
flowchart TD
    N1["1. whatsapp-trigger<br/><b>Tipo: TRIGGER</b><br/>Captura número emisor, ID de Meta y texto"] --> N2["2. orchestrator-{botId}<br/><b>Tipo: AI_PROMPT</b><br/>Hidrata memoria (últimos 10 mensajes) + RAG de catálogo"]
    N2 --> N3["3. whatsapp-response<br/><b>Tipo: API_REQUEST</b><br/>nodeRef: 'whatsapp-notice' + configOverride"]
```

---

## 2. Plantilla Estándar JSON del Pipeline

Para cualquier bot futuro con identificador `{botId}` y cliente `{clientId}`:

```json
{
  "pipelineId": "pipeline-whatsapp-{botId}",
  "name": "Pipeline WhatsApp {Nombre Empresa} ({phoneNumber})",
  "description": "Orquestación de canal WhatsApp hacia el bot {Nombre Empresa} con memoria contextual en DynamoDB y RAG.",
  "clientId": "{clientId}",
  "enabled": true,
  "nodes": [
    {
      "id": "whatsapp-trigger",
      "type": "TRIGGER",
      "config": {
        "channel": "whatsapp",
        "phoneNumber": "{phoneNumber}",
        "phoneNumberId": "{phoneNumberId}",
        "botId": "{botId}"
      },
      "next": "orchestrator-{botId}"
    },
    {
      "id": "orchestrator-{botId}",
      "type": "AI_PROMPT",
      "config": {
        "botId": "{botId}",
        "service": "AgentOrchestratorService",
        "sessionPrefix": "wa_{botId}",
        "enableMemory": true,
        "memoryLimit": 10
      },
      "next": "whatsapp-response"
    },
    {
      "id": "whatsapp-response",
      "type": "API_REQUEST",
      "nodeRef": "whatsapp-notice",
      "configOverride": {
        "url": "https://graph.facebook.com/v21.0/{phoneNumberId}/messages",
        "bodyTemplate": {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "{{input.fromNumber}}",
          "type": "text",
          "text": {
            "body": "{{nodes.orchestrator-{botId}.reply}}",
            "preview_url": false
          }
        }
      },
      "next": null
    }
  ]
}
```

---

## 3. Parámetros que cambian por Empresa / Sucursal

| Campo | Ubicación en el JSON | Ejemplo Empresa A (Caribe Partes) | Ejemplo Empresa B (Restaurante / Salud) |
| :--- | :--- | :--- | :--- |
| **`pipelineId`** | Raíz | `pipeline-whatsapp-caribe-partes` | `pipeline-whatsapp-salud-vital` |
| **`clientId`** | Raíz | `caribe-partes` | `salud-vital` |
| **`phoneNumberId`** | `whatsapp-trigger` y `url` | `1372470465958598` | `105938472619485` *(ID único de su número en Meta)* |
| **`botId`** | `whatsapp-trigger` y `AI_PROMPT` | `caribe-partes` | `salud-vital` |
| **`sessionPrefix`**| `orchestrator-{botId}` | `wa_caribe-partes` | `wa_salud-vital` |
| **`to` (Destinatario)** | `whatsapp-response` | **`{{input.fromNumber}}`** *(Dinámico universal)* | **`{{input.fromNumber}}`** *(Dinámico universal)* |

---

## 4. Aprovisionamiento Automático al Crear un Bot

Para que el backend cree este pipeline **automáticamente** cuando el usuario cree un nuevo bot desde el panel de administración (`POST /api/bots`), se puede invocar la siguiente función helper reutilizable:

```javascript
// src/services/PipelineProvisioningService.js
const PipelineRepository = require('../repositories/PipelineRepository');

class PipelineProvisioningService {
  /**
   * Crea automáticamente el pipeline de WhatsApp al registrar un bot
   */
  static async provisionWhatsAppPipeline(bot) {
    const waConfig = bot.channels?.whatsapp;
    if (!waConfig || !waConfig.enabled || !waConfig.phoneNumberId) {
      return null;
    }

    const pipelineId = `pipeline-whatsapp-${bot.botId}`;
    const pipelineData = {
      pipelineId,
      name: `Pipeline WhatsApp ${bot.name} (${waConfig.phoneNumber || waConfig.phoneNumberId})`,
      description: `Orquestación automática de WhatsApp hacia el bot ${bot.name}`,
      clientId: bot.clientId || 'default',
      enabled: true,
      nodes: [
        {
          id: 'whatsapp-trigger',
          type: 'TRIGGER',
          config: {
            channel: 'whatsapp',
            phoneNumber: waConfig.phoneNumber || '',
            phoneNumberId: waConfig.phoneNumberId,
            botId: bot.botId
          },
          next: `orchestrator-${bot.botId}`
        },
        {
          id: `orchestrator-${bot.botId}`,
          type: 'AI_PROMPT',
          config: {
            botId: bot.botId,
            service: 'AgentOrchestratorService',
            sessionPrefix: `wa_${bot.botId}`,
            enableMemory: true,
            memoryLimit: 10
          },
          next: 'whatsapp-response'
        },
        {
          id: 'whatsapp-response',
          type: 'API_REQUEST',
          nodeRef: 'whatsapp-notice',
          configOverride: {
            url: `https://graph.facebook.com/v21.0/${waConfig.phoneNumberId}/messages`,
            bodyTemplate: {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: '{{input.fromNumber}}',
              type: 'text',
              text: {
                body: `{{nodes.orchestrator-${bot.botId}.reply}}`,
                preview_url: false
              }
            }
          },
          next: null
        }
      ]
    };

    const existing = await PipelineRepository.getById(pipelineId);
    if (existing) {
      return await PipelineRepository.update(pipelineId, pipelineData);
    } else {
      return await PipelineRepository.create(pipelineData);
    }
  }
}

module.exports = PipelineProvisioningService;
```

---

## 5. Checklist para Activar una Nueva Empresa / Sucursal

1. **Registrar el número en Meta:**
   - En Meta Developers / Business Manager, agregar el nuevo número de la empresa o sucursal y copiar su `Phone Number ID`.
2. **Crear el Bot en ScraperLab:**
   - Asignar `botId`, `clientId`, `name` y el `Phone Number ID` en `channels.whatsapp`.
3. **Cargar la Base de Conocimiento (RAG):**
   - Inyectar en `ScraperLab-BotKnowledge` el catálogo, FAQs o scrapeando la URL oficial de la empresa.
4. **Pipeline Auto-provisionado:**
   - El pipeline se genera automáticamente con el estándar canónico de 3 nodos.
5. **Listo para Producción:**
   - Todo cliente que escriba a ese número nuevo hablará exclusivamente con la IA de esa empresa, con memoria persistente y sin cruce de información.
