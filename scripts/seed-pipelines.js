// Archivo: scripts/seed-pipelines.js
require('dotenv').config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  PIPELINES: "ScraperLab-Pipelines"
};

const pipelines = [
  {
    pipelineId: "product-hunter",
    name: "Hunter de Precios Seleccionado",
    description: "Busca precios en vivo para un producto específico en marketplaces colombianos",
    enabled: true,
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
          model: "gemini-flash-lite-latest",
          isJson: true,
          promptTemplate: "Analiza el producto '{{input.name}}'. Selecciona los dominios más relevantes para buscar su precio en Colombia de esta lista: ['exito.com', 'mercadolibre.com.co', 'falabella.com.co', 'alkosto.com', 'ktronix.com']. Responde un JSON con el campo 'domainIds' (array)."
        },
        next: "search-marketplaces"
      },
      {
        id: "search-marketplaces",
        type: "SCRAPE_SEARCH",
        config: {
          domainIds: "{{nodes.ai-select-sources.domainIds}}",
          queryTemplate: "{{input.name}}",
          searchUrlTemplates: {
            "mercadolibre.com.co": "https://listado.mercadolibre.com.co/{{query}}",
            "exito.com": "https://www.exito.com/s?q={{query}}",
            "falabella.com.co": "https://www.falabella.com.co/falabella-co/search?Ntt={{query}}",
            "alkosto.com": "https://www.alkosto.com/search?text={{query}}",
            "ktronix.com": "https://www.ktronix.com/search?text={{query}}"
          },
          limit: 3
        },
        next: "ai-match-offer"
      },
      {
        id: "ai-match-offer",
        type: "AI_PROMPT",
        config: {
          model: "gemini-flash-lite-latest",
          isJson: true,
          promptTemplate: `Eres un asistente robótico para data scraping y control de calidad.
El producto maestro que estamos buscando es: {{input.name}}.

Acabamos de raspar una tienda online y devolvió estos candidatos:
{{nodes.search-marketplaces}}

Tu trabajo es evaluar CUIDADOSAMENTE el 'title' y determinar cuál de esas URLs pertenece al equipo real.
Regla Crítica: ¡Descarta inmediatamente repuestos, cables, accesorios, partes usadas o modelos equivocados!

Genera un JSON con este formato exacto para el backend:
{
  "marketplaces": [
    {
      "name": "Nombre de la tienda (ej: MercadoLibre)",
      "currentPrice": (número),
      "url": "URL del producto",
      "isMatch": true/false
    }
  ]
}
Si no hay match, devuelve "marketplaces": [].`
        },
        next: "update-oferty"
      },
      {
        id: "update-oferty",
        type: "API_REQUEST",
        config: {
          method: "PATCH",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{input.productId}}/marketplaces",
          headers: { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" },
          bodyTemplate: "{{nodes.ai-match-offer}}"
        },
        next: null
      }
    ]
  }
];

async function seed() {
  console.log("🚀 Iniciando restauración de pipeline (Hunter)...");

  for (const pipeline of pipelines) {
    console.log(`\n⏳ Procesando pipeline: ${pipeline.pipelineId}...`);
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: TABLES.PIPELINES,
        Item: {
          ...pipeline,
          updatedAt: new Date().toISOString()
        }
      }));
      console.log(`✅ Pipeline ${pipeline.pipelineId} restaurado/actualizado.`);
    } catch (err) {
      console.error(`❌ Error actualizando pipeline ${pipeline.pipelineId}:`, err);
    }
  }

  console.log("\n✨ Proceso de restauración finalizado.");
}

seed();
