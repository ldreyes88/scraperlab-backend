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
    pipelineId: "gemini-catalog-builder",
    name: "Pipeline Generador de Catálogo AI",
    description: "Generación experta de familias y productos variantes con contexto RAG",
    enabled: true,
    nodes: [
      {
        id: "Start",
        type: "TRIGGER",
        config: { inputType: "product_family_name" },
        next: "Rag_Search"
      },
      {
        id: "Rag_Search",
        type: "API_REQUEST",
        config: {
          method: "GET",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/search?q={{input.product_family_name}}",
          headers: { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" }
        },
        next: "Gemini_Cataloger"
      },
      {
        id: "Gemini_Cataloger",
        type: "AI_PROMPT",
        config: {
          model: "gemini-2.5-pro",
          isJson: true,
          promptTemplate: `Eres un experto en ecommerce y Head of Catalog para una tienda de Colombia.
Dado el siguiente nombre de producto que buscó el usuario: "{{input.product_family_name}}", 
genera el perfil de datos estricto bajo nuestro formato en JSON.

BASE DE CONOCIMIENTO (contexto actual en BD): {{nodes.Rag_Search.data}}

Instrucciones estrictas:
1. Responde ÚNICAMENTE con un objeto JSON.
2. La estructura debe ser: { "family": { ... }, "products": [ ... ] }.
3. En "family":
   - familyName: Nombre descriptivo de la familia (ej: "iPhone 15 Series").
   - brand: Marca (ej: "Apple").
   - category: Categoría principal (ej: "Celulares").
   - genericSpecs: Objeto con specs que comparten todos los modelos.
4. En "products" (máximo 4 variantes):
   - name: Nombre completo de la variante (ej: "iPhone 15 Pro Max 256GB Titanio").
   - variantType: Array de strings con los tipos de variante (ej: ["color", "capacidad"]).
   - specs: Objeto con especificaciones técnicas completas.
   - variantSpecs: Objeto con los valores específicos de la variante (ej: {"color": "Titanio", "capacidad": "256GB"}).

Asegúrate de que variantType sea SIEMPRE un array de strings. El estado inicial de todos será active: false.`
        },
        next: "Ingest_Catalog"
      },
      {
        id: "Ingest_Catalog",
        type: "API_REQUEST",
        config: {
          method: "POST",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/ai/catalogs",
          headers: { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" },
          bodyTemplate: "{{nodes.Gemini_Cataloger}}"
        },
        next: null
      }
    ]
  },
  {
    pipelineId: "product-hunter",
    name: "Hunter de Precios Seleccionado",
    description: "Busca precios en vivo para un producto específico en marketplaces colombianos",
    enabled: true,
    nodes: [
      {
        id: "Start",
        type: "TRIGGER",
        config: { inputType: { productId: "string", name: "string", category: "string" } },
        next: "AI_Select_Sources"
      },
      {
        id: "AI_Select_Sources",
        type: "AI_PROMPT",
        config: {
          model: "gemini-2.5-flash",
          isJson: true,
          promptTemplate: "Analiza el producto '{{input.name}}'. Selecciona los dominios más relevantes para buscar su precio en Colombia de esta lista: ['exito.com', 'mercadolibre.com.co', 'falabella.com.co', 'alkosto.com', 'ktronix.com']. Responde un JSON con el campo 'domainIds' (array)."
        },
        next: "Hunter_Search"
      },
      {
        id: "Hunter_Search",
        type: "SCRAPE_SEARCH",
        config: {
          domainIds: "{{nodes.AI_Select_Sources.domainIds}}",
          queryTemplate: "{{input.name}}",
          limit: 3
        },
        next: "AI_Match_Offer"
      },
      {
        id: "AI_Match_Offer",
        type: "AI_PROMPT",
        config: {
          model: "gemini-2.5-flash",
          isJson: true,
          promptTemplate: `Eres un asistente robótico para data scraping y control de calidad.
El producto maestro que estamos buscando es: {{input.name}}.

Acabamos de raspar una tienda online y devolvió estos candidatos:
{{nodes.Hunter_Search}}

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
        next: "Update_Marketplaces"
      },
      {
        id: "Update_Marketplaces",
        type: "API_REQUEST",
        config: {
          method: "PATCH",
          url: "{{config.OFERTY_INTERNAL_API_URL}}/api/internal/products/{{input.Start.productId}}/marketplaces",
          headers: { "x-internal-api-key": "{{config.OFERTY_INTERNAL_API_KEY}}" },
          bodyTemplate: "{{nodes.AI_Match_Offer}}"
        },
        next: null
      }
    ]
  }
];

async function seed() {
  console.log("🚀 Iniciando restauración de pipelines (Generación y Hunter)...");

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
