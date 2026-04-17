require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function listRecentProcesses() {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    console.log(`Listing processes since ${oneHourAgo}...`);
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PROCESS,
        FilterExpression: '#ts > :ts',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':ts': oneHourAgo
        }
      })
    );
    
    console.log(`Found ${result.Items.length} recent processes.`);
    for (const p of result.Items) {
        console.log(`- ${p.processId} | Status: ${p.status} | Input: ${JSON.stringify(p.initialInput)}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listRecentProcesses();
