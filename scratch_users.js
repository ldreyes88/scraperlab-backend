require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function checkApiKey() {
  const result = await dynamoDB.send(new ScanCommand({
    TableName: TABLES.USERS,
    Limit: 10
  }));
  console.log('Users found:', result.Items?.map(u => ({ email: u.email, role: u.role, apiKey: u.apiKey ? u.apiKey.substring(0,8) + '...' : null })));
}

checkApiKey().catch(console.error);
