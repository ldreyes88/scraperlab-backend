require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

async function checkPipeline() {
  try {
    console.log('Checking Pipelines...');
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PIPELINES
      })
    );
    console.log('Pipelines found:', result.Items.map(p => p.pipelineId));
    
    const catalogPipeline = result.Items.find(p => p.pipelineId === 'gemini-catalog-builder');
    if (catalogPipeline) {
      console.log('Pipeline gemini-catalog-builder definition:');
      console.log(JSON.stringify(catalogPipeline, null, 2));
    } else {
      console.log('Pipeline gemini-catalog-builder NOT found in DB.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPipeline();
