# Configuración de Dominio: falabella.com.co

Información técnica y estrategias de extracción para el dominio **falabella.com.co**.

## Especificaciones Generales
| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `falabella.com.co` |
| **País** | `CO` |
| **Proveedor** | `scraperapi` |
| **Tecnología** | Next.js |

## Estrategias por Tipo

### 1. Búsqueda (`search`)
- **Comportamiento:** Los resultados se presentan en una cuadrícula de "pods". Algunos elementos pueden requerir scroll para cargar (lazy-load).
- **Requisito:** Se recomienda `"render": true` y `"premium": true` para asegurar la carga completa de precios e imágenes.
- **Selectores:**
  - `containerSelector`: `.grid-pod`
  - `titleSelector`: `.pod-subTitle, [id^='testId-pod-displaySubTitle-']`
  - `priceSelector`: `[data-internet-price], [id^='testId-pod-price-']`
  - `urlSelector`: `a[href*='/product/'], a.pod-link`
  - `imageSelector`: `img`

### 2. Detalle de Producto (`detail`)
- **Comportamiento:** La información está presente en el HTML inicial en bloques `ld+json` y `__NEXT_DATA__`.
- **Estrategia Recomendada:** `jsonLd`.
- **Optimización:** **No requiere renderizado**. Se deben omitir los campos `render` y `premium`.
- **Selectores:**
  - `title`: `h1.product-name`
  - `price`: `[id^='testId-pdp-price-'], span.copy10`
  - `jsonLd.pricePath`: `offers.price`
  - `jsonLd.titlePath`: `name`

## Ejemplo de Configuración JSON

```json
{
  "domainId": "falabella.com.co",
  "useJsonLd": true,
  "useCss": true,
  "strategyOrder": ["jsonLd", "css"],
  "scraperConfig": {
    "search": {
      "containerSelector": ".grid-pod",
      "titleSelector": ".pod-subTitle, [id^='testId-pod-displaySubTitle-']",
      "priceSelector": "[data-internet-price], [id^='testId-pod-price-']",
      "urlSelector": "a[href*='/product/'], a.pod-link",
      "imageSelector": "img"
    },
    "detail": {
      "css": {
        "title": "h1.product-name",
        "price": "span.copy10, [id^='testId-pdp-price-']"
      },
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
