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
  PROCESS: process.env.PROCESS_TABLE_NAME
};

module.exports = { dynamoDB, TABLES };