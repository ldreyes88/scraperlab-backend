# Configuración de Dominio: community.secop.gov.co

Información técnica, filtros de búsqueda y estrategias de extracción para el portal transaccional de contratación pública **SECOP II** (`community.secop.gov.co`).

---

## Especificaciones Generales

| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `community.secop.gov.co` |
| **País** | `CO` |
| **Proveedor Recomendado** | `scraperapi` (Web Scraping) / `api` (Direct API para Socrata) |
| **Tecnología del Portal** | ASP.NET WebForms (Plataforma Vortal / Jaggaer) |
| **Protección Activa** | Google reCAPTCHA Enterprise |

---

## Estrategias por Tipo

### 1. Búsqueda (`search` / `searchSpecific`)

- **URL del Buscador:**  
  `https://community.secop.gov.co/Public/Tendering/ContractNoticeManagement/Index?currentLanguage=es-CO&Page=login&Country=CO&SkinName=CCE`
- **Comportamiento:**  
  La página de búsqueda es una aplicación ASP.NET. La ejecución de la búsqueda se realiza mediante un `POST` con `__VIEWSTATE` y `__EVENTVALIDATION`. Requiere renderizado de JavaScript para cargar la grilla de resultados.
- **Requisito Crítico:**  
  Requiere `"render": true`, `"ultra_premium": true` y `"country_code": "co"` para evadir reCAPTCHA Enterprise y ejecutar los scripts de Vortal.
- **Selectores de la Grilla de Resultados:**
  - `containerSelector`: `table[id*='grid'] tbody tr, .vortal-grid tr.gridRow, #tblSearchResults tbody tr`
  - `titleSelector`: `td:nth-child(4), .process-description` *(Columna: Descripción)*
  - `priceSelector`: `td:nth-child(8), .process-budget` *(Columna: Cuantía)*
  - `originalPriceSelector`: `td:nth-child(8), .process-budget`
  - `urlSelector`: `a[href*='OpportunityDetail'], td:last-child a, input[value='Detalle']` *(Enlace a la ficha de la oportunidad)*
  - `imageSelector`: `td:nth-child(1) img, img` *(Bandera/Ícono de estado)*

#### Filtros Disponibles en el Formulario de Búsqueda:
| Filtro | Selector del Formulario | Formato / Ejemplo |
| :--- | :--- | :--- |
| **Fecha de Publicación (Desde)** | `input[id*='txtPublishDateFrom']` | `DD/MM/YYYY hh:mm A` (ej: `24/09/2026 12:00 AM`) |
| **Fecha de Publicación (Hasta)** | `input[id*='txtPublishDateTo']` | `DD/MM/YYYY hh:mm P` (ej: `24/09/2026 11:59 PM`) |
| **Fecha Presentación Ofertas (Desde)** | `input[id*='txtOfferSubmissionDateFrom']` | `DD/MM/YYYY hh:mm A` |
| **Fecha Presentación Ofertas (Hasta)** | `input[id*='txtOfferSubmissionDateTo']` | `DD/MM/YYYY hh:mm P` |
| **Fecha Apertura (Desde / Hasta)** | `input[id*='txtOpeningDateFrom']`, `input[id*='txtOpeningDateTo']` | `DD/MM/YYYY` |
| **Descripción / Objeto** | `input[id*='txtDescription']` | Texto libre (ej: `dispositivos medicos`, `jeringa`) |
| **Código UNSPSC** | `input[id*='txtUNSPSC']` | Código o Segmento (ej: `42` para salud, `51` para farmacéuticos) |
| **Número del Proceso** | `input[id*='txtProcessNumber']` | Referencia contractual |
| **Datos de la Entidad / NIT** | `input[id*='txtEntityName']` | Nombre o NIT de la entidad compradora |
| **Estado del Proceso** | `select[id*='ddlStatus']` | Dropdown (`Presentación de ofertas`, `Evaluación`, `Adjudicado`) |
| **Tipo de Proceso** | `select[id*='ddlProcessType']` | Dropdown (`Licitación pública`, `Selección abreviada`, etc.) |
| **Región** | `input[id*='txtRegion']` | Departamento o municipio |
| **Botón de Búsqueda** | `#btnSearch, input[value='Buscar'], a[id*='btnSearch']` | Disparador del POST de búsqueda |

---

### 2. Detalle de Licitación (`detail`)

- **Estructura Canónica de URL:**  
  `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID={noticeUID}&isFromPublicArea=True&isModal=False`
- **Comportamiento:**  
  Carga la ficha completa de la licitación con el cronograma, información de la entidad y la sección de **Documentos del Proceso (anexos técnicos, ofertas económicas y actas de adjudicación en PDF)**.
- **Estrategia Recomendada:** `css`.
- **Selectores de Detalle:**
  - `title`: `span[id*='txtProcessTitle'], h1.process-title`
  - `reference`: `span[id*='txtReference'], span[id*='txtProcessNumber']`
  - `entity`: `span[id*='txtCustomerName'], .entity-name`
  - `nit`: `span[id*='txtCustomerDocNumber'], .entity-nit`
  - `price`: `span[id*='txtEstimatedValue'], .estimated-price`
  - `availability` / `status`: `span[id*='txtStatus'], .process-status`
  - `documentsList`: `table[id*='gridDocuments'] tr a[href*='DownloadAttachment'], .attachment-list a, a[href*='DownloadAttachment']`

---

## Pipeline de Extracción Recomendado

Para optimizar costos y evitar los tiempos de espera del reCAPTCHA en la búsqueda masiva, se recomienda la **Estrategia Híbrida**:

1. **Búsqueda Instantánea (API SODA - Costo $0):**
   - Consumir el endpoint `https://www.datos.gov.co/resource/p6dx-8zbt.json` filtrando con SoQL por fechas (`fecha_de_publicacion_del`) y códigos UNSPSC.
   - Extraer el campo `urlproceso` que contiene la URL canónica de `community.secop.gov.co` con su `noticeUID`.
2. **Descarga de Anexos (ScraperAPI en `community.secop.gov.co`):**
   - Ejecutar el `SCRAPE_DETAIL` sobre la `urlproceso` con `"render": true` y `"ultra_premium": true` para descargar los PDFs de ofertas y pliegos.
3. **Lectura Documental con IA (Gemini Multimodal):**
   - Parsear los PDFs para estructurar los renglones, precios unitarios y marcas.

---

## Archivo para Importación Rápida

El archivo de configuración JSON completo y listo para ser importado directamente en el panel administrativo de ScraperLab (botón **Importar JSON**) se encuentra en:
`scraperlab-backend/.logs/scraperConfig/domain-community.secop.gov.co.json`
