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
- **Comportamiento:** El título inicial puede contener un placeholder de SSR ("resto.vpp-frontend"). La información real se encuentra en el JSON-LD o se carga vía JS.
- **Estrategia Recomendada:** Mixta (`jsonLd` > `scripts` > `css`).
- **Selectores:**
  - `title`: `h1.ui-pdp-title` (Priorizar JSON-LD `name`)
  - `price`: `.ui-pdp-price__second-line .andes-money-amount__fraction`
  - `originalPrice`: `.ui-pdp-price__original-value .andes-money-amount__fraction`

## Pipeline de Extracción
Para evitar placeholders, se ha configurado el siguiente `strategyOrder`:
1. `jsonLd`: Obtiene título y precio actual de forma limpia.
2. `scripts`: Busca `original_value` en los estados internos de la página.
3. `css`: Selectores de respaldo para precios y galerías.

## Notas
- MercadoLibre es muy sensible a los proxies. Se recomienda siempre usar `"premium": true`.
