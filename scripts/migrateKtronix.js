require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');

async function migrate() {
  const domainId = 'ktronix.com';
  
  const updates = {
    useScripts: true,
    useJsonLd: true,
    useMeta: true,
    useCss: true,
    strategyOrder: ['scripts', 'css', 'jsonLd', 'meta', 'nextData'],
    // Ktronix usa GAProductData con estos patrones (con o sin espacios y comillas)
    scriptPatterns: [
      { key: 'currentPrice', regex: 'price\\s*:\\s*["\'](\\d+)["\']' },
      { key: 'originalPrice', regex: '[Pp]reviousPrice\\s*:\\s*["\'](\\d+)["\']' },
      { key: 'title', regex: 'name\\s*:\\s*["\']([^"\']+)["\']' }
    ]
  };

  try {
    console.log(`Migrando ${domainId}...`);
    // Intentar obtener config actual (si no existe, DomainConfigService usa default)
    let current;
    try {
      current = await DomainConfigService.getConfig(domainId);
    } catch (e) {
      console.log(`Configuración no encontrada para ${domainId}, usando valores por defecto.`);
      current = { domainId, providerId: 'scraperapi', enabled: true };
    }

    const updated = { ...current, ...updates };
    await DomainConfigService.createOrUpdateConfig(domainId, updated);
    console.log(`✓ ${domainId} migrado exitosamente con patrones de script.`);
  } catch (error) {
    console.error(`✗ Error migrando ${domainId}: ${error.message}`);
  }
}

migrate().catch(console.error);
