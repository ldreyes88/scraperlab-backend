require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');

async function fixMercadoLibre() {
  const domainId = 'mercadolibre.com.co';
  console.log(`Corrigiendo configuración para ${domainId}...`);
  
  try {
    const config = await DomainConfigService.getConfig(domainId);
    
    // Forzar limpieza de render en todos los niveles
    const newProviderConfig = {
      ...(config.providerConfig || {}),
      render: false,
      premium: true,
      country_code: 'co'
    };

    // Si existen overrides por tipo, asegurar que NO tengan render: true
    ['detail', 'search', 'searchSpecific'].forEach(type => {
      if (newProviderConfig[type]) {
        newProviderConfig[type].render = false;
        newProviderConfig[type].premium = true;
        newProviderConfig[type].country_code = 'co';
      }
    });

    const updates = {
      ...config,
      providerConfig: newProviderConfig,
      useScripts: true,
      useCss: true,
      useMeta: true,
      useJsonLd: true
    };

    await DomainConfigService.createOrUpdateConfig(domainId, updates);
    console.log('✓ Configuración actualizada con éxito.');
    
    // Verificar resultado
    const final = await DomainConfigService.getConfig(domainId);
    console.log('Configuración final:', JSON.stringify(final.providerConfig, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixMercadoLibre();
