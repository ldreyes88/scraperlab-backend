# Guía y Procedimiento Estándar (SOP): Migración y Creación de Dominios con ScraperLabsApi

Esta guía define el flujo de trabajo estandarizado para migrar dominios existentes o crear nuevos dominios utilizando el proveedor propio **ScraperLabsApi** (`scraperlabsapi`).

Todos los cambios deben quedar respaldados y documentados en:
- `docs/domains/<dominio>.backup.json` (en caso de migración)
- `docs/domains/<dominio>.scraperlabs.com.co.json` (configuración del dominio)
- `docs/domains/<dominio>.md` (documentación técnica detallada)

---

## 1. ¿Qué es ScraperLabsApi?

**ScraperLabsApi** (`providerId: "scraperlabsapi"`) es el motor interno de scraping headless y serverless de ScraperLab.
- **Motor:** Chromium headless (`@sparticuz/chromium` + `puppeteer-core`) optimizado para AWS Lambda y ejecución local.
- **Costo:** **~$0** en proxies comerciales externos.
- **Uso ideal:** Sitios dinámicos, SPAs (React, Vue, Next.js, Algolia), páginas con visores dinámicos o que requieran cookies, headers y ejecución real de JavaScript sin pagar tarifas por request.

---

## 2. Flujo de Trabajo para Migración de un Dominio Existente

Sigue estos 6 pasos en orden estricto:

### Paso 1: Backup Obligatorio de la Configuración Actual
Antes de modificar cualquier parámetro en la base de datos o en los archivos locales, extrae la configuración actual desde DynamoDB y almacénala en `docs/domains/`:

```bash
# 1. Extraer la configuración actual del dominio
node scripts/extractConfigDomain.js <dominio.com>

# 2. Copiar el backup generado desde .logs a docs/domains/
cp .logs/<NombreEstrategia>.json docs/domains/<dominio.com>.backup.json
```
*Ejemplo:* `docs/domains/alkomprar.com.backup.json`.

---

### Paso 2: Análisis e Ingeniería Inversa del Dominio
Verifica si el sitio cambió su diseño, componentes, arquitectura frontend o data layers:

1. **Inspección de Detalle (`detail`):**
   - Prueba la URL del producto tanto con solicitud HTTP directa como con Puppeteer headless (`ScraperLabsApiStrategy`).
   - Revisa si el sitio expone capas de datos globales (`window.dataLayer`, `ACC.dataLayer`, `__NEXT_DATA__`, etc.).
   - Comprueba si existen bloques `<script type="application/ld+json">` válidos con `@type: "Product"`.
   - Identifica selectores CSS estables para:
     - Título (`h1`, `.js-main-title`, `.product-title`)
     - Precio actual (`span.price`, `[class*='price']`, atributos `data-price`)
     - Precio anterior/tachado (`.before-price`, `span.base-price`)
     - Galería de imágenes (CDN DAM, zoom viewer, Sirv)

2. **Inspección de Búsqueda (`search` / `searchSpecific`):**
   - Comprueba la URL de búsqueda (ej. `/search?text=...`).
   - Identifica si los resultados se renderizan en el servidor o mediante clientes de búsqueda SPA (ej. **Algolia InstantSearch**, Elasticsearch, GraphQL).
   - Si usa esqueletos (`skeleton`), determina el tiempo de espera dinámico necesario (`wait: 2500` a `3500ms`).
   - Identifica contenedor de producto (`containerSelector`), título, precio de oferta, precio anterior, URL e imagen.

---

### Paso 3: Elaborar el Archivo JSON de Configuración
Crea el archivo `docs/domains/<dominio.com>.scraperlabs.com.co.json` con la siguiente estructura base:

```json
{
  "domainId": "ejemplo.com",
  "providerId": "scraperlabsapi",
  "countryCode": "CO",
  "enabled": true,
  "supportedTypes": [
    "detail",
    "search",
    "searchSpecific"
  ],
  "providerConfig": {
    "detail": {
      "wait": 2000,
      "block_images": true,
      "timeout": 45000
    },
    "search": {
      "wait": 3000,
      "block_images": true,
      "timeout": 45000
    },
    "searchSpecific": {
      "wait": 3000,
      "block_images": true,
      "timeout": 45000
    }
  },
  "scraperConfig": {
    "search": {
      "containerSelector": ".product-card",
      "titleSelector": ".product-card__title",
      "priceSelector": ".product-card__price",
      "originalPriceSelector": ".product-card__old-price",
      "urlSelector": "a.product-card__link",
      "imageSelector": "img",
      "scripts": []
    },
    "searchSpecific": {
      "css": {
        "title": ".product-card__title",
        "price": ".product-card__price",
        "originalPrice": ".product-card__old-price",
        "url": "a.product-card__link",
        "image": "img",
        "availability": ""
      },
      "nextData": {
        "productPath": "",
        "pricePath": "",
        "originalPricePath": "",
        "titlePath": "",
        "imagePath": ""
      },
      "jsonLd": {
        "pricePath": "",
        "originalPricePath": ""
      },
      "scripts": []
    },
    "detail": {
      "css": {
        "title": "h1.product-title",
        "price": "span.current-price",
        "originalPrice": "span.old-price",
        "image": ".gallery-container img",
        "availability": ""
      },
      "nextData": {
        "productPath": "",
        "pricePath": "",
        "originalPricePath": "",
        "titlePath": "",
        "imagePath": ""
      },
      "jsonLd": {
        "pricePath": "offers.price",
        "originalPricePath": "offers.highPrice"
      },
      "scripts": [
        {
          "key": "currentPrice",
          "regex": "[\"']?price[\"']?\\s*:\\s*[\"']?(\\d+)[\"']?"
        },
        {
          "key": "originalPrice",
          "regex": "[\"']?previousPrice[\"']?\\s*:\\s*[\"']?(\\d+)[\"']?"
        }
      ]
    }
  },
  "strategyOrder": [
    "css",
    "scripts",
    "jsonLd",
    "meta",
    "nextData"
  ],
  "useJsonLd": true,
  "useCss": true,
  "useMeta": true,
  "useNextData": false,
  "useScripts": true,
  "subdomains": [],
  "typeService": [
    "scraping"
  ]
}
```

---

### Paso 4: Importar a DynamoDB
Aplica la configuración directamente a la base de datos usando el script del sistema:

```bash
node scripts/importConfigDomain.js docs/domains/<dominio.com>.scraperlabs.com.co.json
```

Verifica la salida para confirmar que el registro fue actualizado exitosamente con timestamp de Colombia.

---

### Paso 5: Validación End-to-End
Ejecuta una prueba completa de extracción utilizando `ScraperService`:

```javascript
const ScraperService = require('./src/services/ScraperService');

(async () => {
  const detailUrl = 'https://www.dominio.com/producto/...';
  const detailResult = await ScraperService.scrapeUrl(detailUrl, false, 'detail');
  console.log('Detail Extraction:', detailResult.data.prices, detailResult.data.details);

  const searchUrl = 'https://www.dominio.com/search?text=...';
  const searchResult = await ScraperService.scrapeUrl(searchUrl, false, 'search');
  console.log('Search Extraction:', searchResult.data.results?.length);
})();
```

**Criterios de Aceptación:**
- [x] `success` es `true`.
- [x] `prices.current` y `prices.original` son numéricos y válidos.
- [x] `details.title` contiene el nombre real del producto (sin basura de scripts ni `null`).
- [x] `details.image` contiene una URL absoluta en alta resolución.
- [x] En búsquedas, la lista de productos contiene al menos 5-25 resultados con títulos, precios y enlaces válidos.

---

### Paso 6: Generar Documentación en `docs/domains/<dominio.com>.md`
Crea el archivo `.md` de documentación técnica con las siguientes secciones obligatorias:
1. **Especificaciones Generales:** Dominio, país, proveedor anterior, proveedor actual, tecnología.
2. **Análisis Técnico (Antes vs Ahora):** Cambios detectados en componentes, data layers, JSON-LD o selectores.
3. **Estrategias por Tipo:** Selectores y tiempos de espera para `detail`, `search` y `searchSpecific`.
4. **Enlaces a Archivos:** Links relativos a `docs/domains/<dominio>.backup.json` y `docs/domains/<dominio>.scraperlabs.com.co.json`.
5. **Configuración Activa:** Bloque de código con el JSON completo registrado en DynamoDB.

---

## 3. Flujo de Trabajo para Crear un Dominio Nuevo

Cuando se implementa un dominio que no existía previamente en ScraperLab:

1. **Identificar el FQDN:** Usar siempre el dominio raíz limpio (ej: `nuevo-comercio.com` o `nuevo-comercio.com.co`).
2. **Omitir el paso de backup** (al ser nuevo no hay registro previo).
3. **Seleccionar 2 URLs de prueba:**
   - 1 URL de Detalle de Producto representativo.
   - 1 URL de Búsqueda con término popular (ej: `samsung`, `celular`, `nevera`).
4. **Seguir los Pasos 2 a 6** descritos anteriormente:
   - Crear `docs/domains/<dominio>.scraperlabs.com.co.json`.
   - Ejecutar `node scripts/importConfigDomain.js ...`.
   - Validar con `ScraperService.scrapeUrl`.
   - Documentar en `docs/domains/<dominio>.md`.

---

## 4. Buenas Prácticas y Reglas de Oro

1. **Orden de Estrategias (`strategyOrder`):**
   - Siempre coloca `"css"` de primero: `["css", "scripts", "jsonLd", "meta", "nextData"]`.
   - **Razón:** Los selectores CSS se evalúan directamente sobre el DOM renderizado por Puppeteer. Si colocas `"scripts"` de primero con expresiones regulares permisivas, podrías capturar scripts internos con valores como `name: null`, sobreescribiendo el título correcto del DOM.
2. **Optimización de Rendimiento en Lambda:**
   - Siempre incluye `"block_images": true` en `providerConfig`. Puppeteer cancela peticiones de imágenes/fuentes ahorrando memoria y ancho de banda, pero preserva los atributos `src` / `data-src` en el HTML.
3. **Selectores de Búsqueda en SPAs:**
   - Si el sitio usa clientes de renderizado como Algolia o React InstantSearch, evita usar `wait_for_selector` si la librería destruye los nodos esqueleto en el ciclo de hidratación (puede ocasionar `Cannot find context with specified id`). En su lugar, usa `"wait": 3000` para permitir una transición limpia del DOM.
4. **Precios en Centavos (`divisor`):**
   - En plataformas Shopify o VTEX, los precios en scripts suelen venir multiplicados por 100 (ej: `150000000` para `$1.500.000`). En esos casos, incluye siempre `"divisor": 100` dentro del objeto del script.
5. **Normalización:**
   - Asegúrate de que el JSON importado sea plano (sin tipos DynamoDB `{ S: "..." }`), ya que `DomainConfigService` se encarga de la serialización adecuada.
