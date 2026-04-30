# Pipeline Agéntico de Productos (AI Product Catalog)

Este documento describe la arquitectura, endpoints y flujo de trabajo del pipeline automatizado que integra **ScraperLab** con el ecosistema de **Oferty** mediante Gemini AI.

## 🌟 Visión General
El objetivo del pipeline es automatizar la creación de catálogos de alta calidad (familias de productos con sus variantes) y mantener sus precios actualizados mediante agentes de búsqueda (Hunters) potenciados por **Gemini 2.0/2.5 Flash/Pro**. El sistema actúa como un orquestador que minimiza el esfuerzo manual de pareado y validación técnica.

## 🏗️ Arquitectura del Flujo

### Fase 1: Generación de Catálogo (The Brain)
- **Acción**: Un administrador pulsa el botón **"Generar con IA"** ✨ en el panel de productos de `oferty-web`.
- **Backend**: La petición se recibe en `POST /api/admin/ai/trigger-generation`.
- **ScraperLab**: El backend de Oferty actúa como puente y arranca el pipeline `gemini-catalog-builder` en ScraperLab enviando el término de búsqueda en el campo `product_family_name`.
- **Búsqueda (RAG)**: El pipeline consulta `GET /api/internal/products/search?q=...` de Oferty para obtener contexto. 
    - **Regla**: Si la familia ya existe, Gemini respeta los UUIDs y nombres base, proponiendo solo variantes nuevas para evitar duplicados.
- **Generación (JSON Mode)**: Gemini 2.5 Pro genera la estructura de **Familia** y **Productos** variantes. 
    - **Límite**: Se autogeneran un máximo de **4 productos/variantes** iniciales por familia para mantener la calidad.
- **Ingestión**: ScraperLab llama al endpoint seguro `POST /api/internal/ai/catalogs`.
- **Estado Inicial**: Los productos se crean con `"active": false`. Son visibles en el panel administrativo de Oferty como **"Borrador AI"**.

### Fase 2: El Cazador (Product Hunter Pipeline - Independiente)
- **Activación**: Una vez creado el producto en Oferty, se dispara una nueva ejecución de pipeline en ScraperLab de forma individual por producto (`productId`).
- **Análisis de Dominios**: Un nodo de Gemini Flash analiza el nombre y categoría del producto para determinar qué marketplaces son relevantes (ej: no buscar celulares en Olympica).
- **Búsqueda Multi-Fuente**: Se ejecuta `SCRAPE_SEARCH` usando los dominios seleccionados dinámicamente.
- **Matching de Entidades**: Gemini Flash filtra los resultados para asegurar que el match sea exacto (evitando accesorios o versiones erróneas).
- **Actualización**: ScraperLab inyecta los hallazgos mediante `PATCH /api/internal/products/:id/marketplaces`.
- **Lógica de Negocio (Backend)**: El servicio centralizado `product-service.js` en el backend:
  1. Almacena o actualiza los ítems de `MARKETPLACE#CO#...`.
  2. **Recalcula el Mejor Precio**: Identifica automáticamente la oferta más barata y actualiza el registro `BEST_PRICE`.
  3. **Historial y Alertas**: Registra el cambio en `HISTORY` y dispara notificaciones de baja de precio si aplica.

### Fase 3: Aprobación Humana (Dashboard)
- **Revisión**: El administrador filtra los productos por estado "Borrador AI".
- **Activación**: Mediante el botón de **"Aprobación"** (Check ✅) o el formulario de edición, se cambia `active: true`. El producto pasa a ser indexable y visible para los usuarios finales.

---

## 🛠️ Especificación de API Interna (v2)

Todos estos endpoints requieren la cabecera `x-internal-api-key` configurada en ambos servicios.

### 🛰️ `GET /api/internal/products/search?q=<termino>`
Recupera productos existentes para alimentar el contexto (RAG) de los prompts de Gemini.

### 💾 `POST /api/internal/ai/catalogs`
Ingesta masiva de una propuesta de catálogo (Familia + Productos). 
- **Payload**: `{ family, products: [] }`.
- **ID Management**: El backend valida si la familia ya existe por nombre o ID para evitar duplicidad de registros METADATA.

### 📈 `PATCH /api/internal/products/:productId/marketplaces`
Ingesta de hallazgos de precios. 
- **Automatismo**: Al recibir los datos, dispara internamente el recálculo de `BEST_PRICE`.

---

## 🔐 Seguridad y Configuración
- **API Shared Secret**: `OFERTY_INTERNAL_API_KEY` (debe coincidir en ambos proyectos).
- **Trigger URL**: `SCRAPERLAB_PIPELINE_URL` en el `.env` del backend de Oferty apunta a la ejecución del pipeline en ScraperLab.

---

## ⚙️ Configuración Técnica del Pipeline

Esta es la estructura JSON representativa que vive en el motor de ScraperLab para orquestar los nodos:

```json
{
  "id": "gemini-catalog-builder",
  "name": "Pipeline Generador de Catálogo AI",
  "nodes": [
    {
      "id": "start",
      "type": "TRIGGER",
      "config": { "inputType": "product_family_name" },
      "next": "fetch-knowledge"
    },
    {
      "id": "fetch-knowledge",
      "type": "API_REQUEST",
      "config": {
        "method": "GET",
        "url": "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/search?q={{input.product_family_name}}",
        "headers": { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" }
      },
      "next": "ai-generate-catalog"
    },
    {
      "id": "ai-generate-catalog",
      "type": "AI_PROMPT",
      "config": {
        "model": "gemini-2.5-pro",
        "isJson": true,
        "promptTemplate": "Genera el catálogo técnico... BASE DE CONOCIMIENTO: {{nodes.fetch-knowledge.data}}..."
      },
      "next": "map-payload"
    },
    {
      "id": "map-payload",
      "type": "DATA_MAPPING",
      "config": {
        "mapping": {
          "family": "{{nodes.ai-generate-catalog.family}}",
          "products": "{{nodes.ai-generate-catalog.products}}"
        }
      },
      "next": "push-to-oferty"
    },
    {
      "id": "push-to-oferty",
      "type": "API_REQUEST", 
      "config": {
        "method": "POST",
        "url": "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/ai/catalogs",
        "headers": { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" },
        "bodyTemplate": "{{nodes.map-payload}}"
      },
      "next": null
    }
  ]
}
```

### 🏹 Pipeline: `product-hunter` (El Cazador)

Este pipeline se encarga de buscar precios para un producto específico de forma inteligente.

```json
{
  "id": "product-hunter",
  "name": "Hunter de Precios Seleccionado",
  "nodes": [
    {
      "id": "start",
      "type": "TRIGGER",
      "config": { "inputType": { "productId": "string", "name": "string", "category": "string" } },
      "next": "ai-select-sources"
    },
    {
      "id": "ai-select-sources",
      "type": "AI_PROMPT",
      "config": {
        "model": "gemini-2.5-flash",
        "isJson": true,
        "promptTemplate": "Analiza el producto '{{input.name}}' de la categoría '{{input.category}}'. Selecciona los dominios más relevantes para buscar su precio en Colombia de esta lista: ['exito.com', 'mercadolibre.com.co', 'falabella.com.co', 'alkosto.com', 'ktronix.com']. Responde un JSON con el campo 'domainIds' (array)."
      },
      "next": "search-marketplaces"
    },
    {
      "id": "search-marketplaces",
      "type": "SCRAPE_SEARCH",
      "config": {
        "domainIds": "{{nodes.ai-select-sources.domainIds}}",
        "queryTemplate": "{{input.name}}",
        "limit": 3
      },
      "next": "ai-match-offer"
    },
    {
      "id": "ai-match-offer",
      "type": "AI_PROMPT",
      "config": {
        "model": "gemini-2.5-flash",
        "isJson": true,
        "promptTemplate": "Producto buscado: {{input.name}}. Resultados obtenidos: {{nodes.search-marketplaces}}. Encuentra el match exacto y extrae {price, url, domainId}. Si no hay match exacto, retorna null."
      },
      "next": "update-oferty"
    },
    {
      "id": "update-oferty",
      "type": "API_REQUEST",
      "config": {
        "method": "PATCH",
        "url": "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{input.productId}}/marketplaces",
        "bodyTemplate": "{{nodes.ai-match-offer}}"
      },
      "next": null
    }
  ]
}
```

## 📁 Componentes del Sistema
- **product-service.js**: Corazón del backend para el cálculo de precios y notificaciones.
- **internal-ai.js**: Handler de los endpoints de ingesta protegidos (`/api/internal/ai/*`).
- **Products.jsx (Oferty)**: Consola administrativa con trigger de IA y paneles de aprobación.
- **PipelineLogs.jsx (Oferty)**: Auditoría detallada de las ejecuciones del pipeline en tiempo real.
- **ProcessesTable.jsx (ScraperLab)**: Monitoreo técnico de los nodos del pipeline con visualización de errores JSON.
