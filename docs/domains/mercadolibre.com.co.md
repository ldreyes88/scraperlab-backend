# Configuración de Dominio: mercadolibre.com.co

Información técnica y estrategias de extracción para el dominio **mercadolibre.com.co**.

## Especificaciones Generales
| Campo | Valor |
| :--- | :--- |
| **ID Dominio** | `mercadolibre.com.co` |
| **País** | `CO` |
| **Proveedor** | `scraperapi` |

## Estrategias por Tipo

### 1. Búsqueda (`search`)
- **Comportamiento:** Los resultados están presentes en el HTML pero a veces requieren renderizado para cargar componentes variables (Poly cards).
- **Estrategia:** `css`.
- **Selectores:**
  - `containerSelector`: `.ui-search-layout__item, .poly-card`
  - `priceSelector`: `.poly-price__current .andes-money-amount__fraction`

### 2. Detalle de Producto (`detail`)
- **Estrategia Recomendada:** Mixta (`css` + `jsonLd`).
- **Selectores:**
  - `title`: `h1.ui-pdp-title`
  - `price`: `.ui-pdp-price__current-price .andes-money-amount__fraction`

## Notas
- MercadoLibre es muy sensible a los proxies. Se recomienda siempre usar `"premium": true`.
