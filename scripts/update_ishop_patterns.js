require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');

async function updateIshop() {
  const domainId = 'co.tiendasishop.com';
  console.log(`Actualizando patrones para ${domainId}...`);

  try {
    const config = await DomainConfigService.getConfig(domainId);
    
    // 1. Habilitar scripts
    config.useScripts = true;
    
    // 2. Agregar patrones de regex
    config.scriptPatterns = [
      { key: 'currentPrice', regex: '"sellingPrice":\\s*(\\d+(?:\\.\\d+)?)' },
      { key: 'originalPrice', regex: '"basePrice":\\s*(\\d+(?:\\.\\d+)?)' },
      { key: 'title', regex: '"product_name":\\s*"([^"]+)"' }
    ];

    // 3. Priorizar scripts en el orden
    config.strategyOrder = ['scripts', 'jsonLd', 'css', 'meta', 'nextData'];

    await DomainConfigService.createOrUpdateConfig(domainId, config);
    console.log('✓ Configuración actualizada exitosamente');

    // También actualizar ishop.com.co por si acaso
    console.log('Sincronizando con ishop.com.co...');
    const config2 = { ...config, domainId: 'ishop.com.co' };
    await DomainConfigService.createOrUpdateConfig('ishop.com.co', config2);
    console.log('✓ Sincronización completa');

  } catch (error) {
    console.error('Error:', error);
  }
}

updateIshop();
