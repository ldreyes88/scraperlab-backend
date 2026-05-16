const PipelineRepository = require('../src/repositories/PipelineRepository');

async function removeConditionNode() {
  const pipelineId = 'monitor-supernotariado';
  const pipeline = await PipelineRepository.getById(pipelineId);
  
  if (!pipeline) {
    console.error('Pipeline no encontrado');
    return;
  }

  // 1. Filtrar los nodos para quitar 'filter-changes'
  const newNodes = pipeline.nodes.filter(n => n.id !== 'filter-changes');

  // 2. Apuntar 'scrape-api' directamente a 'notify-telegram'
  const scrapeApiNode = newNodes.find(n => n.id === 'scrape-api');
  if (scrapeApiNode) {
    scrapeApiNode.next = 'notify-telegram';
  }

  // 3. Actualizar en DynamoDB
  await PipelineRepository.update(pipelineId, { nodes: newNodes });
  console.log('Pipeline actualizado: Nodo de condición eliminado. Ahora el flujo va directo a Telegram.');
}

removeConditionNode().catch(console.error);
