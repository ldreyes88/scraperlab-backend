/**
 * Script para crear las tablas del ecosistema de Bots en DynamoDB:
 * - ScraperLab-Bots
 * - ScraperLab-BotKnowledge
 * - ScraperLab-ChatSessions
 * 
 * Uso:
 *   node scripts/createTableBotTables.js
 */

require('dotenv').config();
const { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand, 
  waitUntilTableExists 
} = require('@aws-sdk/client-dynamodb');

const STAGE = process.env.STAGE || 'dev';
const isLocal = STAGE === 'dev';

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (isLocal) {
  clientConfig.endpoint = 'http://localhost:8000';
  console.log('Usando configuración de DynamoDB Local (http://localhost:8000)');
  clientConfig.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
} else {
  console.log(`Usando configuración de AWS (${clientConfig.region}) para stage: ${STAGE}`);
}

const client = new DynamoDBClient(clientConfig);

const TABLES_TO_CREATE = [
  {
    name: process.env.BOTS_TABLE_NAME || 'ScraperLab-Bots',
    params: {
      TableName: process.env.BOTS_TABLE_NAME || 'ScraperLab-Bots',
      KeySchema: [
        { AttributeName: 'botId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'botId', AttributeType: 'S' },
        { AttributeName: 'clientId', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'clientId-index',
          KeySchema: [
            { AttributeName: 'clientId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }
  },
  {
    name: process.env.BOT_KNOWLEDGE_TABLE_NAME || 'ScraperLab-BotKnowledge',
    params: {
      TableName: process.env.BOT_KNOWLEDGE_TABLE_NAME || 'ScraperLab-BotKnowledge',
      KeySchema: [
        { AttributeName: 'knowledgeId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'knowledgeId', AttributeType: 'S' },
        { AttributeName: 'botId', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'botId-index',
          KeySchema: [
            { AttributeName: 'botId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }
  },
  {
    name: process.env.CHAT_SESSIONS_TABLE_NAME || 'ScraperLab-ChatSessions',
    params: {
      TableName: process.env.CHAT_SESSIONS_TABLE_NAME || 'ScraperLab-ChatSessions',
      KeySchema: [
        { AttributeName: 'sessionId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'sessionId', AttributeType: 'S' },
        { AttributeName: 'botId', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'botId-index',
          KeySchema: [
            { AttributeName: 'botId', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }
  }
];

async function createTable(tableConfig) {
  const { name, params } = tableConfig;
  console.log(`\nCreando tabla ${name}...`);

  try {
    await client.send(new CreateTableCommand(params));
    console.log(`Tabla ${name} creada exitosamente!`);

    if (!isLocal) {
      console.log(`Esperando a que la tabla ${name} este activa...`);
      await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: name });
      console.log(`Tabla ${name} activa y lista para usar!`);
    }
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`La tabla ${name} ya existe.`);
    } else {
      console.error(`Error al crear la tabla ${name}:`, error);
      throw error;
    }
  }
}

async function run() {
  console.log('========================================================');
  console.log('Iniciando creación de tablas para Ecosistema de Bots');
  console.log('========================================================');

  for (const table of TABLES_TO_CREATE) {
    await createTable(table);
  }

  console.log('\nTodas las tablas de Bots verificadas y listas.');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fallo la creación de tablas:', err);
    process.exit(1);
  });
}

module.exports = { run, TABLES_TO_CREATE };
