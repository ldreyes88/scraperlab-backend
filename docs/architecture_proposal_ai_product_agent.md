# Arquitectura: Agente Autónomo de Productos (ScraperLab AI Gemini)

## 🎯 El Desafío
Mantener un catálogo y parear productos en los comparadores de precios requiere un esfuerzo manual brutal: buscar un producto, validar correctamente sus especificaciones, buscarlo tienda por tienda (Amazon, MercadoLibre, Falabella), verificar que el enlace no sea de una "funda" o un "accesorio".

## 💡 La Solución: Gemini-Powered Pipeline
Implementar un **Pipeline Agéntico (AI Agent)** integrado en **ScraperLab** que use la **API de Gemini (2.5 Pro/Flash)** para orquestar la inteligencia operativa y automatizar el proceso de búsqueda y pareado de productos, basándose en la estructura **Single-Table Design** de DynamoDB de Oferty. Utiliza @gestion-pipeline-nodos.md para saber como crear cada cosa "Nodos y Pipelines".

---

### Fase 0: La Petición (Trigger desde Oferty Admin)
**Objetivo:** Iniciar la generación desde el Front-end de Oferty de manera centralizada.
1. **Input del Usuario:** Un administrador en la interfaz de `oferty-web/admin` y escribe el título base, por ejemplo: *"Tv samsung oled 55"*.
2. **Webservice Inter-Apps:** Oferty Backend envía una petición HTTP `POST` a la API de ScraperLab exponiendo el puerto del Pipeline (ej. `/api/pipelines/gemini-catalog-builder/run`). ScraperLab recibe el payload y encola la orden de trabajo asíncronamente.

### Fase 1: El Cerebro (Gemini Catalog Generator)
**Objetivo:** Crear la jerarquía completa de catálogo (Familia + Productos Variantes) con especificaciones técnicas precisas.

0. **Crear el Nodo (ScraperLab Pipeline):** Se crea el flujo secuencial en el motor de ScraperLab.
1. **Arranque del Pipeline:** El nodo `TRIGGER` inicial del Pipeline recibe el texto enviado por Oferty.
2. **Contexto (Base de Conocimiento / RAG):** El pipeline ejecuta un nodo `API_REQUEST (GET)` contra el backend de Oferty (ej. `/api/internal/products/search?q={{input}}`) para recuperar las familias o productos similares ya creados y evitar duplicados.
3. **Generación con Gemini (AI_PROMPT):** Se utiliza Gemini con **Schema Constraints** inyectándole la Base de Conocimiento recuperada para estructurar la salida JSON idéntica a tu modelo.
   - Crea el registro de **Familia** infiriendo `genericSpecs` y `variantFields`, referenciándose al existente si aplica.
   - Crea los registros de **Producto** con sus `variantSpecs` exactas.
   - **Regla de Negocio:** Autogenera un máximo de 4 productos/variantes iniciales por familia.
4. **Inyección vía Internal API (Oferty Backend):**
   - **Cambio Arquitectónico:** ScraperLab *no* escribe directo en DynamoDB, sino que actúa como un cliente externo utilizando una Internal API Key.
   - Envía el JSON generado en un POST al backend de Oferty (ej. `oferty-backend/src/handlers/internal.js` -> `/api/internal/ai/draft-product`).
   - El backend de Oferty inserta los registros con la Sort Key nativa y correcta (`SK: METADATA` o `SK: SPECS#GENERIC`) asegurando la integridad, pero inicializados con el campo `active: false`. Esto previene que se muestren en el Front-end de producción, pero preserva la validez de la clave principal para cuando se active.

### Fase 2: El Cazador (Search + Gemini Entity Matcher)
**Objetivo:** Encontrar, validar y actualizar URLs reales en Marketplaces.

1. **Búsqueda Multi-Fuente:** Pipeline de `SCRAPE_SEARCH` a Exito, MercadoLibre y Falabella.
2. **Filtrado Inteligente con Gemini Flash:** Un nodo `AI_PROMPT` evalúa los primeros resultados y descarta accesorios mediante un prompt estricto.
3. **Extracción (SCRAPE_DETAIL):** Obtiene campos nativos (`currentPrice`, `originalPrice`, `delivery`).
4. **Push a Oferty Backend (API_REQUEST):** 
   - ScraperLab empuja los links ganadores a Oferty mediante un PATCH `/api/internal/products/{id}/marketplaces`.
   - Oferty Backend procesa las Entidades Marketplace y recalcula el Mejor Precio (`SK: BEST_PRICE#<País>`).
   - **Delegación de Historial:** Toda la lógica de trackear `PRICE_DROP`, insertar `HISTORY` y notificar Followers reside exclusivamente en el backend de Oferty.

### Fase 3: Ingestión y QA (Oferty Web Admin)
1. **Inbox:** Los productos "Draft" (`active: false`) aparecen en listados de `oferty-web/admin` y consumen los endpoints de `/api/admin/*` de Oferty.
2. **Aprobación Humana:** El administrador los aprueba y la API de Oferty simplemente pasa el registro a estado público (`active: true`). Él es el responsable de cerciorarse de que no duplique registros de un catálogo equivalente.

---

## 🔀 Diseño del Pipeline de Generación (Ejemplo de Nodos)

Esta es la configuración JSON representativa en `ScraperLab-Pipelines` para generar el catálogo, utilizando la librería base (Trigger, API, AI, Transformación, External API).

```json
{
  "id": "gemini-catalog-builder",
  "name": "Pipeline Generador de Catálogo AI",
  "nodes": {
    "start": {
      "type": "TRIGGER",
      "config": { "inputType": "product_family_name" },
      "next": "fetch-knowledge"
    },
    "fetch-knowledge": {
      "type": "API_REQUEST",
      "config": {
        "method": "GET",
        "url": "https://api.oferty.com.co/api/internal/products/search?q={{input.product_family_name}}",
        "headers": { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" }
      },
      "next": "ai-generate-catalog"
    },
    "ai-generate-catalog": {
      "type": "AI_PROMPT",
      "config": {
        "model": "gemini-2.5-pro",
        "isJson": true,
        "promptTemplate": "Genera el catálogo técnico (Familia y max 4 variaciones) para '{{input.product_family_name}}'. \n\nBASE DE CONOCIMIENTO EXISTENTE EN OFERTY PARA ESTE TÉRMINO: {{nodes.fetch-knowledge.response}}\n\nSi la familia ya existe en la base de conocimiento con sus UUID y nombres, respétalos y propon solo variantes nuevas. Sigue estrictamente el JSON schema del modelo de Oferty..."
      },
      "next": "map-payload"
    },
    "map-payload": {
      "type": "DATA_MAPPING",
      "config": {
        "mapping": {
          "family": "{{nodes.ai-generate-catalog.result.family}}",
          "products": "{{nodes.ai-generate-catalog.result.products}}"
        }
      },
      "next": "push-to-oferty"
    },
    "push-to-oferty": {
      "type": "API_REQUEST", 
      "config": {
        "method": "POST",
        "url": "https://api.oferty.com.co/api/internal/ai/ingest-catalog",
        "headers": { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" },
        "bodyTemplate": "{{nodes.map-payload.mapped_data}}"
      },
      "next": null
    }
  }
}
```

## 🛠 Stack Técnico
- **Modelo:** `gemini-2.5-flash` para tareas rápidas de matching y `gemini-2.5-pro` para generación de catálogo estructurado y jerarquías (Familia/Producto). El motor de ScraperLab realiza la migración automática de peticiones legacy de 1.5 a 2.5 de manera transparente.
- **Integración:** ScraperLab ya no actúa como un cliente directo de DynamoDB, sino como un microservicio que interactúa HTTP/REST mediante API Keys contra el API Gateway y Lambdas subyacentes de Oferty (`oferty-backend-structure.txt`).
- **Nodos:** `API_REQUEST` se añade a la librería de ScraperLab para soportar comunicaciones nativas.
