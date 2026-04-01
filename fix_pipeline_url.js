require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const PIELINE_ID = 'gemini-catalog-builder';

async function updatePipelineNodes() {
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
    
    // 1. Obtener y actualizar el nodo ingest_catalog para que sea la referencia correcta
    const ingestNode = pipeline.nodes.find(n => n.id === 'ingest_catalog');
    
    // 2. Localizar y actualizar el nodo update_marketplaces
    const updateNodeIndex = pipeline.nodes.findIndex(n => n.id === 'update_marketplaces');
    if (updateNodeIndex === -1) {
      console.error('Nodo update_marketplaces no encontrado');
      return;
    }
    
    // El cambio clave: usar data.productIds[0] en lugar de familyId
    pipeline.nodes[updateNodeIndex].config.url = '{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{nodes.ingest_catalog.data.productIds[0]}}/marketplaces';
    
    // 3. Guardar cambios en DynamoDB
    await dynamoDB.send(new UpdateCommand({
      TableName: TABLES.PIPELINES,
      Key: { pipelineId: PIELINE_ID },
      UpdateExpression: 'set nodes = :n, updatedAt = :u',
      ExpressionAttributeValues: {
        ':n': pipeline.nodes,
        ':u': new Date().toISOString()
      }
    }));
    
    console.log('✅ Pipeline actualizado: Ahora el nodo marketplaces apunta a productIds[0]');
  } catch (err) {
    console.error('Error al actualizar:', err);
  }
}

updatePipelineNodes();
