const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const DomainConfigService = require('../src/services/DomainConfigService');

async function importConfig() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('Uso: node scripts/importConfigFromLog.js <ruta_al_archivo.json>');
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
    const config = JSON.parse(rawData);
    
    const domainId = config.domainId;
    if (!domainId) {
      throw new Error('El archivo JSON no contiene un domainId válido.');
    }

    console.log(`Importando configuración para el dominio: ${domainId}...`);
    
    const result = await DomainConfigService.createOrUpdateConfig(domainId, config);
    
    console.log(`\n✓ Configuración IMPORTADA exitosamente para: ${domainId}`);
    console.log(`Actualizado en: ${result.updatedAt}`);
    
  } catch (error) {
    console.error('\n❌ Error al importar la configuración:');
    console.error(error.message);
    process.exit(1);
  }
}

importConfig();
