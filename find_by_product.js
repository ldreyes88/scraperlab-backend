require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function findByProduct(term) {
  try {
    console.log(`Searching for processes with term: ${term}...`);
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PROCESS,
        FilterExpression: 'contains(initialInput, :term)',
        ExpressionAttributeValues: {
          ':term': term
        }
      })
    );
    
    if (result.Items.length === 0) {
      console.log('No processes found for this term.');
      return;
    }
    
    console.log(`Found ${result.Items.length} processes.`);
    for (const process of result.Items) {
      console.log(`--- ProcessId: ${process.processId} | Status: ${process.status} | Time: ${process.timestamp} ---`);
      console.log('Initial Input:', JSON.stringify(process.initialInput));
      
      const detailsResult = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLES.PROCESS_DETAIL,
          IndexName: 'processId-timestamp-index',
          KeyConditionExpression: 'processId = :pid',
          ExpressionAttributeValues: {
            ':pid': process.processId
          }
        })
      );
      
      detailsResult.Items.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(d => {
        console.log(`- Node: ${d.nodeId} (${d.nodeType}), Success: ${d.success}, Error: ${d.error || 'None'}`);
        if (d.error) console.log('  Error detail:', d.error);
        if (d.nodeId === 'ai-match-offer') {
             console.log('  Match Offer Result:', JSON.stringify(d.data, null, 2));
        }
        if (d.nodeId === 'ai-select-sources') {
             console.log('  Select Sources Result:', JSON.stringify(d.data, null, 2));
        }
      });
      console.log('--------------------------------------------------');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Search for partial name
findByProduct('Xiaomi 15T Pro');
