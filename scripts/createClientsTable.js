/**
 * Script para crear la tabla ScraperLab-Clients en DynamoDB
 * 
 * Uso:
 *   node scripts/createClientsTable.js
 */

require('dotenv').config();
const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1'
});

const CLIENTS_TABLE = process.env.CLIENTS_TABLE_NAME || 'ScraperLab-Clients';

async function createClientsTable() {
  console.log(`\n🚀 Creando tabla ${CLIENTS_TABLE}...\n`);

  const params = {
    TableName: CLIENTS_TABLE,
    KeySchema: [
      { AttributeName: 'clientId', KeyType: 'HASH' } // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'clientId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST', // On-demand pricing
    Tags: [
      {
        Key: 'Environment',
        Value: process.env.STAGE || 'prod'
      },
      {
        Key: 'Project',
        Value: 'ScraperLab'
      },
      {
        Key: 'Purpose',
        Value: 'Client Management'
      }
    ]
  };

  try {
    await dynamoDB.createTable(params).promise();
    console.log('✅ Tabla creada exitosamente!');
    console.log(`   Nombre: ${CLIENTS_TABLE}`);
    console.log('   Partition Key: clientId (String)');
    console.log('   Billing Mode: PAY_PER_REQUEST\n');

    // Esperar a que la tabla esté activa
    console.log('⏳ Esperando a que la tabla esté activa...');
    await dynamoDB.waitFor('tableExists', { TableName: CLIENTS_TABLE }).promise();
    console.log('✅ Tabla activa y lista para usar!\n');

  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log(`⚠️  La tabla ${CLIENTS_TABLE} ya existe.\n`);
    } else {
      console.error('❌ Error al crear la tabla:', error);
      throw error;
    }
  }
}

async function describeTable() {
  try {
    const result = await dynamoDB.describeTable({ TableName: CLIENTS_TABLE }).promise();
    console.log('\n📋 Información de la tabla:\n');
    console.log(`   Nombre: ${result.Table.TableName}`);
    console.log(`   Estado: ${result.Table.TableStatus}`);
    console.log(`   Items: ${result.Table.ItemCount}`);
    console.log(`   Tamaño: ${(result.Table.TableSizeBytes / 1024).toFixed(2)} KB`);
    console.log(`   Creada: ${new Date(result.Table.CreationDateTime).toLocaleString('es')}`);
    console.log('');
  } catch (error) {
    console.error('Error al describir la tabla:', error);
  }
}

async function deleteTable() {
  console.log(`\n⚠️  Eliminando tabla ${CLIENTS_TABLE}...\n`);

  try {
    await dynamoDB.deleteTable({ TableName: CLIENTS_TABLE }).promise();
    console.log('✅ Tabla eliminada exitosamente!\n');
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      console.log(`⚠️  La tabla ${CLIENTS_TABLE} no existe.\n`);
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
      console.log('Para confirmar, ejecuta: node scripts/createClientsTable.js delete-confirmed');
      break;
    case 'delete-confirmed':
      await deleteTable();
      break;
    case 'create':
    default:
      await createClientsTable();
      await describeTable();
      break;
  }
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
