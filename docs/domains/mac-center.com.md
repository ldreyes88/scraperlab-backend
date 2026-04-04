# Configuración de Dominio: mac-center.com

Información técnica y estrategias de extracción para el dominio **mac-center.com**.

## Especificaciones Generales
| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `mac-center.com` |
| **País** | `CO` |
| **Proveedor** | `scraperapi` |
| **Tecnología** | Shopify |

## Estrategias por Tipo

### 1. Búsqueda (`search`)
- **Comportamiento:** Shopify Search.
- **Selectores:** Actualmente no configurado (se hereda comportamiento estándar de Shopify).

### 2. Detalle de Producto (`detail`)
- **Comportamiento:** La información del producto está disponible en scripts globales (`window.meta`).
- **Estrategia Recomendada:** `scripts` con divisor.
- **Optimización:** Requiere `"render": true` para asegurar que los scripts de Shopify se ejecuten y las variantes de precio sean visibles en el DOM.
- **Selectores:**
  - `scripts.currentPrice`: Regex `"price":\s*(\d+)` con `divisor: 100`.
  - `scripts.originalPrice`: Regex `"compare_at_price":\s*(\d+)` con `divisor: 100`.
  - `scripts.title`: Regex `"product_name":\s*"([^"]+)"`.

## Ejemplo de Configuración en Base de Datos

```json
{
  "domainId": "mac-center.com",
  "useJsonLd": true,
  "useCss": true,
  "useScripts": true,
  "strategyOrder": ["scripts", "jsonLd", "css"],
  "scraperConfig": {
    "detail": {
      "scripts": [
        {
          "key": "currentPrice",
          "regex": "\"price\":\\s*(\\d+)(?:\\.\\d+)?",
          "divisor": 100
        },
        {
          "key": "originalPrice",
          "regex": "\"compare_at_price\":\\s*(\\d+)(?:\\.\\d+)?",
          "divisor": 100
        }
      ]
    }
  },
  "providerConfig": {
    "detail": {
      "render": true,
      "device_type": "desktop"
    }
  }
}
```
