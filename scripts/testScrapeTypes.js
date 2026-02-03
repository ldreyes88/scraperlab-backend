/**
 * Script de prueba para validar los diferentes tipos de scraping
 * Prueba:
 * 1. Retrocompatibilidad (sin especificar scrapeType)
 * 2. Tipo 'detail' - Página de producto
 * 3. Tipo 'search' - Lista de productos
 * 4. Tipo 'searchSpecific' - Primer resultado de búsqueda
 * 5. Error handling - Tipo no soportado
 * 
 * Uso:
 *   node scripts/testScrapeTypes.js
 */

const StrategyFactory = require('../src/strategies/StrategyFactory');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  console.log('\n' + '='.repeat(80) + '\n');
}

async function testRetrocompatibilidad() {
  separator();
  log('TEST 1: Retrocompatibilidad - Scraping sin especificar tipo', 'blue');
  log('Debería usar "detail" por defecto', 'yellow');
  
  try {
    // Mock del provider para evitar requerir API key
    const mockProvider = {
      providerName: 'scraperapi',
      scrape: async () => ({ rawHtml: '<html></html>' })
    };
    
    // Reemplazar temporalmente getStrategy
    const originalGetStrategy = StrategyFactory.getStrategy;
    StrategyFactory.getStrategy = () => mockProvider;
    
    // Probar con MercadoLibre (estrategia existente)
    const strategy = StrategyFactory.getDomainStrategy('mercadolibre.com.co', 'scraperapi');
    log('✓ Estrategia obtenida correctamente (MercadoLibre)', 'green');
    log(`  Estrategia: ${strategy.constructor.name}`, 'magenta');
    
    // Probar con Exito
    const strategy2 = StrategyFactory.getDomainStrategy('exito.com', 'scraperapi');
    log('✓ Estrategia obtenida correctamente (Exito)', 'green');
    log(`  Estrategia: ${strategy2.constructor.name}`, 'magenta');
    
    // Restaurar getStrategy
    StrategyFactory.getStrategy = originalGetStrategy;
    
    return true;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testDetailType() {
  separator();
  log('TEST 2: Tipo "detail" - Página de producto', 'blue');
  
  try {
    // Mock del provider
    const mockProvider = {
      providerName: 'scraperapi',
      scrape: async () => ({ rawHtml: '<html></html>' })
    };
    
    const originalGetStrategy = StrategyFactory.getStrategy;
    StrategyFactory.getStrategy = () => mockProvider;
    
    // Probar con PequenoMundo
    const strategy = StrategyFactory.getDomainStrategy('pequenomundo.com', 'scraperapi', 'detail');
    log('✓ Estrategia obtenida correctamente', 'green');
    log(`  Estrategia: ${strategy.constructor.name}`, 'magenta');
    
    StrategyFactory.getStrategy = originalGetStrategy;
    
    if (strategy.constructor.name !== 'PequenoMundoDetailStrategy') {
      throw new Error(`Estrategia incorrecta: esperado PequenoMundoDetailStrategy, recibido ${strategy.constructor.name}`);
    }
    
    return true;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testSearchType() {
  separator();
  log('TEST 3: Tipo "search" - Lista de productos', 'blue');
  
  try {
    const mockProvider = {
      providerName: 'scraperapi',
      scrape: async () => ({ rawHtml: '<html></html>' })
    };
    
    const originalGetStrategy = StrategyFactory.getStrategy;
    StrategyFactory.getStrategy = () => mockProvider;
    
    const strategy = StrategyFactory.getDomainStrategy('pequenomundo.com', 'scraperapi', 'search');
    log('✓ Estrategia obtenida correctamente', 'green');
    log(`  Estrategia: ${strategy.constructor.name}`, 'magenta');
    
    StrategyFactory.getStrategy = originalGetStrategy;
    
    if (strategy.constructor.name !== 'PequenoMundoSearchStrategy') {
      throw new Error(`Estrategia incorrecta: esperado PequenoMundoSearchStrategy, recibido ${strategy.constructor.name}`);
    }
    
    return true;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testSearchSpecificType() {
  separator();
  log('TEST 4: Tipo "searchSpecific" - Primer resultado', 'blue');
  
  try {
    const mockProvider = {
      providerName: 'scraperapi',
      scrape: async () => ({ rawHtml: '<html></html>' })
    };
    
    const originalGetStrategy = StrategyFactory.getStrategy;
    StrategyFactory.getStrategy = () => mockProvider;
    
    const strategy = StrategyFactory.getDomainStrategy('pequenomundo.com', 'scraperapi', 'searchSpecific');
    log('✓ Estrategia obtenida correctamente', 'green');
    log(`  Estrategia: ${strategy.constructor.name}`, 'magenta');
    
    StrategyFactory.getStrategy = originalGetStrategy;
    
    if (strategy.constructor.name !== 'PequenoMundoSearchSpecificStrategy') {
      throw new Error(`Estrategia incorrecta: esperado PequenoMundoSearchSpecificStrategy, recibido ${strategy.constructor.name}`);
    }
    
    return true;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testUnsupportedType() {
  separator();
  log('TEST 5: Error handling - Tipo no soportado', 'blue');
  log('Debería lanzar error descriptivo', 'yellow');
  
  try {
    const mockProvider = {
      providerName: 'scraperapi',
      scrape: async () => ({ rawHtml: '<html></html>' })
    };
    
    const originalGetStrategy = StrategyFactory.getStrategy;
    StrategyFactory.getStrategy = () => mockProvider;
    
    // Intentar usar tipo no soportado en MercadoLibre
    StrategyFactory.getDomainStrategy('mercadolibre.com.co', 'scraperapi', 'search');
    
    StrategyFactory.getStrategy = originalGetStrategy;
    log('✗ No se lanzó error (esto es un problema)', 'red');
    return false;
  } catch (error) {
    if (error.message.includes('no soporta el tipo de scraping')) {
      log('✓ Error descriptivo lanzado correctamente', 'green');
      log(`  Mensaje: ${error.message}`, 'yellow');
      return true;
    } else {
      log(`✗ Error inesperado: ${error.message}`, 'red');
      return false;
    }
  }
}

async function testUnsupportedDomain() {
  separator();
  log('TEST 6: Error handling - Dominio no soportado', 'blue');
  
  try {
    StrategyFactory.getDomainStrategy('dominio-inexistente.com', 'scraperapi', 'detail');
    log('✗ No se lanzó error (esto es un problema)', 'red');
    return false;
  } catch (error) {
    if (error.message.includes('Dominio no soportado')) {
      log('✓ Error descriptivo lanzado correctamente', 'green');
      log(`  Mensaje: ${error.message}`, 'yellow');
      return true;
    } else {
      log(`✗ Error inesperado: ${error.message}`, 'red');
      return false;
    }
  }
}

async function testSupportedDomains() {
  separator();
  log('TEST 7: Verificar dominios soportados', 'blue');
  
  try {
    const domains = StrategyFactory.getSupportedDomains();
    log('✓ Lista de dominios obtenida', 'green');
    log(`  Dominios: ${domains.join(', ')}`, 'magenta');
    
    // Verificar que pequeñomundo está en la lista (indirectamente via domainStrategiesByType)
    const hasPequenomundo = Object.keys(StrategyFactory.domainStrategiesByType).includes('pequenomundo.com');
    if (hasPequenomundo) {
      log('✓ pequenomundo.com está registrado en domainStrategiesByType', 'green');
    } else {
      log('✗ pequenomundo.com NO está registrado', 'red');
      return false;
    }
    
    return true;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', 'blue');
  log('║  TEST SUITE: Sistema de Tipos de Scraping                    ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════════╝', 'blue');
  
  const results = [];
  
  results.push({ name: 'Retrocompatibilidad', passed: await testRetrocompatibilidad() });
  results.push({ name: 'Tipo Detail', passed: await testDetailType() });
  results.push({ name: 'Tipo Search', passed: await testSearchType() });
  results.push({ name: 'Tipo SearchSpecific', passed: await testSearchSpecificType() });
  results.push({ name: 'Tipo No Soportado', passed: await testUnsupportedType() });
  results.push({ name: 'Dominio No Soportado', passed: await testUnsupportedDomain() });
  results.push({ name: 'Dominios Soportados', passed: await testSupportedDomains() });
  
  // Resumen
  separator();
  log('RESUMEN DE PRUEBAS', 'blue');
  separator();
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  });
  
  separator();
  
  if (passed === total) {
    log(`✓ TODAS LAS PRUEBAS PASARON (${passed}/${total})`, 'green');
    log('\nLa refactorización se completó exitosamente! 🎉', 'green');
  } else {
    log(`✗ ALGUNAS PRUEBAS FALLARON (${passed}/${total})`, 'red');
    log('\nRevisa los errores anteriores.', 'yellow');
  }
  
  separator();
  
  return passed === total;
}

// Ejecutar pruebas
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`\nError fatal: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
