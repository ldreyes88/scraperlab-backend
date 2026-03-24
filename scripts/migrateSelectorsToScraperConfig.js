require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');

async function migrateData() {
  console.log('--- Iniciando Migración Global: selectors -> scraperConfig ---');
  try {
    const allConfigs = await DomainConfigService.getAllConfigs();
    console.log(`Encontrados ${allConfigs.length} dominios para procesar.`);

    for (const config of allConfigs) {
      console.log(`Migrando ${config.domainId}...`);
      
      // La lógica en DomainConfigService.createOrUpdateConfig ya maneja:
      // 1. Mover 'selectors' a 'scraperConfig'
      // 2. Mover 'scriptPatterns' (raíz) a 'scraperConfig.detail.scripts'
      // 3. Eliminar campos antiguos
      
      await DomainConfigService.createOrUpdateConfig(config.domainId, config);
      console.log(`✓ ${config.domainId} actualizado exitosamente.`);
    }
    
    console.log('--- Migración finalizada con éxito ---');
  } catch (error) {
    console.error('Error durante la migración:', error);
  }
  process.exit(0);
}

migrateData();
