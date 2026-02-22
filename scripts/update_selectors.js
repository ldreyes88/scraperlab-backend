require('dotenv').config({ path: '../../.env' });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const DOMAIN_TO_UPDATE = 'ktronix.com';
const TABLE_NAME = process.env.DOMAINS_TABLE_NAME || 'ScraperLab-Domains';

const newSelectors = {
  titleSelector: "h1",
  priceSelector: "#js-original_price",
  originalPriceSelector: "span.before-price__basePrice",
  availabilitySelector: "#addToCartButton",
  imageSelector: ".owl-item.active img.owl-lazy"
};

async function updateSelectors() {
  console.log(`🚀 Iniciando actualización para: ${DOMAIN_TO_UPDATE}...`);
  
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { domainId: DOMAIN_TO_UPDATE },
      UpdateExpression: 'SET selectors = :s, updatedAt = :u',
      ExpressionAttributeValues: {
        ':s': newSelectors,
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
