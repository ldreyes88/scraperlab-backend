require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function checkDomains() {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.DOMAINS
      })
    );
    console.log(JSON.stringify(result.Items, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDomains();
