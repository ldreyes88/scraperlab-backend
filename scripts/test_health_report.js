require('dotenv').config();
const ProcessService = require('../src/services/ProcessService');

async function testReport() {
  try {
    console.log('--- Generando Health Report ---');
    const report = await ProcessService.getHealthReport();
    console.log('Resumen:', JSON.stringify(report.summary, null, 2));
    
    console.log('\n--- Dominios con Errores o Fallas Recientes ---');
    report.domains.filter(d => d.status === 'failed' || d.stats.failedRecent > 0).forEach(d => {
      console.log(`- ${d.domainId}: [${d.status.toUpperCase()}]`);
      console.log(`  Error: ${d.lastError} (${d.lastErrorType})`);
      console.log(`  Procesos Recientes: ${d.stats.totalRecent} totales, ${d.stats.failedRecent} fallidos (${d.stats.successRate}% éxito)`);
      console.log(`  Categorías Error: API: ${d.errorsByCategory.api}, Scraping: ${d.errorsByCategory.scraping}, Extracción: ${d.errorsByCategory.extraction}`);
      console.log('---');
    });
  } catch (error) {
    console.error(error);
  }
}

testReport();
