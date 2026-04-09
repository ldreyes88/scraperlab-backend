/**
 * scripts/seed-pipelines.js
 * 
 * Este script registra el nuevo pipeline 'product-hunter' y actualiza el 
 * pipeline 'gemini-catalog-builder' para asegurar la independencia de flujos.
 * 
 * Uso:
 *   node scripts/seed-pipelines.js
 */

require('dotenv').config();
const PipelineRepository = require('../src/repositories/PipelineRepository');

const PIPELINES = [
  {
    pipelineId: "gemini-catalog-builder",
    name: "Pipeline Generador de Catálogo AI (Solo Creación)",
    enabled: true,
    startNodeId: "start",
    nodes: [
      {
        id: "start",
        type: "TRIGGER",
        config: { inputType: "product_family_name" },
        next: "fetch-knowledge"
      },
      {
        id: "fetch-knowledge",
        type: "API_REQUEST",
        config: {
          method: "GET",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/search?q={{input.product_family_name}}",
          headers: { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" }
        },
        next: "ai-generate-catalog"
      },
      {
        id: "ai-generate-catalog",
        type: "AI_PROMPT",
        config: {
          model: "gemini-2.5-pro",
          isJson: true,
          promptTemplate: "Genera el catálogo técnico... BASE DE CONOCIMIENTO: {{nodes.fetch-knowledge.data}}..."
        },
        next: "map-payload"
      },
      {
        id: "map-payload",
        type: "DATA_MAPPING",
        config: {
          mapping: {
            family: "{{nodes.ai-generate-catalog.family}}",
            products: "{{nodes.ai-generate-catalog.products}}"
          }
        },
        next: "push-to-oferty"
      },
      {
        id: "push-to-oferty",
        type: "API_REQUEST", 
        config: {
          method: "POST",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/ai/catalogs",
          headers: { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" },
          bodyTemplate: "{{nodes.map-payload}}"
        },
        next: null
      }
    ]
  },
  {
    pipelineId: "product-hunter",
    name: "Hunter de Precios Seleccionado (Búsqueda Inteligente)",
    enabled: true,
    startNodeId: "start",
    nodes: [
      {
        id: "start",
        type: "TRIGGER",
        config: { inputType: { productId: "string", name: "string", category: "string" } },
        next: "ai-select-sources"
      },
      {
        id: "ai-select-sources",
        type: "AI_PROMPT",
        config: {
          model: "gemini-2.5-flash",
          isJson: true,
          promptTemplate: "Analiza el producto '{{input.name}}' de la categoría '{{input.category}}'. Selecciona los dominios más relevantes para buscar su precio en Colombia de esta lista: ['exito.com', 'mercadolibre.com.co', 'falabella.com.co', 'alkosto.com', 'ktronix.com', 'olympica.com', 'panamericana.com.co']. Responde un JSON con el campo 'domainIds' (array)."
        },
        next: "search-marketplaces"
      },
      {
        id: "search-marketplaces",
        type: "SCRAPE_SEARCH",
        config: {
          domainIds: "{{nodes.ai-select-sources.domainIds}}",
          queryTemplate: "{{input.name}}",
          limit: 3
        },
        next: "ai-match-offer"
      },
      {
        id: "ai-match-offer",
        type: "AI_PROMPT",
        config: {
          model: "gemini-2.5-flash",
          isJson: true,
          promptTemplate: "Eres un experto en matching de productos. Datos del producto original: {{input.name}}. Resultados de búsqueda: {{nodes.search-marketplaces}}. Identifica cuál de los resultados es el match exacto. Descarta accesorios, fundas o productos usados. Retorna un JSON con el objeto match que incluya { \"url\", \"currentPrice\", \"domainId\" } o null si no hay match claro."
        },
        next: "update-oferty"
      },
      {
        id: "update-oferty",
        type: "API_REQUEST",
        config: {
          method: "PATCH",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{input.productId}}/marketplaces",
          bodyTemplate: "{{nodes.ai-match-offer}}"
        },
        next: null
      }
    ]
  }
];

async function seed() {
  console.log('🚀 Iniciando seeding de pipelines...\n');

  for (const pipeline of PIPELINES) {
    try {
      console.log(`⏳ Procesando pipeline: ${pipeline.pipelineId}...`);
      await PipelineRepository.update(pipeline.pipelineId, pipeline).catch(async (err) => {
        // Si el update falla porque no existe, intentar crear
        if (err.message.includes('not found')) {
          return await PipelineRepository.create(pipeline);
        }
        throw err;
      });
      console.log(`✅ Pipeline ${pipeline.pipelineId} registrado/actualizado.\n`);
    } catch (err) {
      console.error(`❌ Error con el pipeline ${pipeline.pipelineId}:`, err.message);
    }
  }

  console.log('✨ Proceso de seeding finalizado.');
}

seed().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
