# Configuración de Dominio: exito.com

Información técnica y estrategias de extracción para el dominio **exito.com**.

## Especificaciones Generales
| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `exito.com` |
| **País** | `CO` |
| **Proveedor** | `scraperapi` |
| **Tecnología** | Next.js / VTEX FastStore |

## Estrategias por Tipo

### 1. Búsqueda (`search` / `searchSpecific`)
- **Comportamiento:** El sitio es una SPA (Single Page Application). Los resultados de búsqueda **no están presentes en el HTML inicial**.
- **Requisito Crítico:** Requiere `"render": true` y `"premium": true` para que el Javascript se ejecute y los productos aparezcan en el DOM.
- **Selectores:**
  - `containerSelector`: `article[class*='productCard_productCard']`
  - `titleSelector`: `h3[class*='styles_name']`
  - `priceSelector`: `[class*='price_fs-price']`
  - `originalPriceSelector`: `[class*='product-price_fs-price-listing']`
  - `urlSelector`: `a[class*='productCard_productLinkInfo']`

### 2. Detalle de Producto (`detail`)
- **Comportamiento:** La información del producto está disponible en el HTML inicial dentro de un bloque `ld+json`.
- **Estrategia Recomendada:** `jsonLd`.
- **Optimización:** **No requiere renderizado**. Se deben omitir los campos `render` y `premium` en la configuración de `detail`.
- **Selectores:**
  - `title`: `h1[class*='product-title_product-title__heading']`
  - `price`: `[class*='price_fs-price']`
  - `originalPrice`: `[class*='product-price_fs-price-listing']`
  - `jsonLd.pricePath`: `price`
  - `jsonLd.originalPricePath`: `listPrice`

## Ejemplo de Configuración en Base de Datos

```json
{
  "domainId": "exito.com",
  "useJsonLd": true,
  "useCss": true,
  "strategyOrder": ["jsonLd", "css"],
  "scraperConfig": {
    "search": {
      "containerSelector": "article[class*='productCard_productCard']",
      "priceSelector": "[class*='allieds-display_bestDiscount'] [class*='price_fs-price']"
    },
    "detail": {
      "jsonLd": {
        "pricePath": "offers.price",
        "titlePath": "name"
      }
    }
  },
  "providerConfig": {
    "search": {
      "render": true,
      "premium": true
    },
    "detail": {
      "device_type": "desktop"
    }
  }
}
```
