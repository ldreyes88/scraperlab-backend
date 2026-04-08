# Configuración de Dominio: alkosto.com

Información técnica y estrategias de extracción para el dominio **alkosto.com**.

## Especificaciones Generales
| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `alkosto.com` |
| **País** | `CO` |
| **Proveedor** | `scraperapi` |

## Estrategias por Tipo

### 1. Detalle de Producto (`detail`)
- **Estrategia Recomendada:** Mixta (`scripts` > `jsonLd` > `css`).
- **Scripts:** 
  - La información más confiable se encuentra en el objeto global `ACC.dataLayer.GAEcommerceData`.
  - Campos: `price` y `previousPrice`.
- **JSON-LD:**
  - `pricePath`: `offers.price`
  - `originalPricePath`: `offers.highPrice`
- **CSS Selectors:**
  - `title`: `.js-main-title`
  - `price`: `span.price, .alk-main-price`
  - `originalPrice`: `span.base-price, .before-price__basePrice`

## Notas
- Alkosto utiliza un data layer complejo. Si la extracción por scripts falla, es probable que la estructura de `ACC.dataLayer` haya cambiado.
- El precio original (`originalPrice`) solo aparece cuando hay un descuento activo.
