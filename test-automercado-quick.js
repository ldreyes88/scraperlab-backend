/**
 * Test Rápido de la Estrategia AutoMercado
 * Ejecutar: node test-automercado-quick.js
 */

const AutoMercadoInputSanitizer = require('./src/utils/AutoMercadoInputSanitizer');

console.log('\n🧪 TEST RÁPIDO - Estrategia AutoMercado\n');
console.log('═'.repeat(60));

// Ejemplos de facturas reales
const facturas = [
  "SALCHICHA SUST BEY 400 g  10.950,00 G",
  "GAS SAZUC C.COLA 2500 ml  1.560,00 G",
  "LAV CRE LIM AXIO 600 g  1.135,00 G",
  "TE LIMON + FUZE 5000 ml  230,00 G",
  "TORTA BEYO 907 g  24.665,00 G",
  "AGUA NAT CRISTAL 1000 ml  995,00 G",
  "ENER MONSTRUM 473 ml  1.595,00 G",
  "MANTEQ BARRA DP 115 g  1.845,00 G",
  "JAMON TOF 156 g 4.740,00 G"
];

console.log('\n📋 PROCESANDO FACTURAS:\n');

facturas.forEach((factura, index) => {
  console.log(`${index + 1}. Input:`);
  console.log(`   "${factura}"\n`);
  
  // Sanitizar
  const sanitized = AutoMercadoInputSanitizer.sanitize(factura);
  
  // Validar
  const validation = AutoMercadoInputSanitizer.validate(sanitized);
  
  console.log(`   Resultado:`);
  console.log(`   ├─ Término:  "${sanitized.searchTerm}"`);
  console.log(`   ├─ Gramaje:  ${sanitized.weight}`);
  console.log(`   ├─ Precio:   ₡${sanitized.price.toLocaleString()}`);
  console.log(`   └─ Válido:   ${validation.valid ? '✅' : '❌'}`);
  
  if (validation.valid) {
    const url = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
    console.log(`\n   📎 URL generada:`);
    console.log(`   ${url}`);
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');
});

console.log('✅ Test completado!\n');
console.log('💡 Para hacer scraping real, usa:');
console.log('   const result = await ScraperService.scrapeUrl(url, { type: "searchSpecific" });\n');
console.log('📚 Ver más ejemplos en: examples/automercado-example.js\n');
