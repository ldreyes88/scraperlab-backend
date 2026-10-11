# Configuración de Dominio: alkomprar.com

Información técnica, análisis de componentes y estrategias de extracción para el dominio **alkomprar.com** implementado con el proveedor propio **ScraperLabsApi** (`scraperlabsapi`).

---

## 1. Especificaciones Generales

| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `alkomprar.com` |
| **País** | `CO` |
| **Proveedor Principal** | `scraperlabsapi` (Headless Chromium Serverless en AWS Lambda / Local) |
| **Proveedor Anterior** | `scraperapi` (Migrado a ScraperLabsApi) |
| **Tecnología del Sitio** | SAP Commerce (Hybris) + Algolia InstantSearch (Búsqueda SPA) + DAM CDN Sirv |
| **Tipos Soportados** | `detail`, `search`, `searchSpecific` |

---

## 2. Análisis Técnico: ¿Cambiaron los componentes o la forma de extracción?

### Diagnóstico Comparativo (Antes vs Ahora)

1. **Estado Anterior (Backup en `alkomprar.com.backup.json`):**
   - **Proveedor:** `scraperapi`.
   - **Tipos soportados:** Solo `detail`.
   - **Selectores CSS:** Vacíos (`price: ""`, `originalPrice: ""`, `title: ""`, `image: ""`).
   - **Estrategia Scripts:** Dependía exclusivamente de dos expresiones regulares: `price:"(\\d+)"` y `previousPrice:"(\\d+)"`.
   - **Búsqueda (`search`/`searchSpecific`):** No implementada.

2. **Estado Actual tras Análisis en Vivo:**
   - **Capa de Datos de Scripts (`dataLayer`):** Se mantiene la presencia del objeto global SAP Hybris `ACC.dataLayer.GAEcommerceData.GAProductData[0]`, el cual contiene `price`, `previousPrice`, `name` y `brand`. Las expresiones regulares siguen funcionando y ofrecen datos muy fiables para precios numéricos.
   - **JSON-LD:** En las páginas de detalle de Alkomprar, actualmente el JSON-LD sólo inyecta `@type: "BreadcrumbList"` (no inyecta `@type: "Product"` en el HTML). Por lo tanto, no se debe depender de JSON-LD como estrategia principal.
   - **Estructura DOM / CSS en Detalle:**
     - El título reside en `h1.js-main-title` (y `h1`).
     - El precio actual se renderiza en `span.price-alkomprar` (o `span.font-title--product-price`).
     - El precio anterior/tachado se renderiza en `span.before-price__basePrice`.
     - La galería principal de imágenes usa Sirv viewer y se encuentra en `.image-gallery img` o `.galleryContainers img`.
   - **Búsqueda Dinámica (Algolia InstantSearch):**
     - La página de búsqueda (`/search?text=...`) utiliza **Algolia**.
     - En el HTML crudo inicial sólo vienen esqueletos de carga (`product__item product__item--loading skeleton`).
     - **ScraperLabsApi** resuelve este reto ejecutando el JavaScript real y esperando 3000ms a que Algolia pinte las tarjetas de producto (`.ais-InfiniteHits-item`).
     - En las tarjetas de búsqueda, el título está en `h3.product__item__top__title`, el precio con descuento en `p.product__price--discounts__price`, el precio tachado en `p.product__price--discounts__old`, y el enlace en `a.product__item__top__link`.

---

## 3. Estrategias por Tipo

### 1. Detalle de Producto (`detail`)
- **Comportamiento:** Página renderizada por SAP Commerce con scripts dinámicos y visor de galería DAM.
- **Estrategia Recomendada:** Mixta (`css` > `scripts` > `jsonLd` > `meta`).
- **Configuración de Proveedor (`providerConfig.detail`):**
  - `"wait": 2000`: Permite que la galería y scripts de ecommerce finalicen su carga.
  - `"block_images": true`: Ahorra ancho de banda y tiempo de respuesta sin afectar la extracción de URLs de imagen.
  - `"timeout": 45000`.
- **Selectores CSS:**
  - `title`: `h1.js-main-title, h1, .product-title`
  - `price`: `span.price-alkomprar, span.font-title--product-price, .alk-main-price, span.price`
  - `originalPrice`: `span.before-price__basePrice, span.base-price`
  - `image`: `.image-gallery img, .galleryContainers img, .js-gallery img, [class*='pdp-gallery-wrapper'] img`
- **Patrones de Scripts:**
  - `currentPrice`: `["']?price["']?\s*:\s*["']?(\d+)["']?`
  - `originalPrice`: `["']?previousPrice["']?\s*:\s*["']?(\\d+)["']?`

### 2. Búsqueda y Búsqueda Específica (`search` / `searchSpecific`)
- **Comportamiento:** SPA impulsada por Algolia InstantSearch. No existe en el HTML estático inicial.
- **Configuración de Proveedor (`providerConfig.search` / `searchSpecific`):**
  - `"wait": 3000`: Tiempo necesario para que Algolia sustituya los esqueletos por los ítems reales.
  - `"block_images": true`.
  - `"timeout": 45000`.
- **Selectores de Búsqueda:**
  - `containerSelector`: `li.ais-InfiniteHits-item, .product__item:not(.skeleton)`
  - `titleSelector`: `h3.product__item__top__title, .product__item__top__title`
  - `priceSelector`: `p.product__price--discounts__price, span.price`
  - `originalPriceSelector`: `p.product__price--discounts__old`
  - `urlSelector`: `a.product__item__top__link, a[href*='/p/']`
  - `imageSelector`: `img`

---

## 4. Archivos Relacionados

- **Backup Anterior:** [alkomprar.com.backup.json](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/docs/domains/alkomprar.com.backup.json)
- **Configuración ScraperLabsApi:** [alkomprar.com.scraperlabs.com.co.json](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/docs/domains/alkomprar.com.scraperlabs.com.co.json)

---

## 5. Configuración Activa en Base de Datos (DynamoDB)

```json
{
  "domainId": "alkomprar.com",
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
      "containerSelector": "li.ais-InfiniteHits-item, .product__item:not(.skeleton)",
      "titleSelector": "h3.product__item__top__title, .product__item__top__title",
      "priceSelector": "p.product__price--discounts__price, span.price",
      "originalPriceSelector": "p.product__price--discounts__old",
      "urlSelector": "a.product__item__top__link, a[href*='/p/']",
      "imageSelector": "img",
      "scripts": []
    },
    "searchSpecific": {
      "css": {
        "title": "h3.product__item__top__title, .product__item__top__title",
        "price": "p.product__price--discounts__price, span.price",
        "originalPrice": "p.product__price--discounts__old",
        "url": "a.product__item__top__link, a[href*='/p/']",
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
        "title": "h1.js-main-title, h1, .product-title",
        "price": "span.price-alkomprar, span.font-title--product-price, .alk-main-price, span.price",
        "originalPrice": "span.before-price__basePrice, span.base-price",
        "image": ".image-gallery img, .galleryContainers img, .js-gallery img, [class*='pdp-gallery-wrapper'] img",
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
