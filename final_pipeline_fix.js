require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const PIELINE_ID = 'gemini-catalog-builder';

async function updateToFirstProductId() {
  try {
    const getResult = await dynamoDB.send(new GetCommand({
      TableName: TABLES.PIPELINES,
      Key: { pipelineId: PIELINE_ID }
    }));
    
    if (!getResult.Item) {
      console.error('Pipeline no encontrado');
      return;
    }
    
    let pipeline = getResult.Item;
    
    // 1. Localizar y actualizar el nodo update_marketplaces
    const updateNodeIndex = pipeline.nodes.findIndex(n => n.id === 'update_marketplaces');
    if (updateNodeIndex === -1) {
      console.error('Nodo no encontrado');
      return;
    }
    
    // El cambio final suave: data.firstProductId
    pipeline.nodes[updateNodeIndex].config.url = '{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{nodes.ingest_catalog.data.firstProductId}}/marketplaces';
    
    // 2. Guardar en DynamoDB
    await dynamoDB.send(new UpdateCommand({
      TableName: TABLES.PIPELINES,
      Key: { pipelineId: PIELINE_ID },
      UpdateExpression: 'set nodes = :n, updatedAt = :u',
      ExpressionAttributeValues: {
        ':n': pipeline.nodes,
        ':u': new Date().toISOString()
      }
    }));
    
    console.log('✅ Pipeline Finalizado: Nodo marketplaces ahora usa firstProductId');
  } catch (err) {
    console.error('Error:', err);
  }
}

updateToFirstProductId();
