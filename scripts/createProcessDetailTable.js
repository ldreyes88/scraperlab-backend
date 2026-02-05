/**
 * Script para crear la tabla ScraperLab-Process-Detail en DynamoDB
 * 
 * Ejecutar: node createProcessDetailTable.js
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const tableName = process.env.PROCESS_DETAIL_TABLE_NAME || 'ScraperLab-Process-Detail';

async function createTable() {
  try {
    console.log(`📊 Creando tabla: ${tableName}...`);

    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'detailId', KeyType: 'HASH' } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: 'detailId', AttributeType: 'S' },
        { AttributeName: 'processId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'processId-timestamp-index',
          KeySchema: [
            { AttributeName: 'processId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      StreamSpecification: {
        StreamEnabled: false
      },
      Tags: [
        { Key: 'Project', Value: 'ScraperLab' },
        { Key: 'Environment', Value: process.env.STAGE || 'prod' }
      ]
    });

    const response = await client.send(command);

    console.log('✅ Tabla creada exitosamente!');
    console.log(`📋 ARN: ${response.TableDescription.TableArn}`);
    console.log(`🔑 Partition Key: detailId (String)`);
    console.log(`📊 GSI: processId-timestamp-index`);
    console.log('\n⏳ La tabla puede tardar unos momentos en estar completamente activa.');
    console.log('   Puedes verificar el estado en la consola de AWS DynamoDB.');

  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️  La tabla ya existe.');
    } else {
      console.error('❌ Error creando tabla:', error.message);
      throw error;
    }
  }
}

createTable().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
