require('dotenv').config();
const DomainRepository = require('../src/repositories/DomainRepository');

async function listAllDomains() {
  try {
    const domains = await DomainRepository.getAll();
    console.log(`Total dominios: ${domains.length}`);
    domains.forEach(d => {
      console.log(`- ${d.domainId}: ${d.status_service || 'active'} (Error: ${d.last_scrape_error || 'Ninguno'})`);
    });
  } catch (error) {
    console.error(error);
  }
}

listAllDomains();
