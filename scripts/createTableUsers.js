require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand
} = require('@aws-sdk/lib-dynamodb');
const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { 
  CognitoIdentityProviderClient, 
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const cognitoClient = new CognitoIdentityProviderClient({ 
  region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1' 
});

const TABLE_NAME = 'ScraperLab-Users';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

async function createUsersTable() {
  console.log(`🔨 Creando tabla ${TABLE_NAME}...`);

  const params = {
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' } // Partition key (Cognito sub)
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
      { AttributeName: 'apiKey', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'ApiKeyIndex',
        KeySchema: [
          { AttributeName: 'apiKey', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
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
    Tags: [
      { Key: 'Project', Value: 'ScraperLab' },
      { Key: 'Environment', Value: process.env.STAGE || 'dev' }
    ]
  };

  try {
    const command = new CreateTableCommand(params);
    const result = await client.send(command);
    console.log('✅ Tabla creada exitosamente:', result.TableDescription.TableName);
    console.log('📊 Estado:', result.TableDescription.TableStatus);
    console.log('🔑 Indices creados:', result.TableDescription.GlobalSecondaryIndexes?.length || 0);
    
    // Esperar a que la tabla esté activa
    console.log('⏳ Esperando a que la tabla esté activa...');
    await waitForTableActive(TABLE_NAME);
    
    return result;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('⚠️  La tabla ya existe');
    } else {
      console.error('❌ Error creando tabla:', error.message);
      throw error;
    }
  }
}

async function waitForTableActive(tableName) {
  const maxAttempts = 30;
  const delayMs = 2000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
      const command = new DescribeTableCommand({ TableName: tableName });
      const result = await client.send(command);
      
      if (result.Table.TableStatus === 'ACTIVE') {
        console.log('✅ Tabla activa y lista para usar');
        return true;
      }
      
      console.log(`⏳ Estado actual: ${result.Table.TableStatus}, reintentando...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      console.error('Error verificando estado de tabla:', error.message);
      throw error;
    }
  }
  
  throw new Error('Timeout esperando a que la tabla esté activa');
}

/**
 * Actualizar custom:role en Cognito para un usuario
 */
async function updateCognitoRole(email, role) {
  if (!USER_POOL_ID) {
    console.warn('⚠️  COGNITO_USER_POOL_ID no configurado, saltando actualización de Cognito');
    return false;
  }

  try {
    // Verificar si el usuario existe en Cognito
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email
    });
    
    await cognitoClient.send(getUserCommand);

    // Actualizar el atributo custom:role
    const updateCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: role
        }
      ]
    });

    await cognitoClient.send(updateCommand);
    console.log(`   ✓ custom:role actualizado en Cognito: ${role}`);
    return true;
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      console.warn(`   ⚠️  Usuario ${email} no existe en Cognito (debe crearse primero)`);
    } else {
      console.error(`   ❌ Error actualizando Cognito:`, error.message);
    }
    return false;
  }
}

async function createSampleUsers() {
  console.log('\n👥 Creando usuarios de ejemplo...');
  
  const sampleUsers = [
    {
      userId: 'admin-sample-001',
      email: 'admin@scraperlab.com.co',
      role: 'admin',
      apiKey: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        firstName: 'Admin',
        lastName: 'User',
        company: 'ScraperLab'
      }
    },
    {
      userId: 'user-sample-001',
      email: 'user@example.com',
      role: 'user',
      apiKey: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        firstName: 'Test',
        lastName: 'User'
      }
    }
  ];

  for (const user of sampleUsers) {
    try {
      // Crear en DynamoDB
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: user
      });
      await docClient.send(command);
      console.log(`✅ Usuario creado en DynamoDB: ${user.email} (${user.role})`);
      
      // Actualizar custom:role en Cognito si el usuario existe
      await updateCognitoRole(user.email, user.role);
    } catch (error) {
      console.error(`❌ Error creando usuario ${user.email}:`, error.message);
    }
  }
  
  console.log('\n💡 Nota: Si los usuarios no existen en Cognito, créalos primero o regístralos desde la aplicación.');
}

// Script principal
(async () => {
  try {
    console.log('🚀 Iniciando creación de tabla ScraperLab-Users\n');
    await createUsersTable();
    
    // Opcional: crear usuarios de ejemplo
    const createSamples = process.argv.includes('--samples');
    if (createSamples) {
      await createSampleUsers();
    }
    
    console.log('\n✅ Proceso completado exitosamente');
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  }
})();
