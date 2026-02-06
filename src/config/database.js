const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.STAGE === 'dev' && {
    endpoint: 'http://localhost:8000'
  })
});

const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false
  }
});

const TABLES = {
  PROVIDERS: process.env.PROVIDERS_TABLE_NAME,
  DOMAINS: process.env.DOMAINS_TABLE_NAME,
  PROCESS: process.env.PROCESS_TABLE_NAME,
  PROCESS_DETAIL: process.env.PROCESS_DETAIL_TABLE_NAME,
  CLIENTS: process.env.CLIENTS_TABLE_NAME || 'ScraperLab-Clients'
};

module.exports = { dynamoDB, TABLES };