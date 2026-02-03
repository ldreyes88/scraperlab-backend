# Implementación Estrategia AutoMercado Costa Rica

## ✅ Archivos Creados

### 1. **Sanitizador de Inputs**
📁 `src/utils/AutoMercadoInputSanitizer.js`
- Extrae término de búsqueda, gramaje y precio de líneas de factura
- Maneja múltiples formatos de precios
- Soporta unidades: g, kg, ml, l, unid

### 2. **Estrategia de Scraping**
📁 `src/strategies/domain/automercado.cr/AutoMercadoSearchSpecificStrategy.js`
- Busca productos en AutoMercado
- Valida primer resultado con scoring multi-criterio
- Sistema de puntuación sobre 100 puntos:
  - Similitud de texto: 35 pts
  - Match de gramaje: 35 pts
  - Match de precio: 30 pts

### 3. **Tests Unitarios**
📁 `src/utils/AutoMercadoInputSanitizer.test.js`
- 15 tests de sanitización
- Todos pasan ✅

### 4. **Documentación**
📁 `src/strategies/domain/automercado.cr/README.md`
- Guía completa de uso
- Ejemplos de facturas soportadas
- Diccionario de abreviaciones
- Sistema de scoring explicado

### 5. **Ejemplos de Uso**
📁 `examples/automercado-example.js`
- Ejemplo básico de sanitización
- Ejemplo con múltiples productos

### 6. **Registro en StrategyFactory**
📝 `src/strategies/StrategyFactory.js` (actualizado)
- AutoMercado registrado como dominio soportado
- Tipo: `searchSpecific`

---

## ⚠️ Nota Importante sobre Parámetros URL

Los parámetros `weight` y `price` en la URL son **solo para validación interna**. AutoMercado NO acepta estos parámetros en su búsqueda real. La estrategia:
1. Extrae `q`, `weight` y `price` de la URL de entrada
2. Construye una URL de búsqueda limpia usando **solo** `q`
3. Usa `weight` y `price` internamente para validar el primer resultado

---

## 🚀 Cómo Usar

### Opción 1: Desde el código

```javascript
const AutoMercadoInputSanitizer = require('./src/utils/AutoMercadoInputSanitizer');
const ScraperService = require('./src/services/ScraperService');

// 1. Sanitizar factura
const receiptLine = "SALCHICHA SUST BEY 400 g  10.950,00 G";
const sanitized = AutoMercadoInputSanitizer.sanitize(receiptLine);

// 2. Construir URL
const searchUrl = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);

// 3. Hacer scraping
const result = await ScraperService.scrapeUrl(searchUrl, { 
  type: 'searchSpecific' 
});

// 4. Ver resultado
console.log('Producto:', result.product.title);
console.log('Score:', result.metadata.validation.scoreTotal);
console.log('Confianza:', result.metadata.validation.confidence);
```

### Opción 2: Vía API

```bash
# Endpoint de scraping
POST /api/scrape

# Body
{
  "url": "https://automercado.cr/buscar?q=SALCHICHA+SUST+BEY&weight=400+g&price=10950",
  "type": "searchSpecific"
}
```

---

## 📊 Sistema de Scoring

| Score | Confianza | Acción Recomendada |
|-------|-----------|-------------------|
| 80-100 | ALTA | ✅ Usar producto directamente |
| 60-79 | MEDIA | ⚠️ Revisar manualmente |
| 0-59 | BAJA | ❌ Buscar alternativas |

---

## 🧪 Testing

```bash
# Ejecutar tests del sanitizador
node src/utils/AutoMercadoInputSanitizer.test.js

# Ejecutar ejemplo
node examples/automercado-example.js
```

---

## 📝 Ejemplos de Facturas Soportadas

Todas estas líneas se parsean correctamente:

```
✅ SALCHICHA SUST BEY 400 g  10.950,00 G
✅ GAS SAZUC C.COLA 2500 ml  1.560,00 G
✅ LAV CRE LIM AXIO 600 g  1.135,00 G
✅ ENER MONSTRUM 473 ml  1.595,00 G
✅ MANTEQ BARRA DP 115 g  1.845,00 G
✅ AGUA NAT CRISTAL 1000 ml  995,00 G
✅ TE LIMON + FUZE 5000 ml  230,00 G
✅ TORTA BEYO 907 g  24.665,00 G
```

---

## 🔧 Configuración Técnica

### Provider Config
```javascript
{
  render: true,           // AutoMercado es SPA Angular
  device_type: 'desktop',
  country_code: 'cr',    // Costa Rica
  wait: 2000             // Esperar carga de contenido dinámico
}
```

### Selectores CSS
```javascript
'.card-product'                     // Contenedor de producto
'.title-product'                    // Título
'.text-currency.h5-am'             // Precio
'.text-subtitle.med-gray-text'     // Gramaje/presentación
```

---

## 📋 Abreviaciones Expandidas

El sanitizador expande automáticamente:

| Factura | Expandido |
|---------|-----------|
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

---

## 🎯 Tolerancias de Matching

### Gramaje
- ✅ Exacto: 35 puntos
- ✅ ±10%: 30-35 puntos
- ⚠️ ±20%: 0-20 puntos
- ❌ >20%: 0 puntos

### Precio
- ✅ Exacto: 30 puntos
- ✅ ±5%: 25-30 puntos
- ⚠️ ±10%: 15-25 puntos
- ❌ >10%: 0 puntos

### Texto
- Basado en coincidencia de palabras
- Considera abreviaciones expandidas
- Permite similitud de palabras (Levenshtein)

---

## 🔍 Logs de Debug

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

---

## 🚨 Consideraciones

1. **Solo valida el primer resultado** - No busca en toda la página
2. **Requiere render: true** - AutoMercado es una SPA
3. **Country: cr** - Importante para proxies en Costa Rica
4. **Precios pueden variar** - Tolerancia de ±5% por promociones
5. **Abreviaciones customizables** - Se pueden agregar más al diccionario

---

## 📦 Dependencias

- `cheerio` - Parsing de HTML
- `BaseDomainStrategy` - Clase base para estrategias

---

## 🔮 Mejoras Futuras

- [ ] Soporte para búsqueda de múltiples resultados (no solo el primero)
- [ ] Machine learning para mejorar matching de abreviaciones
- [ ] Cache de búsquedas recientes
- [ ] Soporte para sinónimos de productos
- [ ] Integración con OCR para escanear facturas físicas

---

## 📞 Soporte

Para problemas o mejoras, ver:
- `src/strategies/domain/automercado.cr/README.md` - Documentación detallada
- `examples/automercado-example.js` - Ejemplos de uso
- `src/utils/AutoMercadoInputSanitizer.test.js` - Tests

---

**Implementado:** 2 de Febrero, 2026  
**Autor:** Luis D. Reyes  
**Versión:** 1.0.0
