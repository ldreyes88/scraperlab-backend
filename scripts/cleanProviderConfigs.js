/**
 * Script para limpiar providerConfigs de dominios existentes
 * Remueve valores por defecto antiguos que ahora son opcionales
 */

require('dotenv').config();
const DomainRepository = require('../src/repositories/DomainRepository');

const cleanProviderConfig = (providerConfig) => {
  if (!providerConfig || typeof providerConfig !== 'object') {
    return {};
  }

  const cleaned = {};

  // Solo incluir campos que tengan valores significativos (no defaults vacíos)
  Object.entries(providerConfig).forEach(([key, value]) => {
    // Ignorar valores vacíos o defaults que no deberían estar
    if (value === '' || value === null || value === undefined) {
      return; // No incluir
    }

    // Casos especiales: valores que son defaults antiguos no deseados
    if (key === 'country_code' && (value === '' || value === 'us')) {
      return; // No incluir country_code vacío o 'us' (era el default)
    }

    if (key === 'device_type' && value === 'desktop') {
      return; // No incluir device_type 'desktop' (era el default)
    }

    if (key === 'render' && value === true) {
      return; // No incluir render:true (era el default)
    }

    if (key === 'premium' && value === false) {
      return; // No incluir premium:false (era el default)
    }

    if (key === 'keep_headers' && value === false) {
      return; // No incluir keep_headers:false (default)
    }

    if (key === 'wait' && value === 0) {
      return; // No incluir wait:0 (default)
    }

    // Si llegó aquí, es un valor significativo que debe mantenerse
    cleaned[key] = value;
  });

  return cleaned;
};

const main = async () => {
  try {
    console.log('🔍 Obteniendo todos los dominios...');
    const domains = await DomainRepository.getAll();
    console.log(`✅ Se encontraron ${domains.length} dominios\n`);

    let updated = 0;
    let unchanged = 0;

    for (const domain of domains) {
      const originalConfig = domain.providerConfig || {};
      const cleanedConfig = cleanProviderConfig(originalConfig);

      const originalKeys = Object.keys(originalConfig);
      const cleanedKeys = Object.keys(cleanedConfig);

      if (originalKeys.length !== cleanedKeys.length || 
          JSON.stringify(originalConfig) !== JSON.stringify(cleanedConfig)) {
        
        console.log(`\n📝 Actualizando: ${domain.domainId}`);
        console.log('   Antes:', JSON.stringify(originalConfig, null, 2));
        console.log('   Después:', JSON.stringify(cleanedConfig, null, 2));

        // Actualizar el dominio con la config limpia
        await DomainRepository.upsert(domain.domainId, {
          ...domain,
          providerConfig: cleanedConfig
        });

        updated++;
      } else {
        console.log(`✓ ${domain.domainId} - Ya está limpio`);
        unchanged++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Migración completada`);
    console.log(`   - Actualizados: ${updated}`);
    console.log(`   - Sin cambios: ${unchanged}`);
    console.log(`   - Total: ${domains.length}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
};

// Ejecutar
main().then(() => {
  console.log('\n✨ Script completado exitosamente');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Error fatal:', error);
  process.exit(1);
});
