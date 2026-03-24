/**
 * Script para crear la tabla ScraperLab-Pipelines en DynamoDB (SDK v3)
 * 
 * Uso:
 *   node scripts/createPipelinesTable.js
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
  // Credenciales fake para local
  clientConfig.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
} else {
  console.log(`🌍 Usando configuración de AWS (${clientConfig.region}) para stage: ${STAGE}`);
}

const client = new DynamoDBClient(clientConfig);

const PIPELINES_TABLE = process.env.PIPELINES_TABLE_NAME || 'ScraperLab-Pipelines';

async function createPipelinesTable() {
  console.log(`\n🚀 Creando tabla ${PIPELINES_TABLE}...\n`);

  const params = {
    TableName: PIPELINES_TABLE,
    KeySchema: [
      { AttributeName: 'pipelineId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'pipelineId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    await client.send(new CreateTableCommand(params));
    console.log('✅ Tabla creada exitosamente!');
    console.log(`   Nombre: ${PIPELINES_TABLE}`);
    console.log('   Partition Key: pipelineId (String)');
    console.log('   Billing Mode: PAY_PER_REQUEST\n');

    // Esperar a que la tabla esté activa
    console.log('⏳ Esperando a que la tabla esté activa...');
    await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: PIPELINES_TABLE });
    console.log('✅ Tabla activa y lista para usar!\n');

  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  La tabla ${PIPELINES_TABLE} ya existe.\n`);
    } else {
      console.error('❌ Error al crear la tabla:', error);
      throw error;
    }
  }
}

async function describeTable() {
  try {
    const result = await client.send(new DescribeTableCommand({ TableName: PIPELINES_TABLE }));
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

async function deleteTable() {
  console.log(`\n⚠️  Eliminando tabla ${PIPELINES_TABLE}...\n`);

  try {
    await client.send(new DeleteTableCommand({ TableName: PIPELINES_TABLE }));
    console.log('✅ Tabla eliminada exitosamente!\n');
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`⚠️  La tabla ${PIPELINES_TABLE} no existe.\n`);
    } else {
      console.error('❌ Error al eliminar la tabla:', error);
      throw error;
    }
  }
}

// Main
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'describe':
      await describeTable();
      break;
    case 'delete':
      console.log('⚠️  ADVERTENCIA: Esta acción eliminará la tabla y TODOS sus datos');
      console.log('Para confirmar, ejecuta: node scripts/createPipelinesTable.js delete-confirmed');
      break;
    case 'delete-confirmed':
      await deleteTable();
      break;
    case 'create':
    default:
      await createPipelinesTable();
      await describeTable();
      break;
  }
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
