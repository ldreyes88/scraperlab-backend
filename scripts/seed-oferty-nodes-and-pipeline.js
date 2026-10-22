/**
 * Script de inicialización para los nodos independientes y el pipeline de Oferty Search Engine.
 * 
 * Uso:
 *   node scripts/seed-oferty-nodes-and-pipeline.js
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

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

// 1. Catálogo de Nodos Independientes para Oferty
const independentNodes = [
  {
    nodeId: 'oferty-trigger-search',
    name: 'Disparador Búsqueda Oferty',
    description: 'Recibe datos de entrada del producto a buscar (productId, name, category)',
    type: 'TRIGGER',
    category: 'trigger',
    clientId: 'oferty',
    defaultConfig: {
      inputType: {
        productId: 'string',
        name: 'string',
        category: 'string'
      }
    },
    enabled: true
  },
  {
    nodeId: 'oferty-marketplaces-search',
    name: 'Buscador Multitienda Oferty',
    description: 'Scrapea resultados de búsqueda en los principales marketplaces de Colombia',
    type: 'SCRAPE_SEARCH',
    category: 'scraping',
    clientId: 'oferty',
    defaultConfig: {
      queryTemplate: '{{input.name}}',
      domainIds: [
        'mercadolibre.com.co',
        'exito.com',
        'falabella.com.co',
        'alkosto.com',
        'ktronix.com'
      ],
      searchUrlTemplates: {
        'mercadolibre.com.co': 'https://listado.mercadolibre.com.co/{{query}}',
        'exito.com': 'https://www.exito.com/s?q={{query}}',
        'falabella.com.co': 'https://www.falabella.com.co/falabella-co/search?Ntt={{query}}',
        'alkosto.com': 'https://www.alkosto.com/search?text={{query}}',
        'ktronix.com': 'https://www.ktronix.com/search?text={{query}}'
      },
      limit: 4
    },
    enabled: true
  },
  {
    nodeId: 'oferty-gemini-product-matcher',
    name: 'Matcher Inteligente Gemini Oferty',
    description: 'Evalúa con IA candidatos de tiendas descartando repuestos, accesorios o errores',
    type: 'AI_PROMPT',
    category: 'ai',
    clientId: 'oferty',
    defaultConfig: {
      model: 'gemini-flash-lite-latest',
      isJson: true,
      promptTemplate: `Eres un asistente robótico para data scraping y control de calidad.
El producto maestro que estamos buscando es: {{input.name}}.

Acabamos de raspar las tiendas online y se devolvieron estos candidatos:
{{nodes.search_engine}}

Tu trabajo es evaluar CUIDADOSAMENTE el 'title' y determinar cuál de esas URLs pertenece al producto real.
Regla Crítica: ¡Descarta inmediatamente repuestos, cables, accesorios, partes usadas o modelos equivocados!

Genera un JSON con este formato exacto:
{
  "marketplaces": [
    {
      "name": "Nombre de la tienda (ej: MercadoLibre)",
      "currentPrice": 0,
      "url": "URL del producto",
      "isMatch": true
    }
  ]
}
Si no hay match válido, devuelve "marketplaces": [].`
    },
    enabled: true
  },
  {
    nodeId: 'oferty-condition-has-matches',
    name: 'Condición: Verificar Coincidencias Válidas',
    description: 'Evalúa si el matcher de IA encontró al menos una oferta válida (> 0)',
    type: 'CONDITION',
    category: 'logic',
    clientId: 'oferty',
    defaultConfig: {
      expression: '{{nodes.ai_matcher.marketplaces.length}} > 0',
      onTrue: 'sync_oferty',
      onFalse: 'notify_telegram'
    },
    enabled: true
  },
  {
    nodeId: 'oferty-update-marketplaces-api',
    name: 'Sincronizador API Interna Oferty',
    description: 'Envía los marketplaces y precios verificados al Backend de Oferty por PATCH',
    type: 'API_REQUEST',
    category: 'integration',
    clientId: 'oferty',
    defaultConfig: {
      method: 'PATCH',
      url: '{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{input.productId}}/marketplaces',
      headers: {
        'x-internal-api-key': '{{config.OFERTY_INTERNAL_API_KEY}}',
        'Content-Type': 'application/json'
      },
      bodyTemplate: '{{nodes.ai_matcher}}'
    },
    enabled: true
  },
  {
    nodeId: 'oferty-telegram-notice',
    name: 'Notificador Telegram Oferty',
    description: 'Notifica al canal de operaciones cuando una búsqueda no encuentra resultados',
    type: 'API_REQUEST',
    category: 'integration',
    clientId: 'oferty',
    defaultConfig: {
      method: 'POST',
      url: 'https://api.telegram.org/bot{{config.TELEGRAM_NOTICE_TOKEN}}/sendMessage',
      headers: {
        'Content-Type': 'application/json'
      },
      bodyTemplate: {
        chat_id: '{{config.TELEGRAM_NOTICE_CHAT_ID}}',
        text: '⚠️ [Oferty Search Engine] Sin coincidencias válidas para: {{input.name}} (ID: {{input.productId}})'
      }
    },
    enabled: true
  }
];

// 2. Definición del Pipeline orquestado usando relaciones y nodeRef
const ofertyPipeline = {
  pipelineId: 'oferty-search-engine-pipeline',
  name: 'Oferty Search Engine & Price Matcher',
  description: 'Búsqueda multitienda, clasificación con Gemini IA, condición de matches y sincronización con Oferty',
  clientId: 'oferty',
  enabled: true,
  startNodeId: 'start',
  nodes: [
    {
      id: 'start',
      nodeRef: 'oferty-trigger-search',
      next: 'search_engine'
    },
    {
      id: 'search_engine',
      nodeRef: 'oferty-marketplaces-search',
      next: 'ai_matcher'
    },
    {
      id: 'ai_matcher',
      nodeRef: 'oferty-gemini-product-matcher',
      next: 'evaluar_matches'
    },
    {
      id: 'evaluar_matches',
      nodeRef: 'oferty-condition-has-matches',
      configOverride: {
        expression: '{{nodes.ai_matcher.marketplaces.length}} > 0',
        onTrue: 'sync_oferty',
        onFalse: 'notify_telegram'
      }
    },
    {
      id: 'sync_oferty',
      nodeRef: 'oferty-update-marketplaces-api',
      next: null
    },
    {
      id: 'notify_telegram',
      nodeRef: 'oferty-telegram-notice',
      next: null
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function seed() {
  console.log(`\n======================================================`);
  console.log(`🚀 Sembrando Nodos Independientes y Pipeline de Oferty`);
  console.log(`======================================================\n`);

  try {
    // 1. Guardar Nodos Independientes
    console.log(`📦 Registrando ${independentNodes.length} nodos independientes en '${TABLES.NODES}'...`);
    for (const node of independentNodes) {
      await dynamoDB.send(new PutCommand({
        TableName: TABLES.NODES,
        Item: {
          ...node,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }));
      console.log(`   ✅ Nodo registrado: '${node.nodeId}' (${node.type})`);
    }

    // 2. Guardar Pipeline Orquestado
    console.log(`\n🔗 Registrando Pipeline '${ofertyPipeline.pipelineId}' en '${TABLES.PIPELINES}'...`);
    await dynamoDB.send(new PutCommand({
      TableName: TABLES.PIPELINES,
      Item: ofertyPipeline
    }));
    console.log(`   ✅ Pipeline registrado exitosamente con relaciones y condiciones:`);
    console.log(`      start -> search_engine -> ai_matcher -> Si matches > 0:`);
    console.log(`         └── TRUE  -> sync_oferty`);
    console.log(`         └── FALSE -> notify_telegram\n`);

    console.log(`🎉 Proceso completado exitosamente.\n`);
  } catch (error) {
    console.error(`❌ Error sembrando nodos y pipeline de Oferty:`, error);
    process.exit(1);
  }
}

seed();
