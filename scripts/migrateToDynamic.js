/**
 * Script para migrar dominios existentes al nuevo sistema de extracción modular
 * Uso: node scripts/migrateToDynamic.js
 */
require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');

async function migrate() {
  const mercadolibreCOConfig = {
    useScripts: true,
    useJsonLd: true,
    useMeta: true,
    useCss: true,
    supportedTypes: ['detail', 'search', 'searchSpecific'],
    subdomains: ['listado'],
    providerId: 'scraperapi',
    providerConfig: {
      render: false,
      premium: true
    },
    scraperConfig: {
      detail: {
        css: {
          price: '.ui-pdp-price__second-line .andes-money-amount__fraction, .price-tag-fraction, [class*="price"] [class*="fraction"]',
          originalPrice: '.ui-pdp-price__original-value .andes-money-amount__fraction, .price-tag-line-through .andes-money-amount__fraction, [class*="original"] [class*="fraction"]',
          title: 'h1.ui-pdp-title'
        },
        // MercadoLibre usa scripts específicos para precio actual/original
        scripts: [
          { key: 'currentPrice', regex: '"price":\\s*(\\d+(?:\\.\\d+)?)' },
          { key: 'currentPrice', regex: '(?<!"original_)"value":\\s*(\\d+(?:\\.\\d+)?)' },
          { key: 'originalPrice', regex: '"original_(?:price|value)":\\s*(\\d+(?:\\.\\d+)?)' }
        ]
      },
      search: {
        containerSelector: '.ui-search-layout__item',
        titleSelector: '.poly-component__title',
        priceSelector: '.poly-price__current .andes-money-amount__fraction',
        urlSelector: 'a.poly-component__title',
        imageSelector: '.poly-component__picture',
        scripts: []
      },
      searchSpecific: {
        css: {
          price: '.ui-search-layout__item:first-child .poly-price__current .andes-money-amount__fraction',
          originalPrice: '.ui-search-layout__item:first-child .andes-money-amount--stack .andes-money-amount--previous .andes-money-amount__fraction',
          title: '.ui-search-layout__item:first-child .poly-component__title',
          image: '.ui-search-layout__item:first-child .poly-component__picture'
        },
        scripts: []
      }
    }
  };

  const migrations = [
    {
      domainId: 'mercadolibre.com.co',
      updates: mercadolibreCOConfig
    },
    {
      domainId: 'exito.com',
      updates: {
        useJsonLd: true,
        useMeta: true
      }
    },
    {
      domainId: 'falabella.com.co',
      updates: {
        useNextData: true,
        useMeta: true
      }
    }
  ];

  console.log('Iniciando migración de dominios...');

  for (const m of migrations) {
    try {
      console.log(`Migrando ${m.domainId}...`);
      let current = {};
      try {
        current = await DomainConfigService.getConfig(m.domainId);
      } catch (e) {
        console.log(`Config no existe para ${m.domainId}, creándola...`);
      }
      const updated = { ...current, ...m.updates };
      await DomainConfigService.createOrUpdateConfig(m.domainId, updated);
      console.log(`✓ ${m.domainId} migrado exitosamente.`);
    } catch (error) {
      console.error(`✗ Error migrando ${m.domainId}: ${error.stack}`);
    }
  }

  console.log('Migración finalizada.');

  try {
    console.log('Limpiando dominios obsoletos...');
    await DomainConfigService.deleteConfig('listado.mercadolibre.com.co');
    console.log('✓ listado.mercadolibre.com.co eliminado.');
  } catch (e) {
    // Ignorar si no existe
  }
}

migrate().catch(console.error);
