require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function searchEverything(term) {
  try {
    console.log(`Searching for "${term}" in all processes...`);
    let lastKey = null;
    let found = [];
    
    do {
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLES.PROCESS,
            ExclusiveStartKey: lastKey
        }));
        
        for (const item of result.Items) {
            const str = JSON.stringify(item);
            if (str.toLowerCase().includes(term.toLowerCase())) {
                found.push(item);
            }
        }
        lastKey = result.LastEvaluatedKey;
    } while (lastKey && found.length < 5);
    
    if (found.length === 0) {
      console.log('No processes found.');
      return;
    }
    
    console.log(`Found ${found.length} processes.`);
    for (const p of found) {
        console.log(`- ${p.processId} | ${p.status} | ${p.timestamp}`);
        console.log(`  Input: ${JSON.stringify(p.initialInput || p.input)}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

searchEverything('Xiaomi 15T');
