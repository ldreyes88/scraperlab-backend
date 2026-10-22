/**
 * Script de migración de pipelines actuales a nodos independientes.
 * 
 * Uso:
 *   node scripts/migrate-pipelines-to-nodes.js           (Ejecución real)
 *   node scripts/migrate-pipelines-to-nodes.js --dry-run (Simulación sin escribir en DB)
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

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

const isDryRun = process.argv.includes('--dry-run');

/**
 * Determina la categoría según el tipo de nodo
 */
function resolveCategory(type) {
  switch (type) {
    case 'SCRAPE_SEARCH':
    case 'SCRAPE_DETAIL':
      return 'scraping';
    case 'AI_PROMPT':
      return 'ai';
    case 'CONDITION':
      return 'logic';
    case 'API_REQUEST':
      return 'integration';
    case 'DATA_MAPPING':
      return 'transform';
    case 'TRIGGER':
      return 'trigger';
    default:
      return 'general';
  }
}

/**
 * Genera un nodeId descriptivo para el catálogo reutilizable
 */
function generateCatalogNodeId(pipelineId, node) {
  // Si ya tiene un nombre o id representativo, usarlo prefijado con el contexto si es necesario
  const cleanNodeId = node.id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  
  // Nombres globales comunes que pueden ser compartidos
  if (node.type === 'TRIGGER' && cleanNodeId === 'start') {
    return `${pipelineId}-trigger`;
  }
  
  return `${pipelineId}-${cleanNodeId}`;
}

async function migrate() {
  console.log(`\n======================================================`);
  console.log(`🔄 Iniciando Migración de Pipelines a Nodos Independientes`);
  console.log(`   Modo: ${isDryRun ? '🔍 SIMULACIÓN (--dry-run)' : '🚀 EJECUCIÓN REAL'}`);
  console.log(`   Tabla Pipelines: ${TABLES.PIPELINES}`);
  console.log(`   Tabla Nodos:     ${TABLES.NODES}`);
  console.log(`======================================================\n`);

  try {
    // 1. Obtener todos los pipelines existentes
    const scanResult = await dynamoDB.send(new ScanCommand({ TableName: TABLES.PIPELINES }));
    const pipelines = scanResult.Items || [];

    console.log(`📋 Total de pipelines encontrados en la base de datos: ${pipelines.length}`);

    if (pipelines.length === 0) {
      console.log('ℹ️  No hay pipelines en la base de datos para migrar.');
      return;
    }

    let totalNodesCreated = 0;
    let totalPipelinesUpdated = 0;

    for (const pipeline of pipelines) {
      console.log(`\n------------------------------------------------------`);
      console.log(`⚙️  Procesando Pipeline: '${pipeline.pipelineId}' (${pipeline.name || 'Sin nombre'})`);
      
      const nodes = pipeline.nodes || [];
      if (!Array.isArray(nodes) || nodes.length === 0) {
        console.log(`   ⚠️  El pipeline no tiene nodos configurados. Saltando.`);
        continue;
      }

      let pipelineModified = false;
      const updatedNodes = [];

      for (const node of nodes) {
        // Si el nodo ya usa nodeRef, no necesita migración
        if (node.nodeRef) {
          console.log(`   ⏭️  Nodo '${node.id}' ya utiliza nodeRef ('${node.nodeRef}'). Sin cambios.`);
          updatedNodes.push(node);
          continue;
        }

        // Si es un nodo inline que tiene 'type' y 'config', lo extraemos al catálogo
        const catalogNodeId = generateCatalogNodeId(pipeline.pipelineId, node);
        const category = resolveCategory(node.type);

        const independentNode = {
          nodeId: catalogNodeId,
          name: node.name || `${pipeline.name || pipeline.pipelineId} - ${node.id}`,
          description: `Nodo extraído del pipeline '${pipeline.pipelineId}' (${node.type})`,
          type: node.type,
          category: category,
          clientId: pipeline.clientId || 'global',
          defaultConfig: node.config || {},
          enabled: true,
          migratedFromPipeline: pipeline.pipelineId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        console.log(`   ➕ Extrayendo nodo '${node.id}' -> Catálogo como '${catalogNodeId}' [${node.type}]`);

        if (!isDryRun) {
          // Guardar el nodo en ScraperLab-Nodes
          await dynamoDB.send(new PutCommand({
            TableName: TABLES.NODES,
            Item: independentNode
          }));
        }
        totalNodesCreated++;

        // Crear la referencia para el pipeline
        const refNode = {
          id: node.id,
          nodeRef: catalogNodeId,
          name: node.name || node.id,
          next: node.next !== undefined ? node.next : null
        };

        if (node.onError !== undefined) {
          refNode.onError = node.onError;
        }
        if (node.branches !== undefined) {
          refNode.branches = node.branches;
        }

        updatedNodes.push(refNode);
        pipelineModified = true;
      }

      if (pipelineModified) {
        console.log(`   💾 Actualizando pipeline '${pipeline.pipelineId}' con las nuevas referencias...`);
        if (!isDryRun) {
          const updatedPipeline = {
            ...pipeline,
            nodes: updatedNodes,
            migratedToNodes: true,
            updatedAt: new Date().toISOString()
          };

          await dynamoDB.send(new PutCommand({
            TableName: TABLES.PIPELINES,
            Item: updatedPipeline
          }));
        }
        totalPipelinesUpdated++;
      } else {
        console.log(`   ✔️  El pipeline '${pipeline.pipelineId}' ya estaba completamente migrado.`);
      }
    }

    console.log(`\n======================================================`);
    console.log(`🎉 Migración completada con éxito`);
    console.log(`   Nodos extraídos y creados en el catálogo: ${totalNodesCreated}`);
    console.log(`   Pipelines actualizados con nodeRef:       ${totalPipelinesUpdated}`);
    console.log(`======================================================\n`);

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrate();
