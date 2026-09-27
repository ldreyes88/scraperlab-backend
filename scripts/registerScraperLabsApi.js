// scraperlab-backend/scripts/registerScraperLabsApi.js
require('dotenv').config();

const { dynamoDB, TABLES } = require('../src/config/database');
const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const ProviderRepository = require('../src/repositories/ProviderRepository');

async function updateProviders() {
  const providerData = {
    providerId: 'scraperlabsapi',
    name: 'ScraperLabsApi',
    description: 'Motor propio de scraping serverless y headless de ScraperLabs (@sparticuz/chromium + Puppeteer) corriendo en AWS Lambda. Costo $0 en proxies, soporte completo de JS, SPAs y cookies de sesión.',
    type: 'API',
    enabled: true,
    authType: 'none',
    baseUrl: '',
    pricing: {
      costPerRequest: 0.0001,
      currency: 'USD'
    },
    rateLimit: {
      requestsPerSecond: 5,
      concurrentRequests: 10
    },
    configSchema: {
      wait: {
        type: 'number',
        default: 1000,
        label: 'Espera en ms',
        description: 'Tiempo de espera en milisegundos tras la carga inicial (útil para SPAs y scripts dinámicos)',
        required: false
      },
      wait_for_selector: {
        type: 'string',
        label: 'Esperar Selector CSS',
        description: 'Selector CSS específico que debe aparecer en el DOM antes de extraer el contenido',
        required: false
      },
      block_images: {
        type: 'boolean',
        default: true,
        label: 'Bloquear Imágenes/Medios',
        description: 'Acelera drásticamente la carga y ahorra memoria al omitir la descarga de imágenes y fuentes',
        required: false
      },
      timeout: {
        type: 'number',
        default: 35000,
        label: 'Timeout de Navegación (ms)',
        description: 'Tiempo máximo de espera para la navegación de la página',
        required: false
      },
      viewport_width: {
        type: 'number',
        default: 1920,
        label: 'Ancho del Viewport (px)',
        required: false
      },
      viewport_height: {
        type: 'number',
        default: 1080,
        label: 'Alto del Viewport (px)',
        required: false
      }
    }
  };

  try {
    console.log('1. Registrando ScraperLabsApi en DynamoDB...');
    const result = await ProviderRepository.create(providerData);
    console.log('✅ Provider registrado exitosamente:', result.name, `(ID: ${result.providerId})`);

    console.log('2. Limpiando provider anterior lambda-chromium...');
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.PROVIDERS,
        Key: { providerId: 'lambda-chromium' }
      })
    );
    console.log('✅ Provider anterior eliminado de DynamoDB.');

    const all = await ProviderRepository.getAll();
    console.log('\nProviders actuales en DynamoDB:');
    all.forEach(p => console.log(` - ${p.name || p.providerId} [ID: ${p.providerId}]`));

  } catch (error) {
    console.error('❌ Error actualizando providers:', error.message);
  }
}

updateProviders();
