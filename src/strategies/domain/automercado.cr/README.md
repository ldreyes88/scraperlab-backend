# Estrategia AutoMercado Costa Rica

Estrategia de scraping para AutoMercado (automercado.cr) con validación inteligente de productos basada en datos de facturas.

## Características

- ✅ **Sanitización de inputs**: Extrae término de búsqueda, gramaje y precio de líneas de factura
- ✅ **Validación multi-criterio**: Score basado en similitud de texto, gramaje y precio
- ✅ **Manejo de abreviaciones**: Expande abreviaturas comunes de facturas de AutoMercado
- ✅ **Scoring transparente**: Devuelve confianza del match (ALTA/MEDIA/BAJA)

## ⚠️ Nota Importante sobre Parámetros

Los parámetros `weight` y `price` en la URL son **solo para validación interna**. La estrategia:
1. Extrae estos parámetros de la URL de entrada
2. Construye una URL de búsqueda limpia usando **solo** el parámetro `q`
3. Usa `weight` y `price` internamente para validar el primer resultado

**Ejemplo**:
- URL de entrada: `https://automercado.cr/buscar?q=SALCHICHA&weight=400+g&price=10950`
- URL real de scraping: `https://automercado.cr/buscar?q=SALCHICHA`
- `weight` y `price` se usan para calcular el score de validación

## Uso

### 1. Desde una línea de factura

```javascript
const AutoMercadoInputSanitizer = require('../utils/AutoMercadoInputSanitizer');

// Input: línea de factura completa
const receiptLine = "SALCHICHA SUST BEY 400 g  10.950,00 G";

// Sanitizar
const sanitized = AutoMercadoInputSanitizer.sanitize(receiptLine);
// {
//   searchTerm: "SALCHICHA SUST BEY",
//   weight: "400 g",
//   weightValue: 400,
//   unit: "g",
//   price: 10950,
//   original: "SALCHICHA SUST BEY 400 g  10.950,00 G"
// }

// Validar (opcional)
const validation = AutoMercadoInputSanitizer.validate(sanitized);
// { valid: true, errors: [] }

// Construir URL de búsqueda
const searchUrl = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
// "https://automercado.cr/buscar?q=SALCHICHA+SUST+BEY&weight=400+g&price=10950"
```

### 2. Hacer scraping

```javascript
const ScraperService = require('../services/ScraperService');

// Opción A: URL manual
const result = await ScraperService.scrapeUrl(
  'https://automercado.cr/buscar?q=SALCHICHA+SUST+BEY&weight=400+g&price=10950',
  { type: 'searchSpecific' }
);

// Opción B: Usando el sanitizador
const searchUrl = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
const result = await ScraperService.scrapeUrl(searchUrl, { type: 'searchSpecific' });
```

### 3. Respuesta con score

```javascript
{
  success: true,
  scrapeType: 'searchSpecific',
  marketplace: 'AutoMercado',
  product: {
    title: "Salchicha Proteina Guisante Italiana Beyond Meat Bandeja 400 G",
    image: "https://ik.imagekit.io/autoenlinea/imgjpg/...",
    url: "https://automercado.cr/p/salchicha-proteina.../id/..."
  },
  prices: {
    current: 10950,
    original: 10950,
    discount_percentage: 0,
    currency: "CRC"
  },
  metadata: {
    method: "First-Result-Validation (Score: 95)",
    timestamp: "2026-02-02T...",
    searchUrl: "https://automercado.cr/buscar?...",
    validation: {
      scoreTotal: 95,          // Score total sobre 100
      textScore: 32,           // Similitud de texto (35 max)
      weightScore: 35,         // Match de gramaje (35 max)
      weightMatch: true,       // ✓ Gramaje coincide
      priceScore: 28,          // Match de precio (30 max)
      priceMatch: true,        // ✓ Precio coincide
      confidence: "ALTA"       // ALTA | MEDIA | BAJA
    },
    searchCriteria: {
      searchTerm: "SALCHICHA SUST BEY",
      expectedWeight: "400 g",
      expectedPrice: "10950"
    }
  }
}
```

## Sistema de Scoring

| Criterio | Puntos Máximos | Condición para máximo |
|----------|----------------|----------------------|
| **Similitud de texto** | 35 | 100% de palabras coinciden (con expansión de abreviaturas) |
| **Match de gramaje** | 35 | Gramaje exacto (tolerancia ±10%) |
| **Match de precio** | 30 | Precio exacto (tolerancia ±5%) |
| **TOTAL** | **100** | |

### Niveles de Confianza

- **80-100 (ALTA)**: ✅ Match muy confiable
- **60-79 (MEDIA)**: ⚠️ Match aceptable, revisar manualmente
- **0-59 (BAJA)**: ❌ Match no confiable, producto probablemente incorrecto

## Ejemplos de Facturas Soportadas

```javascript
// Salchichas
"SALCHICHA SUST BEY 400 g  10.950,00 G"
// → searchTerm: "SALCHICHA SUST BEY", weight: "400 g", price: 10950

// Gaseosas
"GAS SAZUC C.COLA 2500 ml  1.560,00 G"
// → searchTerm: "GAS SAZUC C.COLA", weight: "2500 ml", price: 1560

// Productos de limpieza
"LAV CRE LIM AXIO 600 g  1.135,00 G"
// → searchTerm: "LAV CRE LIM AXIO", weight: "600 g", price: 1135

// Energizantes
"ENER MONSTRUM 473 ml  1.595,00 G"
// → searchTerm: "ENER MONSTRUM", weight: "473 ml", price: 1595

// Mantequilla
"MANTEQ BARRA DP 115 g  1.845,00 G"
// → searchTerm: "MANTEQ BARRA DP", weight: "115 g", price: 1845
```

## Abreviaciones Soportadas

El sanitizador expande automáticamente estas abreviaciones comunes:

| Abreviación | Expansión |
|-------------|-----------|
| SUST | sustentable |
| BEY | beyond |
| SAZUC | sazón |
| C.COLA | coca cola |
| LAV | lavador |
| CRE | cremoso |
| LIM | limón |
| AXIO | axion |
| ENER | energizante |
| MONSTRUM | monster |
| MANTEQ | mantequilla |
| DP | dos pinos |
| GAS | gaseosa |
| NAT | natural |

## Ajustar Tolerancias

Si necesitas ajustar las tolerancias de matching, edita el archivo:
`src/strategies/domain/automercado.cr/AutoMercadoSearchSpecificStrategy.js`

**Gramaje (línea ~265):**
```javascript
// Tolerancia actual: ±10%
if (percentDiff <= 0.10) { ... }

// Para hacer más estricto:
if (percentDiff <= 0.05) { ... }  // ±5%
```

**Precio (línea ~310):**
```javascript
// Tolerancia actual: ±5%
if (percentDiff <= 0.05) { ... }

// Para hacer más flexible:
if (percentDiff <= 0.10) { ... }  // ±10%
```

## Logs de Debug

La estrategia imprime logs detallados:

```
[AutoMercado] Iniciando búsqueda:
  Término: "SALCHICHA SUST BEY"
  Peso esperado: 400 g
  Precio esperado: ₡10950

[AutoMercado] Primer resultado encontrado:
  Título: Salchicha Proteina Guisante Italiana Beyond Meat Bandeja 400 G
  Precio: ₡10950
  Peso: bandeja 400 g

[AutoMercado] Validación completada:
  Score Total: 95/100 (ALTA)
  - Similitud texto: 32/35
  - Match gramaje: ✓ (35/35)
  - Match precio: ✓ (28/30)
```

## Requisitos Técnicos

- **Render**: `true` (AutoMercado es una SPA Angular)
- **Country**: `cr` (Costa Rica)
- **Wait**: 2000ms (para que cargue el contenido dinámico)
- **Provider**: ScraperAPI o Oxylabs

## Notas

- Solo valida el **primer resultado** de búsqueda
- Requiere que la URL incluya parámetros `q`, `weight` y `price`
- Si el score es < 60, se considera match no confiable
- Los precios pueden variar por promociones (tolerancia ±5%)
