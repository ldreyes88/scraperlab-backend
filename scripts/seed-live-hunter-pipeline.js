/**
 * Script de inicialización para el nodo HUNTER y el pipeline 'live-search-hunter'
 * Uso:
 *   node scripts/seed-live-hunter-pipeline.js
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const STAGE = process.env.STAGE || 'dev';
const isLocal = STAGE === 'dev' && process.env.AWS_ENDPOINT;

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (isLocal) {
  clientConfig.endpoint = process.env.AWS_ENDPOINT || 'http://localhost:8000';
  clientConfig.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
}

const client = new DynamoDBClient(clientConfig);
const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false }
});

const TABLES = {
  PIPELINES: process.env.PIPELINES_TABLE_NAME || 'ScraperLab-Pipelines',
  NODES: process.env.NODES_TABLE_NAME || 'ScraperLab-Nodes'
};

// 1. Nodo Hunter Multitienda en Tiempo Real
const liveHunterNode = {
  nodeId: 'oferty-live-hunter-node',
  name: 'Hunter Scraping Multitienda en Tiempo Real',
  description: 'Búsqueda en paralelo en los sitios seleccionados (Alkosto, Éxito, Mercado Libre) extrayendo posición #1 y clasificando con Gemini IA',
  type: 'HUNTER_SCRAPING',
  category: 'scraping',
  clientId: 'oferty',
  defaultConfig: {
    marketplaces: ['exito', 'alkosto', 'mercadolibre'],
    limitPerMarket: 1
  },
  enabled: true
};

// 2. Pipeline 'live-search-hunter'
const liveHunterPipeline = {
  pipelineId: 'live-search-hunter',
  name: 'Live Search Hunter Pipeline',
  description: 'Pipeline en tiempo real para búsqueda de ofertas y productos multitienda con nodo Hunter scraping',
  clientId: 'oferty',
  enabled: true,
  startNodeId: 'hunter_node',
  nodes: [
    {
      id: 'hunter_node',
      nodeRef: 'oferty-live-hunter-node',
      type: 'HUNTER_SCRAPING',
      next: null
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function seed() {
  console.log(`\n======================================================`);
  console.log(`🚀 Registrando Nodo Hunter y Pipeline 'live-search-hunter'`);
  console.log(`======================================================\n`);

  try {
    // 1. Guardar Nodo
    console.log(`📦 Registrando nodo '${liveHunterNode.nodeId}' en '${TABLES.NODES}'...`);
    await dynamoDB.send(new PutCommand({
      TableName: TABLES.NODES,
      Item: {
        ...liveHunterNode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }));
    console.log(`   ✅ Nodo Hunter registrado con éxito.`);

    // 2. Guardar Pipeline
    console.log(`\n🔗 Registrando Pipeline '${liveHunterPipeline.pipelineId}' en '${TABLES.PIPELINES}'...`);
    await dynamoDB.send(new PutCommand({
      TableName: TABLES.PIPELINES,
      Item: liveHunterPipeline
    }));
    console.log(`   ✅ Pipeline 'live-search-hunter' registrado con éxito.`);

    console.log(`\n🎉 Seed de Hunter completado exitosamente.\n`);
  } catch (error) {
    console.error(`❌ Error registrando Hunter en ScraperLab:`, error);
  }
}

seed();
