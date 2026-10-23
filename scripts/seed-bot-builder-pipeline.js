/**
 * Script para sembrar los nodos y pipeline del Bot Builder en DynamoDB
 * 
 * Uso:
 *   node scripts/seed-bot-builder-pipeline.js
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../src/utils/time');

const STAGE = process.env.STAGE || 'dev';
const isLocal = STAGE === 'dev';

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (isLocal) {
  clientConfig.endpoint = 'http://localhost:8000';
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

const botBuilderNodes = [
  {
    nodeId: 'bot-builder-trigger',
    name: 'Disparador Bot Builder',
    description: 'Recibe datos iniciales del bot y URLs a raspar (botId, targetUrls, clientId)',
    type: 'TRIGGER',
    category: 'trigger',
    clientId: 'scraperlab',
    defaultConfig: {
      inputType: {
        botId: 'string',
        targetUrls: 'array',
        clientId: 'string'
      }
    },
    enabled: true
  },
  {
    nodeId: 'bot-knowledge-extractor',
    name: 'Extractor Semántico de Conocimiento Gemini',
    description: 'Analiza el HTML y genera resumen, FAQs estructuradas y canales de contacto',
    type: 'AI_PROMPT',
    category: 'ai',
    clientId: 'scraperlab',
    defaultConfig: {
      model: 'gemini-flash-lite-latest',
      isJson: true,
      promptTemplate: `Actúa como un sintetizador de conocimiento para el bot {{input.botId}}.
Extrae resumen del negocio, catálogo de servicios, preguntas frecuentes y datos de contacto de este texto:
{{nodes.scrape_page}}`
    },
    enabled: true
  },
  {
    nodeId: 'bot-knowledge-persist',
    name: 'Guardado de Base de Conocimiento',
    description: 'Persiste los documentos de conocimiento asociados al bot en la base de datos',
    type: 'SAVE_RESULT',
    category: 'database',
    clientId: 'scraperlab',
    defaultConfig: {
      resultKey: 'botKnowledge',
      dataTemplate: '{{nodes.ai_extractor}}'
    },
    enabled: true
  }
];

const botBuilderPipeline = {
  pipelineId: 'bot-builder-pipeline',
  name: 'Pipeline de Creación y Auto-Entrenamiento de Chatbots',
  description: 'Raspa URLs del cliente, extrae FAQs y servicios con IA, y genera la base de conocimiento para el bot',
  clientId: 'scraperlab',
  enabled: true,
  startNodeId: 'start',
  nodes: [
    {
      id: 'start',
      nodeRef: 'bot-builder-trigger',
      next: 'ai_extractor'
    },
    {
      id: 'ai_extractor',
      nodeRef: 'bot-knowledge-extractor',
      next: 'save_knowledge'
    },
    {
      id: 'save_knowledge',
      nodeRef: 'bot-knowledge-persist',
      next: null
    }
  ],
  createdAt: nowColombiaISO(),
  updatedAt: nowColombiaISO()
};

async function seed() {
  console.log(`\n======================================================`);
  console.log(`Sembrando Nodos y Pipeline de Bot Builder en DynamoDB`);
  console.log(`======================================================\n`);

  try {
    // 1. Guardar Nodos
    for (const node of botBuilderNodes) {
      console.log(`Registrando nodo: ${node.nodeId} (${node.name})...`);
      await dynamoDB.send(new PutCommand({
        TableName: TABLES.NODES,
        Item: {
          ...node,
          createdAt: nowColombiaISO(),
          updatedAt: nowColombiaISO()
        }
      }));
    }
    console.log(`\nTodos los nodos de Bot Builder guardados exitosamente.`);

    // 2. Guardar Pipeline
    console.log(`Registrando pipeline: ${botBuilderPipeline.pipelineId}...`);
    await dynamoDB.send(new PutCommand({
      TableName: TABLES.PIPELINES,
      Item: botBuilderPipeline
    }));
    console.log(`Pipeline ${botBuilderPipeline.pipelineId} registrado exitosamente.\n`);

  } catch (error) {
    console.error('Error sembrando bot builder:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, botBuilderNodes, botBuilderPipeline };
