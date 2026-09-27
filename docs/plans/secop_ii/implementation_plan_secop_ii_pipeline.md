# Plan de Implementación: Pipeline y Dominio SECOP II (Sector Salud & Dispositivos Médicos)

Este plan documenta la estrategia técnica, la configuración de dominios/providers y la arquitectura del pipeline para la extracción de procesos de contratación pública de **SECOP II**, optimizado para el caso de uso corporativo de **BD Colombia** y escalable para cualquier monitoreo público en Colombia.

---

## 1. Contexto y Diagnóstico del Portal SECOP II

### Reto en el Portal Web (`community.secop.gov.co`)
Al intentar automatizar búsquedas directamente en la URL:
`https://community.secop.gov.co/Public/Tendering/ContractNoticeManagement/Index?currentLanguage=es-CO&Page=login&Country=CO&SkinName=CCE`

Se identificaron las siguientes restricciones de arquitectura:
1. **Tecnología ASP.NET WebForms (Vortal/Jaggaer):** El formulario de búsqueda no responde a parámetros `GET` por URL. Requiere un `POST` con `__VIEWSTATE`, `__EVENTVALIDATION` y cookies de sesión activas.
2. **Protección Anti-Bot:** Implementa **Google reCAPTCHA Enterprise**. Peticiones automatizadas directas sin navegador o proxies residenciales son redirigidas a `Public/Common/GoogleReCaptcha/Index`.
3. **Estructura de Detalle Canónica:** Cada proceso tiene un identificador único `noticeUID` (ej: `CO1.NTC.5428912`) y su URL pública de detalle responde siempre al formato:
   ```
   https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID={noticeUID}&isFromPublicArea=True&isModal=False
   ```

---

## 2. Estrategia Maestra: Enfoque Híbrido Desacoplado

Para evitar la latencia alta, el consumo excesivo de créditos de scraping y la inestabilidad de los captchas en la búsqueda web, implementamos una **arquitectura en dos capas**:

```
[ CAPA 1: BÚSQUEDA Y FILTRADO (SEARCH) ]
   Fuente: API SODA oficial de Datos Abiertos (datos.gov.co)
   Endpoint: /resource/p6dx-8zbt.json (SECOP II Procesos)
   Provider: "api" (DirectAPIStrategy) -> Costo $0, respuesta < 1s, sin Captchas
   Filtros: Códigos UNSPSC Salud (Segmentos 42, 51, 41) y Fechas
   Resultado: Metadata macro del proceso + campo 'urlproceso' con su noticeUID
                            │
                            ▼
[ CAPA 2: EXTRACCIÓN DE DETALLES Y ANEXOS (DETAIL) ]
   Fuente: community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=...
   Provider: "scraperapi" con { render: true, ultra_premium: true, country_code: "co" }
   Resultado: Enlaces a los documentos adjuntos (Anexos Técnicos, Ofertas Económicas, Actas)
                            │
                            ▼
[ CAPA 3: IA DOCUMENTAL MULTIMODAL (LINE ITEMS) ]
   Motor: Google Gemini 2.5 Flash / Pro (AIService)
   Input: Documento PDF / Excel de la oferta económica o acta de adjudicación
   Output: JSON Estructurado con tabla de renglones:
           [{ renglon, descripcion, cantidad, unidad, marca_ofertada, precio_unitario, adjudicatario }]
```

---

## 3. Configuración de Dominios y Providers (ScraperLab Spec)

### 3.1. Dominio: `community.secop.gov.co` (Para Extracción de Detalle y Anexos)

Configuración para registrar en DynamoDB (`ScraperLab-Domains`):

```json
{
  "domainId": "community.secop.gov.co",
  "providerId": "scraperapi",
  "countryCode": "CO",
  "enabled": true,
  "typeService": ["scraping"],
  "supportedTypes": ["detail", "search"],
  "strategyOrder": ["css", "scripts"],
  "scraperConfig": {
    "search": {
      "containerSelector": "#tblSearchResults tbody tr, .vortal-grid tr.gridRow, table[id*='ContractNotice'] tbody tr",
      "titleSelector": "td:nth-child(4), .process-description",
      "priceSelector": "td:nth-child(8), .process-budget",
      "urlSelector": "a[href*='OpportunityDetail'], td:last-child a, input[value='Detalle']",
      "scripts": []
    },
    "detail": {
      "css": {
        "title": "span[id*='txtProcessTitle'], h1.process-title",
        "reference": "span[id*='txtReference']",
        "entity": "span[id*='txtCustomerName']",
        "nit": "span[id*='txtCustomerDocNumber']",
        "budget": "span[id*='txtEstimatedValue']",
        "status": "span[id*='txtStatus']",
        "documentsList": "table[id*='gridDocuments'] tr a[href*='DownloadAttachment'], .attachment-list a"
      }
    }
  },
  "providerConfig": {
    "country_code": "co",
    "search": {
      "render": true,
      "ultra_premium": true,
      "wait_for_selector": "table[id*='ContractNotice'], .vortal-grid"
    },
    "detail": {
      "render": true,
      "ultra_premium": true,
      "wait_for_selector": "table[id*='gridDocuments'], a[href*='DownloadAttachment']"
    }
  }
}
```

### 3.2. Provider: `api` (Direct API Strategy para Datos Abiertos)

Ya existente en ScraperLab (`DirectAPIStrategy.js`), costo $0 por petición, ideal para consultar la API SODA de Colombia sin intermediarios.

---

## 4. Definición del Pipeline Modular (`secop-procurement-health`)

El pipeline se registra en la tabla `ScraperLab-Pipelines` y define la secuencia automatizada:

```json
{
  "pipelineId": "secop-procurement-health",
  "name": "Pipeline ETL SECOP II Salud & Dispositivos Médicos",
  "description": "Extracción integral de procesos y lectura de renglones vía IA para BD Colombia",
  "enabled": true,
  "nodes": [
    {
      "id": "start",
      "type": "TRIGGER",
      "config": {
        "inputType": {
          "startDate": "string",
          "endDate": "string",
          "unspscCategories": "array"
        }
      },
      "next": "fetch-secop-soda"
    },
    {
      "id": "fetch-secop-soda",
      "type": "API_REQUEST",
      "config": {
        "url": "https://www.datos.gov.co/resource/p6dx-8zbt.json?$where=fecha_de_publicacion_del between '{{input.startDate}}' and '{{input.endDate}}' AND codigo_principal_de_categoria IN ('42', '51')&$limit=500",
        "method": "GET",
        "headers": {
          "Accept": "application/json"
        }
      },
      "next": "extract-document-links"
    },
    {
      "id": "extract-document-links",
      "type": "SCRAPE_DETAIL",
      "config": {
        "urlTemplate": "{{nodes.fetch-secop-soda.data[0].urlproceso.url}}"
      },
      "next": "ai-extract-line-items"
    },
    {
      "id": "ai-extract-line-items",
      "type": "AI_PROMPT",
      "config": {
        "model": "gemini-flash-lite-latest",
        "isJson": true,
        "promptTemplate": "Eres un auditor experto en contratación pública en salud para BD Colombia.\nAnaliza el documento adjunto de la oferta económica o acta de adjudicación del proceso: {{nodes.fetch-secop-soda.data[0].referencia_del_proceso}}.\n\nExtrae la lista exhaustiva de renglones o productos en formato JSON con la siguiente estructura:\n{\n  \"lineItems\": [\n    {\n      \"renglon\": (número o código de ítem),\n      \"descripcion\": \"descripción exacta del insumo médico\",\n      \"unspsc\": \"código UNSPSC del ítem\",\n      \"cantidadSolicitada\": (número),\n      \"unidadMedida\": \"caja/unidad/kit/frasco\",\n      \"marcaOfertada\": \"marca reportada por el oferente (ej: BD, Nipro, Terumo, etc)\",\n      \"precioUnitarioOfertado\": (número decimal/entero sin puntuación de texto),\n      \"cantidadAdjudicada\": (número),\n      \"valorTotalAdjudicado\": (número),\n      \"proveedorAdjudicado\": \"Razón social o proponente ganador del renglón\"\n    }\n  ]\n}"
      },
      "next": "normalize-data"
    },
    {
      "id": "normalize-data",
      "type": "DATA_MAPPING",
      "config": {
        "mapping": {
          "processId": "{{nodes.fetch-secop-soda.data[0].id_del_proceso}}",
          "reference": "{{nodes.fetch-secop-soda.data[0].referencia_del_proceso}}",
          "entity": "{{nodes.fetch-secop-soda.data[0].entidad}}",
          "nit": "{{nodes.fetch-secop-soda.data[0].nit_entidad}}",
          "totalBudget": "{{nodes.fetch-secop-soda.data[0].precio_base}}",
          "awardedItems": "{{nodes.ai-extract-line-items.lineItems}}"
        }
      },
      "next": "save-results"
    },
    {
      "id": "save-results",
      "type": "SAVE_RESULT",
      "config": {
        "dataTemplate": "{{nodes.normalize-data}}",
        "resultKey": "secopHealthResult"
      },
      "next": null
    }
  ]
}
```

---

## 5. Integración con `batch-process` (Para la Carga Masiva de 24 Meses)

Para procesar el histórico de 24 meses sin saturar tiempos de ejecución Lambda:

1. **Particionamiento Temporal:** El orquestador divide los 24 meses en lotes quincenales o mensuales.
2. **Buffer SQS:** Cada proceso identificado por la API SODA es enviado como un mensaje individual a la cola SQS de `batch-process`.
3. **Workers Paralelos:** Los workers Lambda de `batch-process` consumen los mensajes, descargan los anexos técnicos/ofertas, ejecutan la inferencia en Gemini y guardan el resultado normalizado en DynamoDB y S3.
4. **Exportación:** Un job final consolida todos los registros procesados en un archivo `.xlsx` y `.csv` listo para entrega y para ingestión en PowerBI.

---

## 6. Scripts a Desarrollar

| Script | Ubicación | Función |
| :--- | :--- | :--- |
| `seed_secop_domain.js` | `scripts/` | Inserta/actualiza el dominio `community.secop.gov.co` en la tabla `ScraperLab-Domains`. |
| `seed_secop_pipeline.js` | `scripts/` | Registra el pipeline `secop-procurement-health` en la tabla `ScraperLab-Pipelines`. |
| `test_secop_soda.js` | `scripts/` | Realiza una consulta de prueba a la API de Socrata de datos.gov.co para el sector salud y verifica la respuesta. |

---

## 7. Plan de Verificación y Testing

### Fase 1: Verificación de la API SODA (Search)
- Ejecutar consulta a `https://www.datos.gov.co/resource/p6dx-8zbt.json?$where=codigo_principal_de_categoria='42'&$limit=5`.
- Verificar que devuelve los campos requeridos (`entidad`, `nit_entidad`, `referencia_del_proceso`, `precio_base`, `urlproceso`).

### Fase 2: Verificación de Scrape Detail en `community.secop.gov.co`
- Tomar un `urlproceso` real devuelto por la API.
- Ejecutar `ScraperService.scrapeUrl(url, true, 'detail')` con ScraperAPI (`render: true`).
- Verificar que extrae exitosamente los enlaces a los documentos adjuntos (PDFs).

### Fase 3: Verificación de Inferencia con IA (Documental)
- Enviar un PDF muestra de oferta económica o resolución de adjudicación al método `AIService.generateJSON`.
- Confirmar que devuelve el arreglo de `lineItems` con marcas, cantidades y precios unitarios.
