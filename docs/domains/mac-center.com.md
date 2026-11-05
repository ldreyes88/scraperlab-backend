# Configuración de Dominio: mac-center.com

Información técnica, análisis de componentes y estrategias de extracción para el dominio **mac-center.com** implementado con el proveedor propio **ScraperLabsApi** (`scraperlabsapi`).

---

## 1. Especificaciones Generales

| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `mac-center.com` |
| **País** | `CO` |
| **Proveedor Principal** | `scraperlabsapi` (Headless Chromium Serverless en AWS Lambda / Local) |
| **Proveedor Anterior** | `scraperapi` (Migrado a ScraperLabsApi) |
| **Tecnología del Sitio** | Shopify Plus + CDN Cloudflare |
| **Tipos Soportados** | `detail`, `search`, `searchSpecific` |

---

## 2. Análisis Técnico: ¿Cambiaron los componentes o la forma de extracción?

### Diagnóstico Comparativo (Antes vs Ahora)

1. **Estado Anterior (Backup en `mac-center.com.backup.json`):**
   - **Proveedor:** `scraperapi`.
   - **Tipos soportados:** Solo `detail`.
   - **Estrategia Scripts:** Dependía de regex sobre scripts de Shopify (`window.meta`) con divisor 100 para corregir el valor en centavos.
   - **Búsqueda (`search`/`searchSpecific`):** No implementada.

2. **Estado Actual tras Análisis y Migración a ScraperLabsApi:**
   - **Evasión y Renderizado Serverless:** `mac-center.com` aplica bloqueo 403 a peticiones HTTP sin headers/contexto de navegación real. Con **ScraperLabsApi**, Puppeteer ejecuta Chromium headless nativo con flags de evasión (`AutomationControlled` desactivado, User-Agent real y bloqueo de imágenes para máxima velocidad).
   - **Capa de Scripts (`window.meta` y Shopify Analytics):** Los scripts globales de Shopify siguen presentes en el DOM renderizado. Se mantiene la prioridad de `scripts` con `divisor: 100` (`"price": 289900000` $\rightarrow$ $2.899.000).
   - **JSON-LD Schema (`Product`):** Shopify inyecta bloques `<script type="application/ld+json">` con `@type: "Product"` y `offers.price`, lo que ofrece una segunda capa de extracción 100% estructurada.
   - **Selectores CSS de Detalle:** Se ampliaron a selectores estándar y actualizados de plantillas Shopify (`.price-item--sale`, `.product-price`, `h1.product-title`).
   - **Búsqueda Dinámica (`search` y `searchSpecific`):** Se incorporan los selectores de tarjetas de catálogo y cuadrícula de productos (`.product-card`, `.card-wrapper`, `a[href*='/products/']`).

---

## 3. Estrategias por Tipo

### 1. Detalle de Producto (`detail`)
- **Comportamiento:** Ficha de producto Shopify con variantes de color y almacenamiento cargadas en scripts y DOM.
- **Estrategia Recomendada:** Mixta priorizada (`scripts` > `jsonLd` > `css` > `meta`).
- **Configuración de Proveedor (`providerConfig.detail`):**
  - `"wait": 2000`: Permite la hidratación de scripts de producto.
  - `"block_images": true`: Bloquea recursos pesados y acelera la extracción.
  - `"timeout": 45000`.
- **Patrones de Scripts:**
  - `currentPrice`: `["']?price["']?\s*:\s*["']?(\d+)["']?` con `divisor: 100`.
  - `originalPrice`: `["']?compare_at_price["']?\s*:\s*["']?(\\d+)["']?` con `divisor: 100`.
  - `title`: `["']?product_name["']?\s*:\s*["']([^"']+)["']`.
- **Selectores CSS:**
  - `title`: `h1.product-title, h1.product__title, h1.product-meta__title, h1`
  - `price`: `.price .price-item--sale, .price .price-item--regular, .product-price, .price .money, span.price`
  - `originalPrice`: `s.price-item--regular, .price-item--regular, .product-price--compare, span.compare-at-price`
  - `image`: `.product__media img, .product-gallery img, .product-single__media img, img[src*='/products/']`

### 2. Búsqueda y Búsqueda Específica (`search` / `searchSpecific`)
- **Comportamiento:** Resultados de búsqueda y colecciones Shopify.
- **Configuración de Proveedor (`providerConfig.search` / `searchSpecific`):**
  - `"wait": 2500`.
  - `"block_images": true`.
  - `"timeout": 45000`.
- **Selectores de Búsqueda:**
  - `containerSelector`: `.product-card, .product-item, .grid-product, li.grid__item, .card-wrapper`
  - `titleSelector`: `.product-card__title, .product-item__title, .card__heading, a.full-unstyled-link, h3`
  - `priceSelector`: `.price-item--sale, .price-item--regular, .price, .money`
  - `originalPriceSelector`: `s.price-item--regular, .price__sale s, .compare-at-price`
  - `urlSelector`: `a.product-card__link, a[href*='/products/']`
  - `imageSelector`: `img`

---

## 4. Archivos Relacionados

- **Backup Anterior:** [mac-center.com.backup.json](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/docs/domains/mac-center.com.backup.json)
- **Configuración ScraperLabsApi:** [mac-center.com.scraperlabs.com.co.json](file:///Users/ldreyes/Documents/Proyectos/github/scraperlab-backend/docs/domains/mac-center.com.scraperlabs.com.co.json)

---

## 5. Configuración Activa en Base de Datos (DynamoDB)

```json
{
  "domainId": "mac-center.com",
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
    "scripts",
    "jsonLd",
    "css",
    "meta"
  ],
  "useJsonLd": true,
  "useCss": true,
  "useScripts": true,
  "useMeta": true,
  "useNextData": false
}
```
