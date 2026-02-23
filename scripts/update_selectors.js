require('dotenv').config({ path: '../../.env' });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const DOMAIN_TO_UPDATE = 'ktronix.com';
const TABLE_NAME = process.env.DOMAINS_TABLE_NAME || 'ScraperLab-Domains';

const newSelectors = {
  detail: {
    titleSelector: "h1",
    priceSelector: "#js-original_price",
    originalPriceSelector: "span.before-price__basePrice",
    availabilitySelector: "#addToCartButton",
    imageSelector: ".owl-item.active img.owl-lazy"
  },
  search: {
    containerSelector: "li.product__item",
    titleSelector: ".product__item__top__title",
    priceSelector: ".product__price--discounts__price",
    urlSelector: "a.product__item__top__link",
    imageSelector: "img"
  }
};

const newProviderConfig = {
  // Configuración global minimalista (usa los defaults de ScraperAPI)
  device_type: 'desktop',
  
  // Overrides específicos por tipo
  search: {
    render: true,     // Ktronix requiere render para Algolia en búsquedas
    wait: 2000
  },
  detail: {
    // Para detalle NO necesitamos render, así que no lo ponemos para que ScraperAPI use su default (false)
    // Esto evita procesos lentos y errores 504.
  }
};

async function updateSelectors() {
  console.log(`🚀 Iniciando actualización para: ${DOMAIN_TO_UPDATE}...`);
  
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { domainId: DOMAIN_TO_UPDATE },
      UpdateExpression: 'SET selectors = :s, providerConfig = :p, updatedAt = :u',
      ExpressionAttributeValues: {
        ':s': newSelectors,
        ':p': newProviderConfig,
        ':u': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const data = await ddbDocClient.send(new UpdateCommand(params));
    console.log('✅ Base de datos actualizada con éxito!');
    console.log('Nuevos selectores:', JSON.stringify(data.Attributes.selectors, null, 2));
    
  } catch (err) {
    console.error('❌ Error al actualizar DynamoDB:', err);
    if (err.name === 'ResourceNotFoundException') {
      console.error('La tabla no existe o el Stage está mal configurado.');
    }
  }
}

updateSelectors();
