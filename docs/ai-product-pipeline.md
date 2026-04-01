# Pipeline Agéntico de Productos (AI Product Catalog)

Este documento describe la arquitectura, endpoints y flujo de trabajo del pipeline automatizado que integra **ScraperLab** con el ecosistema de **Oferty** mediante Gemini AI.

## 🌟 Visión General
El objetivo del pipeline es automatizar la creación de catálogos de alta calidad (familias de productos con sus variantes) y mantener sus precios actualizados mediante agentes de búsqueda (Hunters) potenciados por **Gemini 2.5 Flash/Pro**.

## 🏗️ Arquitectura del Flujo

### Fase 0: Disparo (Oferty Admin)
- **Acción**: Un administrador pulsa el botón **"Generar con IA"** ✨ en el panel de productos de `oferty-web`.
- **Backend**: La petición se recibe en `POST /api/admin/ai/trigger-generation`.
- **ScraperLab**: El backend de Oferty actúa como puente y arranca el pipeline `gemini-catalog-builder` en ScraperLab enviando el término de búsqueda en el campo `product_family_name` del input.
- **Búsqueda (RAG)**: El pipeline de ScraperLab consulta `GET /api/internal/products/search?q=...` de Oferty para obtener contexto y evitar duplicados. **Nota**: ScraperLab inyecta automáticamente la `x-internal-api-key` para este dominio.
- **Generación (JSON Mode)**: Gemini 2.5 genera la estructura de **Familia** y **Productos** variantes. Se utiliza el modo nativo `application/json` para garantizar que la respuesta sea un objeto válido sin bloques markdown.
- **Ingestión**: ScraperLab llama al endpoint seguro `POST /api/internal/ai/catalogs`.
- **Estado Inicial**: Los productos se crean con `"active": false` en DynamoDB. Son visibles en el panel administrativo de Oferty como **"Borrador AI"**.

### Fase 2: Actualización de Precios (Hunter + Recalculate)
- **Búsqueda de Precios**: Una vez creado el catálogo base, un agente secundario (o el mismo pipeline) busca el producto en marketplaces reales.
- **Actualización**: ScraperLab inyecta los hallazgos mediante `PATCH /api/internal/products/:id/marketplaces`.
- **Lógica de Negocio (Backend)**: El servicio centralizado `product-service.js` en el backend:
  1. Almacena o actualiza los ítems de `MARKETPLACE#CO#...`.
  2. **Recalcula el Mejor Precio**: Identifica automáticamente la oferta más barata.
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

## 📁 Componentes del Sistema
- **product-service.js**: Corazón del backend para el cálculo de precios y notificaciones.
- **internal-ai.js**: Handler de los endpoints de ingesta protegidos.
- **Products.jsx (Oferty)**: Consola administrativa con trigger de IA y paneles de aprobación.
- **PipelineLogs.jsx (Oferty)**: Auditoría detallada de las ejecuciones del pipeline en tiempo real.
- **ProcessesTable.jsx (ScraperLab)**: Monitoreo técnico de los nodos del pipeline con visualización de errores JSON.
