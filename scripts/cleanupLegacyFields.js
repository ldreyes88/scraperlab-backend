require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');
const DomainRepository = require('../src/repositories/DomainRepository');

async function cleanup() {
  console.log('--- Iniciando Limpieza Definitiva de Campos Legacy ---');
  try {
    const allConfigs = await DomainConfigService.getAllConfigs();
    console.log(`Procesando ${allConfigs.length} dominios...`);

    for (const config of allConfigs) {
      console.log(`Limpiando ${config.domainId}...`);
      
      // Creamos una copia limpia sin los campos viejos para pasar a createOrUpdateConfig
      // Aunque createOrUpdateConfig ya crea un objeto nuevo, vamos a asegurarnos
      // de que extraemos la data de 'selectors' si 'scraperConfig' no existe.
      
      const configData = { ...config };
      
      // La lógica de createOrUpdateConfig ya hace la migración:
      // scraperConfig || configData.selectors || {}
      
      await DomainConfigService.createOrUpdateConfig(config.domainId, configData);
      
      // Verificación post-save (opcional pero recomendada en este script)
      const fresh = await DomainRepository.getByDomain(config.domainId);
      if (fresh.selectors) delete fresh.selectors;
      if (fresh.scriptPatterns) delete fresh.scriptPatterns;
      
      // Si por alguna razón los campos siguen ahí (lo cual sería brujería con PutCommand), 
      // forzamos un Put con el objeto filtrado
      const finalItem = { ...fresh };
      delete finalItem.selectors;
      delete finalItem.scriptPatterns;
      
      await DomainRepository.upsert(config.domainId, finalItem);
      
      console.log(`✓ ${config.domainId} limpio.`);
    }
    
    console.log('--- Limpieza Finalizada ---');
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

cleanup();
