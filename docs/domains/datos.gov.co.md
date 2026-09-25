# Configuración de Dominio: datos.gov.co (SECOP II API SODA)

Información técnica, parámetros de filtrado y estrategias de consulta para el catálogo de **SECOP II - Procesos de Contratación** a través de la API oficial de **Datos Abiertos Colombia** (`datos.gov.co`).

---

## Especificaciones Generales

| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `datos.gov.co` |
| **País** | `CO` |
| **Proveedor** | `api` (DirectAPIStrategy) |
| **Costo por Request** | **$0 USD** |
| **Tipo de Respuesta** | JSON nativo estructurado |
| **Dataset ID (SECOP II)** | `p6dx-8zbt` |
| **Endpoint Base** | `https://www.datos.gov.co/resource/p6dx-8zbt.json` |

---

## Estrategia de Búsqueda (`search`)

A diferencia del web scraping en `community.secop.gov.co` (que requiere renderizado de JavaScript y resolución de reCAPTCHA), el dominio **`datos.gov.co`** ejecuta consultas REST directas vía Axios mediante el provider **`api`**.

### Ventajas Operativas:
1. **Velocidad:** Tiempos de respuesta de **300ms a 800ms**.
2. **Cero Bloqueos:** No requiere proxies residenciales ni resuelve captchas.
3. **Filtros SoQL Nativos:** Permite filtrar por fechas exactas, rangos, códigos UNSPSC y estados directamente en los parámetros de la URL.
4. **Enlace Directo (`urlproceso`):** Cada proceso devuelto incluye la URL canónica de `community.secop.gov.co` con su `noticeUID`, permitiendo pasar directamente a la fase de extracción documental de anexos (Detail).

---

## Parámetros y Filtros de Búsqueda Disponibles (SoQL)

La API permite construir consultas dinámicas usando el parámetro `$where`:

| Filtro Deseado | Campo en la API | Sintaxis SoQL / Ejemplo |
| :--- | :--- | :--- |
| **Rango de Fechas** | `fecha_de_publicacion_del` | `$where=fecha_de_publicacion_del >= '2026-09-01T00:00:00.000'` |
| **Sector Salud (UNSPSC)** | `codigo_principal_de_categoria` | `codigo_principal_de_categoria in ('42', '51')` |
| **Búsqueda por Texto** | `descripcion_del_proceso` | `contains(descripcion_del_proceso, 'jeringa')` o `$q=jeringa` |
| **Entidad Contratante** | `entidad` / `nit_entidad` | `nit_entidad = '899999090'` |
| **Estado del Proceso** | `estado_del_proceso` | `estado_del_proceso = 'Presentación de ofertas'` |
| **Fase del Proceso** | `fase` | `fase = 'Evaluación'` |
| **Paginación / Límite** | `$limit` / `$offset` | `$limit=1000&$offset=0` |
| **Ordenamiento** | `$order` | `$order=fecha_de_publicacion_del DESC` |

---

## Template de Búsqueda Recomendado (`searchUrlTemplate`)

```
https://www.datos.gov.co/resource/p6dx-8zbt.json?$where=fecha_de_publicacion_del >= '{{startDate}}' AND (codigo_principal_de_categoria = '42' OR codigo_principal_de_categoria = '51')&$order=fecha_de_publicacion_del DESC&$limit=100
```

---

## Campos Mapeados en la Respuesta JSON

| Campo API | Significado de Negocio | Uso en ScraperLab |
| :--- | :--- | :--- |
| `id_del_proceso` | Identificador interno SECOP II | `id` |
| `referencia_del_proceso` | Número o Referencia de la convocatoria | `reference` |
| `entidad` | Nombre de la entidad pública contratante | `entity` |
| `nit_entidad` | NIT de la entidad | `nit` |
| `descripcion_del_proceso` | Objeto a contratar | `title` / `description` |
| `precio_base` | Presupuesto oficial o cuantía | `price` |
| `fecha_de_publicacion_del` | Fecha de publicación | `publishDate` |
| `fecha_de_recepcion_de_respuestas` | Cierre para presentar ofertas | `closingDate` |
| `estado_del_proceso` | Estado administrativo | `status` |
| `urlproceso.url` | **URL directa a la ficha en `community.secop.gov.co`** | **`detailUrl` (Input para Capa 2)** |

---

## Integración con el Flujo de Dos Capas

```
1. TRIGGER (Mes / Rango de fechas)
   │
   ▼
2. SCRAPE_SEARCH en 'datos.gov.co' (Provider: 'api', Costo $0)
   ├── Filtra por fechas y códigos UNSPSC de salud
   └── Obtiene array de procesos con sus respectivos 'urlproceso.url'
   │
   ▼
3. SCRAPE_DETAIL en 'community.secop.gov.co' (Provider: 'scraperapi', render: true)
   └── Descarga los PDFs de las ofertas económicas y anexos técnicos
   │
   ▼
4. AI_PROMPT (Google Gemini Multimodal)
   └── Estructuración de renglones, precios unitarios y marcas
```
