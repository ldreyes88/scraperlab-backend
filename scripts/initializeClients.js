/**
 * Script de inicialización para crear clientes en ScraperLab-Clients
 * 
 * Uso:
 *   node scripts/initializeClients.js
 */

require('dotenv').config();
const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const CLIENTS_TABLE = process.env.CLIENTS_TABLE_NAME || 'ScraperLab-Clients';

/**
 * Crear un cliente en la tabla
 */
async function createClient(clientData) {
  try {
    const params = {
      TableName: CLIENTS_TABLE,
      Item: clientData,
      ConditionExpression: 'attribute_not_exists(clientId)' // No sobrescribir si ya existe
    };

    await dynamoDB.put(params).promise();
    console.log(`✅ Cliente creado: ${clientData.clientId}`);
    return true;
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      console.log(`⚠️  Cliente ${clientData.clientId} ya existe, omitiendo...`);
      return false;
    }
    console.error(`❌ Error al crear cliente ${clientData.clientId}:`, error);
    throw error;
  }
}

/**
 * Verificar si la tabla existe
 */
async function checkTableExists() {
  const dynamoDBClient = new AWS.DynamoDB({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  try {
    await dynamoDBClient.describeTable({ TableName: CLIENTS_TABLE }).promise();
    console.log(`✅ Tabla ${CLIENTS_TABLE} existe`);
    return true;
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      console.error(`❌ Tabla ${CLIENTS_TABLE} no existe. Por favor, ejecuta 'node scripts/createClientsTable.js' primero.`);
      return false;
    }
    throw error;
  }
}

/**
 * Inicializar clientes
 */
async function initializeClients() {
  console.log('\n🚀 Inicializando clientes de ScraperLab...\n');

  // Verificar que la tabla existe
  const tableExists = await checkTableExists();
  if (!tableExists) {
    process.exit(1);
  }

  const now = new Date().toISOString();

  // Cliente Demo/Testing
  const demoClient = {
    clientId: 'demo',
    clientName: 'Demo Client',
    clientType: 'csv_scraping',
    allowedUsers: [
      'demo@scraperlab.com',
      'test@scraperlab.com'
    ],
    dataSource: {
      type: 'csv',
      config: {
        acceptedFormats: ['csv'],
        maxFileSize: 5242880 // 5 MB
      }
    },
    outputConfig: {
      type: 's3',
      bucket: 'scraperlab-demo-results',
      format: 'json'
    },
    scheduleConfig: {
      enabled: false
    },
    isActive: true,
    createdAt: now,
    updatedAt: now,
    metadata: {
      description: 'Cliente de demostración y testing',
      version: '1.0'
    }
  };

  // Cliente ScraperLab interno
  const scraperlabClient = {
    clientId: 'scraperlab',
    clientName: 'ScraperLab Internal',
    clientType: 'product_monitoring',
    allowedUsers: [
      'admin@scraperlab.com'
    ],
    dataSource: {
      type: 'api',
      config: {
        queryType: 'url_scraping'
      }
    },
    outputConfig: {
      type: 'dynamodb',
      tableName: 'ScraperLab-Process',
      format: 'json'
    },
    scheduleConfig: {
      enabled: false,
      description: 'Procesamiento manual mediante API'
    },
    isActive: true,
    createdAt: now,
    updatedAt: now,
    metadata: {
      description: 'Cliente interno de ScraperLab para operaciones generales',
      version: '1.0'
    }
  };

  // Crear clientes
  try {
    await createClient(demoClient);
    await createClient(scraperlabClient);

    console.log('\n✅ Inicialización completada exitosamente!\n');
    console.log('Clientes creados:');
    console.log('  - demo (CSV Scraping - Testing)');
    console.log('  - scraperlab (Product Monitoring - Internal)\n');
  } catch (error) {
    console.error('\n❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

/**
 * Listar clientes existentes
 */
async function listClients() {
  try {
    const params = {
      TableName: CLIENTS_TABLE
    };

    const result = await dynamoDB.scan(params).promise();
    
    console.log('\n📋 Clientes existentes:\n');
    
    if (result.Items.length === 0) {
      console.log('  (ninguno)');
    } else {
      result.Items.forEach(client => {
        console.log(`  - ${client.clientId} (${client.clientName})`);
        console.log(`    Tipo: ${client.clientType}`);
        console.log(`    Activo: ${client.isActive ? '✅' : '❌'}`);
        console.log(`    Usuarios: ${client.allowedUsers ? client.allowedUsers.join(', ') : 'ninguno'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error al listar clientes:', error);
    throw error;
  }
}

/**
 * Eliminar todos los clientes (usar con precaución)
 */
async function deleteAllClients() {
  try {
    const params = {
      TableName: CLIENTS_TABLE
    };

    const result = await dynamoDB.scan(params).promise();
    
    console.log(`\n⚠️  Eliminando ${result.Items.length} clientes...\n`);
    
    for (const client of result.Items) {
      await dynamoDB.delete({
        TableName: CLIENTS_TABLE,
        Key: { clientId: client.clientId }
      }).promise();
      
      console.log(`  ❌ Eliminado: ${client.clientId}`);
    }
    
    console.log('\n✅ Todos los clientes eliminados\n');
  } catch (error) {
    console.error('Error al eliminar clientes:', error);
    throw error;
  }
}

// Main
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'list':
      await listClients();
      break;
    case 'delete-all':
      console.log('⚠️  ADVERTENCIA: Esta acción eliminará TODOS los clientes');
      console.log('Para confirmar, ejecuta: node scripts/initializeClients.js delete-all-confirmed');
      break;
    case 'delete-all-confirmed':
      await deleteAllClients();
      break;
    case 'init':
    default:
      await initializeClients();
      break;
  }
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
