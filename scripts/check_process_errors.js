require('dotenv').config();
const ProcessRepository = require('../src/repositories/ProcessRepository');
const ProcessDetailRepository = require('../src/repositories/ProcessDetailRepository');

async function checkRecentProcesses() {
  try {
    console.log('--- Buscando procesos recientes con errores ---\n');
    const recentProcesses = await ProcessRepository.getRecent(10);
    
    for (const process of recentProcesses) {
      if (process.failedCount > 0 || process.success === false) {
        console.log(`Proceso ID: ${process.processId}`);
        console.log(`Tipo:       ${process.processType}`);
        console.log(`Estado:     ${process.status || (process.success ? 'success' : 'failed')}`);
        console.log(`Fallas:     ${process.failedCount || 0}`);
        console.log(`Timestamp:  ${process.timestamp}`);
        
        if (process.processType === 'batch') {
          const details = await ProcessDetailRepository.getByProcessId(process.processId);
          const failedDetails = details.filter(d => d.success === false);
          
          if (failedDetails.length > 0) {
            console.log('URLs con error:');
            failedDetails.forEach(d => {
              console.log(` - URL: ${d.url}`);
              console.log(`   Error: ${d.error || 'Desconocido'}`);
            });
          }
        } else if (process.url) {
          console.log(`URL: ${process.url}`);
          console.log(`Error: ${process.error || 'Desconocido'}`);
        }
        console.log('---------------------------------------------------------');
      }
    }
  } catch (error) {
    console.error('Error al consultar procesos:', error);
  }
}

checkRecentProcesses();
