require('dotenv').config();
const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall, marshall } = require('@aws-sdk/util-dynamodb');

async function cloneDomain() {
  const sourceDomain = process.argv[2];
  const targetDomain = process.argv[3];

  if (!sourceDomain || !targetDomain) {
    console.log('Uso: node scripts/clone_domain_config.js <source> <target>');
    return;
  }

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.STAGE === 'dev' && {
      endpoint: 'http://localhost:8000'
    })
  });

  try {
    console.log(`Buscando configuración origen: ${sourceDomain}`);
    const { Item } = await client.send(new GetItemCommand({
      TableName: process.env.DOMAINS_TABLE_NAME,
      Key: marshall({ domainId: sourceDomain })
    }));

    if (!Item) {
      console.error(`No se encontró la configuración para ${sourceDomain}`);
      return;
    }

    const config = unmarshall(Item);
    config.domainId = targetDomain;
    config.updatedAt = new Date().toISOString();

    console.log(`Clonando a: ${targetDomain}...`);
    await client.send(new PutItemCommand({
      TableName: process.env.DOMAINS_TABLE_NAME,
      Item: marshall(config, { removeUndefinedValues: true })
    }));

    console.log(`✓ Configuración clonada exitosamente de ${sourceDomain} a ${targetDomain}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

cloneDomain();
