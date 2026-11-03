require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function checkApiKey() {
  const result = await dynamoDB.send(new ScanCommand({
    TableName: TABLES.USERS,
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': 'scraperlabcol@gmail.com' }
  }));
  console.log('ApiKey:', result.Items?.[0]?.apiKey);
}

checkApiKey().catch(console.error);
