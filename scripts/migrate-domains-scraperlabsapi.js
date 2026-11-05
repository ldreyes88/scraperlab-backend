// scraperlab-backend/scripts/migrate-domains-scraperlabsapi.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const DomainRepository = require('../src/repositories/DomainRepository');

async function migrateDomainsToScraperLabsApi() {
  const configs = [
    path.resolve(__dirname, '../docs/domains/mac-center.com.scraperlabs.com.co.json'),
    path.resolve(__dirname, '../docs/domains/co.tiendasishop.com.scraperlabs.com.co.json'),
    path.resolve(__dirname, '../docs/domains/tienda.movistar.com.co.scraperlabs.com.co.json')
  ];

  console.log('=== MIGRACIÓN DE DOMINIOS A SCRAPERLABSAPI ===\n');

  for (const file of configs) {
    if (!fs.existsSync(file)) {
      console.warn(`⚠️ Archivo no encontrado: ${file}`);
      continue;
    }

    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`Sincronizando ${config.domainId} (${config.providerId})...`);

    try {
      await DomainRepository.upsert(config.domainId, config);
      console.log(`✅ Dominio ${config.domainId} guardado exitosamente en DynamoDB.`);
    } catch (err) {
      console.warn(`⚠️ No se pudo guardar ${config.domainId} en DynamoDB (¿faltan credenciales AWS locales?): ${err.message}`);
      console.log(`ℹ️ La configuración de respaldo en archivo JSON está lista y validada: ${file}`);
    }
  }
}

if (require.main === module) {
  migrateDomainsToScraperLabsApi()
    .then(() => console.log('\nProceso de migración finalizado.'))
    .catch(console.error);
}

module.exports = migrateDomainsToScraperLabsApi;
