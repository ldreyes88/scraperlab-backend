# Configuración de Dominio: tienda.movistar.com.co

Información técnica, análisis de arquitectura y estrategias de extracción para el dominio **tienda.movistar.com.co** implementado con el proveedor propio **ScraperLabsApi** (`scraperlabsapi`).

---

## 1. Especificaciones Generales

| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `tienda.movistar.com.co` |
| **País** | `CO` |
| **Proveedor Principal** | `scraperlabsapi` (Headless Chromium Serverless en AWS Lambda / Local) |
| **Tecnología del Sitio** | Adobe Commerce (Magento 2) + Knockout.js + Varnish/Fastly |
| **Tipos Soportados** | `detail`, `search`, `searchSpecific` |

---

## 2. Análisis Técnico y Arquitectura de Extracción

### Plataforma y Características:
- **Estructura Adobe Commerce / Magento 2:** Las páginas de productos de la tienda online de Movistar Colombia están basadas en Magento 2. La UI renderiza dinámicamente bloques de precios (`price-box`, `price-container`, `finalPrice`) gestionados por componentes Knockout.js.
- **Motor Headless ScraperLabsApi:** Dado que Magento hidrata componentes mediante JS en el cliente, el scraping con **ScraperLabsApi** permite cargar el DOM completo, ejecutar los bundles de Knockout y leer el DOM final estabilizado sin depender de proxies externos comerciales.
- **Bloqueo de Medios:** El parámetro `"block_images": true` ahorra ancho de banda y evita la descarga innecesaria de galerías de imágenes de alta resolución (`fotorama`), leyendo únicamente sus atributos `src` o microdatos.

---

## 3. Estrategias por Tipo

### 1. Detalle de Producto (`detail`)
- **Comportamiento:** Ficha de producto con selector de cuotas, precios prepago/pospago y especificaciones técnicas.
- **Estrategia Recomendada:** Mixta priorizada (`css` > `jsonLd` > `meta` > `scripts`).
- **Configuración de Proveedor (`providerConfig.detail`):**
  - `"wait": 2500`: Tiempo de hidratación de componentes de precio de Magento.
  - `"block_images": true`.
  - `"timeout": 45000`.
- **Selectores CSS:**
  - `title`: `h1.page-title span, h1.page-title, h1[itemprop='name'], h1`
  - `price`: `.price-box .price-container .price, [data-price-type='finalPrice'] .price, .product-info-price .price, span.price`
  - `originalPrice`: `.old-price .price, [data-price-type='oldPrice'] .price, .price-box .old-price .price`
  - `image`: `.fotorama__stage__frame img, .gallery-placeholder img, img.gallery-image, img[itemprop='image']`
- **JSON-LD Schema (`Product`):**
  - `titlePath`: `"name"`
  - `pricePath`: `"offers.price"`
  - `originalPricePath`: `"offers.highPrice"`
  - `imagePath`: `"image[0]"`

### 2. Búsqueda y Búsqueda Específica (`search` / `searchSpecific`)
- **Comportamiento:** Catálogo de celulares (`/celulares`) y cuadrículas de resultados.
- **Configuración de Proveedor (`providerConfig.search` / `searchSpecific`):**
  - `"wait": 3000`: Espera para la carga completa del grid de productos.
  - `"block_images": true`.
  - `"timeout": 45000`.
- **Selectores de Búsqueda:**
  - `containerSelector`: `li.product-item, .product-item-info, .item.product`
  - `titleSelector`: `.product-item-name a, .product-item-link, strong.product-name a, h2.product-name a`
  - `priceSelector`: `.price-box .price, [data-price-type='finalPrice'] .price, span.price`
  - `originalPriceSelector`: `.old-price .price, [data-price-type='oldPrice'] .price`
  - `urlSelector`: `a.product-item-link, a.product-item-photo`
  - `imageSelector`: `img.product-image-photo, img.product-image`

---

## 4. Archivos Relacionados

- **Configuración ScraperLabsApi:** [tienda.movistar.com.co.scraperlabs.com.co.json](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/docs/domains/tienda.movistar.com.co.scraperlabs.com.co.json)

---

## 5. Configuración Activa en Base de Datos (DynamoDB)

```json
{
  "domainId": "tienda.movistar.com.co",
  "providerId": "scraperlabsapi",
  "countryCode": "CO",
  "enabled": true,
  "typeService": [
    "scraping"
  ],
  "supportedTypes": [
    "detail",
    "search",
    "searchSpecific"
  ],
  "strategyOrder": [
    "css",
    "jsonLd",
    "meta",
    "scripts"
  ],
  "useJsonLd": true,
  "useCss": true,
  "useScripts": false,
  "useMeta": true,
  "useNextData": false
}
```
