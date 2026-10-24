// scraperlab-backend/scripts/seed-domains-ktronix-ml.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const DomainRepository = require('../src/repositories/DomainRepository');

async function seedDomains() {
  const configs = [
    path.resolve(__dirname, '../.logs/scraperConfig/domain-ktronix.com.json'),
    path.resolve(__dirname, '../.logs/scraperConfig/domain-mercadolibre.com.co.json')
  ];

  for (const file of configs) {
    if (!fs.existsSync(file)) {
      console.warn(`Archivo no encontrado: ${file}`);
      continue;
    }

    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`\nSincronizando ${config.domainId} hacia DynamoDB...`);

    try {
      await DomainRepository.upsert(config.domainId, config);
      console.log(`✅ Dominio ${config.domainId} guardado exitosamente con provider: ${config.providerId}`);
    } catch (err) {
      console.warn(`⚠️ No se pudo guardar ${config.domainId} en DynamoDB (¿faltan credenciales AWS locales?): ${err.message}`);
      console.log(`ℹ️ La configuración de respaldo en archivo JSON está lista y sincronizada.`);
    }
  }
}

if (require.main === module) {
  seedDomains()
    .then(() => console.log('\nProceso de seeding finalizado.'))
    .catch(console.error);
}

module.exports = seedDomains;
