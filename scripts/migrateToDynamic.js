/**
 * Script para migrar dominios existentes al nuevo sistema de extracción modular
 * Uso: node scripts/migrateToDynamic.js
 */
require('dotenv').config();
const DomainConfigService = require('../src/services/DomainConfigService');

async function migrate() {
  const migrations = [
    {
      domainId: 'mercadolibre.com.co',
      updates: {
        useScripts: true,
        useJsonLd: true,
        useMeta: true,
        useCss: true,
        providerConfig: {
          render: false,
          premium: true
        },
        // MercadoLibre usa scripts específicos para precio actual/original
        scriptPatterns: [
          { key: 'currentPrice', regex: '"price":\\s*(\\d+(?:\\.\\d+)?)' },
          { key: 'currentPrice', regex: '(?<!"original_)"value":\\s*(\\d+(?:\\.\\d+)?)' },
          { key: 'originalPrice', regex: '"original_(?:price|value)":\\s*(\\d+(?:\\.\\d+)?)' }
        ],
        selectors: {
          detail: {
            css: {
              price: '.ui-pdp-price__second-line .andes-money-amount__fraction, .price-tag-fraction, [class*="price"] [class*="fraction"]',
              originalPrice: '.ui-pdp-price__original-value .andes-money-amount__fraction, .price-tag-line-through .andes-money-amount__fraction, [class*="original"] [class*="fraction"]',
              title: 'h1.ui-pdp-title'
            }
          }
        }
      }
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
      const current = await DomainConfigService.getConfig(m.domainId);
      const updated = { ...current, ...m.updates };
      await DomainConfigService.createOrUpdateConfig(m.domainId, updated);
      console.log(`✓ ${m.domainId} migrado exitosamente.`);
    } catch (error) {
      console.error(`✗ Error migrando ${m.domainId}: ${error.message}`);
    }
  }

  console.log('Migración finalizada.');
}

migrate().catch(console.error);
