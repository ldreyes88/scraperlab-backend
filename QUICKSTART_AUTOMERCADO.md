# 🚀 Quick Start - AutoMercado Strategy

## ⚡ Uso Inmediato

### 1. Sanitizar una línea de factura

```javascript
const AutoMercadoInputSanitizer = require('./src/utils/AutoMercadoInputSanitizer');

const factura = "SALCHICHA SUST BEY 400 g  10.950,00 G";
const sanitized = AutoMercadoInputSanitizer.sanitize(factura);

console.log(sanitized);
// {
//   searchTerm: "SALCHICHA SUST BEY",
//   weight: "400 g",
//   weightValue: 400,
//   unit: "g",
//   price: 10950
// }
```

### 2. Crear URL de búsqueda

```javascript
const url = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
// "https://automercado.cr/buscar?q=SALCHICHA+SUST+BEY&weight=400+g&price=10950"
```

### 3. Hacer scraping con validación

```javascript
const ScraperService = require('./src/services/ScraperService');

const result = await ScraperService.scrapeUrl(url, { 
  type: 'searchSpecific' 
});

// Resultado con score de validación
console.log(result.product.title);              // "Salchicha Proteina..."
console.log(result.prices.current);             // 10950
console.log(result.metadata.validation.scoreTotal);    // 95
console.log(result.metadata.validation.confidence);    // "ALTA"
```

## 📊 Interpretar el Score

```javascript
const val = result.metadata.validation;

// Score total
if (val.scoreTotal >= 80) {
  console.log('✅ Match de ALTA confianza - Usar directamente');
} else if (val.scoreTotal >= 60) {
  console.log('⚠️  Match de confianza MEDIA - Revisar manualmente');
} else {
  console.log('❌ Match de BAJA confianza - Producto incorrecto');
}

// Detalles
console.log(`Similitud texto: ${val.textScore}/35 ${val.textScore >= 30 ? '✓' : '✗'}`);
console.log(`Match gramaje: ${val.weightScore}/35 ${val.weightMatch ? '✓' : '✗'}`);
console.log(`Match precio: ${val.priceScore}/30 ${val.priceMatch ? '✓' : '✗'}`);
```

## 📋 Ejemplos de Facturas

```javascript
// Todas estas líneas funcionan:
"SALCHICHA SUST BEY 400 g  10.950,00 G"
"GAS SAZUC C.COLA 2500 ml  1.560,00 G"
"LAV CRE LIM AXIO 600 g  1.135,00 G"
"ENER MONSTRUM 473 ml  1.595,00 G"
"MANTEQ BARRA DP 115 g  1.845,00 G"
"AGUA NAT CRISTAL 1000 ml  995,00 G"
```

## 🧪 Test Rápido

```bash
# Ejecutar tests unitarios
node src/utils/AutoMercadoInputSanitizer.test.js

# Probar con ejemplos
node test-automercado-quick.js

# Ver ejemplo completo
node examples/automercado-example.js
```

## 🔑 API Endpoint (si usas API REST)

```bash
POST /api/scrape
Content-Type: application/json

{
  "url": "https://automercado.cr/buscar?q=SALCHICHA+SUST+BEY&weight=400+g&price=10950",
  "type": "searchSpecific"
}
```

## 💡 Tips Rápidos

### Procesar múltiples facturas

```javascript
const facturas = [
  "SALCHICHA SUST BEY 400 g  10.950,00 G",
  "GAS SAZUC C.COLA 2500 ml  1.560,00 G"
];

// Opción 1: Secuencial
for (const factura of facturas) {
  const sanitized = AutoMercadoInputSanitizer.sanitize(factura);
  const url = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
  const result = await ScraperService.scrapeUrl(url, { type: 'searchSpecific' });
  console.log(result);
}

// Opción 2: Paralelo (más rápido, pero más consumo de API)
const promises = facturas.map(async (factura) => {
  const sanitized = AutoMercadoInputSanitizer.sanitize(factura);
  const url = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
  return ScraperService.scrapeUrl(url, { type: 'searchSpecific' });
});

const results = await Promise.all(promises);
```

### Validar antes de hacer scraping

```javascript
const sanitized = AutoMercadoInputSanitizer.sanitize(factura);
const validation = AutoMercadoInputSanitizer.validate(sanitized);

if (!validation.valid) {
  console.error('Factura inválida:', validation.errors);
  return;
}

// Continuar con scraping...
```

### Agregar más abreviaciones

Edita `src/strategies/domain/automercado.cr/AutoMercadoSearchSpecificStrategy.js` línea ~170:

```javascript
const abbreviations = {
  'sust': 'sustentable',
  'bey': 'beyond',
  // Agregar nuevas aquí:
  'nueva': 'expansion',
  // ...
};
```

## 📚 Documentación Completa

- **Implementación**: `AUTOMERCADO_IMPLEMENTATION.md`
- **README**: `src/strategies/domain/automercado.cr/README.md`
- **Ejemplos**: `examples/automercado-example.js`

## 🐛 Troubleshooting

### "No se encontraron resultados"
- Verifica que el término de búsqueda sea correcto
- Prueba en automercado.cr manualmente primero
- Verifica que el producto exista en el catálogo

### Score bajo (< 60)
- El producto del primer resultado no coincide con la búsqueda
- Ajusta los términos de búsqueda manualmente
- Revisa abreviaciones en el diccionario

### Error de red
- Verifica API keys (SCRAPER_API_KEY)
- Verifica provider configurado (scraperapi/oxylabs)
- Revisa límites de rate limiting

## ⚙️ Configuración de Dominio (opcional)

Si necesitas configurar AutoMercado en la base de datos:

```javascript
const DomainConfigService = require('./src/services/DomainConfigService');

await DomainConfigService.createOrUpdateConfig('automercado.cr', {
  providerId: 'scraperapi',
  providerConfig: {
    render: true,
    device_type: 'desktop',
    country_code: 'cr',
    wait: 2000
  },
  supportedTypes: ['searchSpecific'],
  enabled: true
});
```

## 📞 Soporte

Revisa los logs en consola para debug:
```
[AutoMercado] Iniciando búsqueda...
[AutoMercado] Primer resultado encontrado...
[AutoMercado] Validación completada: Score 95/100 (ALTA)
```

---

**¡Listo para usar!** 🎉

Si tienes dudas, revisa la documentación completa o los ejemplos.
