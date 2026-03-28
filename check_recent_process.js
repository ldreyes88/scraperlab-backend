require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function checkRecentProcess() {
  try {
    console.log('Fetching most recent processes...');
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PROCESS,
        Limit: 5
      })
    );
    
    // Sort by timestamp if available, else just pick first
    const recent = result.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    
    if (!recent) {
      console.log('No processes found.');
      return;
    }
    
    console.log('Most recent process:', recent.processId, recent.status);
    console.log('Steps in process:', JSON.stringify(recent.steps, null, 2));
    
    console.log('Fetching details for:', recent.processId);
    const detailsResult = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLES.PROCESS_DETAIL,
        IndexName: 'processId-timestamp-index',
        KeyConditionExpression: 'processId = :pid',
        ExpressionAttributeValues: {
          ':pid': recent.processId
        }
      })
    );
    
    console.log('Details found:', detailsResult.Items.length);
    detailsResult.Items.forEach(d => {
      console.log(`- Node: ${d.nodeId} (${d.nodeType}), Success: ${d.success}, Error: ${d.error || 'None'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRecentProcess();
