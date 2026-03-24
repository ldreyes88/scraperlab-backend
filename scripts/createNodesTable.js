/**
 * Script para crear la tabla ScraperLab-Nodes (Librería de Nodos) en DynamoDB
 * 
 * Uso:
 *   node scripts/createNodesTable.js
 */

require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand, waitUntilTableExists } = require('@aws-sdk/client-dynamodb');

const STAGE = process.env.STAGE || 'dev';
const isLocal = STAGE === 'dev';

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (isLocal) {
  clientConfig.endpoint = 'http://localhost:8000';
  clientConfig.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
  console.log('💎 Usando configuración de DynamoDB Local (http://localhost:8000)');
} else {
  console.log(`🌍 Usando configuración de AWS (${clientConfig.region}) para stage: ${STAGE}`);
}

const client = new DynamoDBClient(clientConfig);

const NODES_TABLE = process.env.NODES_TABLE_NAME || 'ScraperLab-Nodes';

async function createNodesTable() {
  console.log(`\n🚀 Creando tabla ${NODES_TABLE}...\n`);

  const params = {
    TableName: NODES_TABLE,
    KeySchema: [
      { AttributeName: 'nodeId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'nodeId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    await client.send(new CreateTableCommand(params));
    console.log('✅ Tabla creada exitosamente!');
    
    console.log('⏳ Esperando a que la tabla esté activa...');
    await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: NODES_TABLE });
    console.log('✅ Tabla activa!\n');

  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  La tabla ${NODES_TABLE} ya existe.\n`);
    } else {
      console.error('❌ Error al crear la tabla:', error);
      throw error;
    }
  }
}

async function main() {
  await createNodesTable();
  const result = await client.send(new DescribeTableCommand({ TableName: NODES_TABLE }));
  console.log(`📋 Información: ${result.Table.TableName} (Items: ${result.Table.ItemCount || 0})`);
}

main().catch(console.error);
