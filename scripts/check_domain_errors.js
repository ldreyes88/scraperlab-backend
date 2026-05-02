require('dotenv').config();
const DomainRepository = require('../src/repositories/DomainRepository');

async function checkErrors() {
  try {
    console.log('--- Buscando dominios con errores de scraping ---\n');
    const domains = await DomainRepository.getAll();
    
    const domainsWithErrors = domains.filter(d => 
      d.status_service === 'failed' || (d.last_scrape_error && d.last_scrape_error !== null)
    );

    if (domainsWithErrors.length === 0) {
      console.log('✅ No se encontraron dominios con errores actualmente.');
    } else {
      console.log(`❌ Se encontraron ${domainsWithErrors.length} dominios con errores:`);
      console.log('---------------------------------------------------------');
      
      domainsWithErrors.forEach(d => {
        console.log(`Dominio: ${d.domainId}`);
        console.log(`Estado:  ${d.status_service}`);
        console.log(`Error:   ${d.last_scrape_error}`);
        console.log(`Actualizado: ${d.updatedAt}`);
        console.log('---------------------------------------------------------');
      });
    }
  } catch (error) {
    console.error('Error al consultar dominios:', error);
  }
}

checkErrors();
