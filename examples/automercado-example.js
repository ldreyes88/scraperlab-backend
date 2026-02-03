/**
 * Ejemplo de uso de la estrategia AutoMercado
 * 
 * Este ejemplo muestra cómo:
 * 1. Sanitizar una línea de factura
 * 2. Construir URL de búsqueda
 * 3. Hacer scraping con validación
 */

const AutoMercadoInputSanitizer = require('../src/utils/AutoMercadoInputSanitizer');
const ScraperService = require('../src/services/ScraperService');

async function ejemploAutoMercado() {
  console.log('🛒 Ejemplo de Scraping para AutoMercado Costa Rica\n');
  
  // ========================================
  // PASO 1: Sanitizar línea de factura
  // ========================================
  console.log('📄 PASO 1: Sanitizar línea de factura');
  console.log('=====================================\n');
  
  const receiptLine = "SALCHICHA SUST BEY 400 g  10.950,00 G";
  console.log(`Input original: "${receiptLine}"\n`);
  
  const sanitized = AutoMercadoInputSanitizer.sanitize(receiptLine);
  console.log('Datos extraídos:');
  console.log(`  • Término de búsqueda: "${sanitized.searchTerm}"`);
  console.log(`  • Gramaje: ${sanitized.weight} (${sanitized.weightValue} ${sanitized.unit})`);
  console.log(`  • Precio: ₡${sanitized.price.toLocaleString()}\n`);
  
  // Validar
  const validation = AutoMercadoInputSanitizer.validate(sanitized);
  if (validation.valid) {
    console.log('✅ Datos válidos para búsqueda\n');
  } else {
    console.error('❌ Datos inválidos:', validation.errors);
    return;
  }
  
  // ========================================
  // PASO 2: Construir URL de búsqueda
  // ========================================
  console.log('🔗 PASO 2: Construir URL de búsqueda');
  console.log('====================================\n');
  
  const searchUrl = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
  console.log(`URL generada:\n${searchUrl}\n`);
  
  // ========================================
  // PASO 3: Hacer scraping
  // ========================================
  console.log('🔍 PASO 3: Hacer scraping con validación');
  console.log('=========================================\n');
  
  try {
    const result = await ScraperService.scrapeUrl(searchUrl, {
      type: 'searchSpecific'  // Usar estrategia searchSpecific
    });
    
    if (result.success) {
      console.log('✅ Scraping exitoso!\n');
      
      console.log('📦 PRODUCTO ENCONTRADO:');
      console.log(`  Título: ${result.product.title}`);
      console.log(`  Precio: ₡${result.prices.current.toLocaleString()}`);
      console.log(`  URL: ${result.product.url}\n`);
      
      console.log('📊 VALIDACIÓN:');
      const val = result.metadata.validation;
      console.log(`  Score Total: ${val.scoreTotal}/100 (${val.confidence})`);
      console.log(`  • Similitud texto: ${val.textScore}/35 ${val.textScore >= 30 ? '✓' : '⚠️'}`);
      console.log(`  • Match gramaje: ${val.weightScore}/35 ${val.weightMatch ? '✓' : '✗'}`);
      console.log(`  • Match precio: ${val.priceScore}/30 ${val.priceMatch ? '✓' : '✗'}\n`);
      
      if (val.confidence === 'ALTA') {
        console.log('🎯 El match es de ALTA confianza - Producto correcto');
      } else if (val.confidence === 'MEDIA') {
        console.log('⚠️  El match es de confianza MEDIA - Revisar manualmente');
      } else {
        console.log('❌ El match es de BAJA confianza - Probablemente incorrecto');
      }
      
    } else {
      console.error('❌ Scraping falló:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error durante scraping:', error.message);
  }
}

// ========================================
// Ejemplo con múltiples productos
// ========================================
async function ejemploMultiplesProductos() {
  console.log('\n\n🛒 Ejemplo con múltiples productos de factura\n');
  console.log('==============================================\n');
  
  const receipts = [
    "SALCHICHA SUST BEY 400 g  10.950,00 G",
    "GAS SAZUC C.COLA 2500 ml  1.560,00 G",
    "LAV CRE LIM AXIO 600 g  1.135,00 G",
    "ENER MONSTRUM 473 ml  1.595,00 G",
    "MANTEQ BARRA DP 115 g  1.845,00 G"
  ];
  
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    console.log(`${i + 1}. "${receipt}"`);
    
    const sanitized = AutoMercadoInputSanitizer.sanitize(receipt);
    console.log(`   → Búsqueda: "${sanitized.searchTerm}" (${sanitized.weight}, ₡${sanitized.price})`);
    
    const searchUrl = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
    console.log(`   → URL: ${searchUrl}\n`);
  }
  
  console.log('💡 Para hacer scraping de todos, usa Promise.all() o procesa uno por uno\n');
}

// ========================================
// Ejecutar ejemplos
// ========================================
if (require.main === module) {
  // Solo ejecutar ejemplo simple (sin scraping real)
  console.log('🛒 Ejemplo de Sanitización AutoMercado\n');
  console.log('=====================================\n');
  
  const receiptLine = "SALCHICHA SUST BEY 400 g  10.950,00 G";
  console.log(`Input: "${receiptLine}"\n`);
  
  const sanitized = AutoMercadoInputSanitizer.sanitize(receiptLine);
  console.log('Output:', JSON.stringify(sanitized, null, 2), '\n');
  
  const searchUrl = AutoMercadoInputSanitizer.buildSearchUrl(sanitized);
  console.log(`URL de búsqueda:\n${searchUrl}\n`);
  
  console.log('Para hacer scraping real, usa:');
  console.log('  const result = await ScraperService.scrapeUrl(searchUrl, { type: "searchSpecific" });\n');
  
  // Ejemplo múltiples
  ejemploMultiplesProductos().catch(console.error);
}

module.exports = {
  ejemploAutoMercado,
  ejemploMultiplesProductos
};
