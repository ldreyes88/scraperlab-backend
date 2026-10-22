/**
 * Script para crear la tabla ScraperLab-Nodes en DynamoDB (SDK v3)
 * 
 * Uso:
 *   node scripts/createTableNodesTable.js
 */

require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand, DeleteTableCommand, waitUntilTableExists } = require('@aws-sdk/client-dynamodb');

// Determinar si estamos en modo local o remoto
const STAGE = process.env.STAGE || 'dev';
const isLocal = STAGE === 'dev';

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (isLocal) {
  clientConfig.endpoint = 'http://localhost:8000';
  console.log('💎 Usando configuración de DynamoDB Local (http://localhost:8000)');
  clientConfig.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
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
    console.log(`   Nombre: ${NODES_TABLE}`);
    console.log('   Partition Key: nodeId (String)');
    console.log('   Billing Mode: PAY_PER_REQUEST\n');

    console.log('⏳ Esperando a que la tabla esté activa...');
    await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: NODES_TABLE });
    console.log('✅ Tabla activa y lista para usar!\n');

  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  La tabla ${NODES_TABLE} ya existe.\n`);
    } else {
      console.error('❌ Error al crear la tabla:', error);
      throw error;
    }
  }
}

async function describeTable() {
  try {
    const result = await client.send(new DescribeTableCommand({ TableName: NODES_TABLE }));
    console.log('\n📋 Información de la tabla:\n');
    console.log(`   Nombre: ${result.Table.TableName}`);
    console.log(`   Estado: ${result.Table.TableStatus}`);
    console.log(`   Items: ${result.Table.ItemCount || 0}`);
    console.log(`   Creada: ${new Date(result.Table.CreationDateTime).toLocaleString('es')}`);
    console.log('');
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      console.error('Error al describir la tabla:', error);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDelete = args.includes('--delete');

  try {
    if (isDelete) {
      console.log(`\n⚠️  Eliminando tabla ${NODES_TABLE}...`);
      await client.send(new DeleteTableCommand({ TableName: NODES_TABLE }));
      console.log('✅ Tabla eliminada.\n');
      return;
    }

    await createNodesTable();
    await describeTable();

  } catch (error) {
    console.error('\n❌ Falló la operación:', error.message);
    process.exit(1);
  }
}

main();
