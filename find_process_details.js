require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function findProcess() {
  const targetIdInput = process.argv[2];
  if (!targetIdInput) {
    console.error('Usage: node find_process_details.js <processId>');
    return;
  }
  
  try {
    console.log(`Searching for process: ${targetIdInput}...`);
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PROCESS,
        FilterExpression: 'begins_with(processId, :pid)',
        ExpressionAttributeValues: {
          ':pid': targetIdInput.substring(0, 8)
        }
      })
    );
    
    if (result.Items.length === 0) {
      console.log('Process not found with Scan. Trying direct Get or searching all...');
      const all = await dynamoDB.send(new ScanCommand({ TableName: TABLES.PROCESS }));
      console.log('All processes in DB:', all.Items.map(p => p.processId.substring(0,8)));
      return;
    }
    
    const process = result.Items[0];
    console.log('Found process:', JSON.stringify(process, null, 2));
    
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
    
    console.log('Details found:', detailsResult.Items.length);
    detailsResult.Items.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).forEach(d => {
      console.log(`- Node: ${d.nodeId} (${d.nodeType}), Success: ${d.success}, Error: ${d.error || 'None'}`);
      if (d.error) console.log('  Error detail:', d.error);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findProcess();
