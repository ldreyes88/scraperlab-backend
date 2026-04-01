require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const PIELINE_ID = 'gemini-catalog-builder';
const SUPER_PROMPT = `# INSTRUCCIÓN DE GENERACIÓN DE CATÁLOGO (OFERTY AI)
Actúa como un Ingeniero de Datos experto en el catálogo de Oferty. Tu objetivo es generar un JSON estructurado para el término: "{{input.product_family_name}}" basado en los resultados de búsqueda previos: {{nodes.rag_search.data.results}}.

# CONTEXTO TÉCNICO (MODELO DE DATOS)
Debes seguir este esquema de Single-Table Design:

### 👨‍👩‍👧 FAMILIA (family)
- 'familyName': Nombre comercial (ej: "iPhone 16 Pro Max").
- 'brand': Marca oficial (ej: "Apple").
- 'category': Categoría principal (ej: "Celulares").
- 'genericSpecs': Objeto con specs comunes (Procesador, OS, etc.).
- 'variantFields': Array con nombres de campos que varían (ej: ["Color", "Capacidad"]).

### 📦 PRODUCTOS (products)
- 'name': Nombre completo de la variante.
- 'specs': Especificaciones técnicas totales.
- 'variantSpecs': Solo valores que lo hacen único (ej: {"Color": "Black", "Capacidad": "256GB"}).
- 'brandName': Marca.
- 'productFamilyName': Nombre de la familia.

# REGLAS CRÍTICAS
1. No inventes campos en español. Usa los nombres en inglés definidos arriba.
2. Si la búsqueda RAG devolvió datos, úsalos para no duplicar.
3. Máximo 4 variantes.
4. Salida: ÚNICAMENTE un objeto JSON válido con las llaves raíz 'family' y 'products'.

{
  "family": { ... },
  "products": [ { ... }, { ... } ]
}`;

async function updatePipeline() {
  try {
    // 1. Obtener pipeline actual
    const getResult = await dynamoDB.send(new GetCommand({
      TableName: TABLES.PIPELINES,
      Key: { pipelineId: PIELINE_ID }
    }));
    
    if (!getResult.Item) {
      console.error('Pipeline no encontrado');
      return;
    }
    
    let pipeline = getResult.Item;
    
    // 2. Localizar y actualizar el nodo gemini_cataloger
    const nodeIndex = pipeline.nodes.findIndex(n => n.id === 'gemini_cataloger');
    if (nodeIndex === -1) {
      console.error('Nodo gemini_cataloger no encontrado en el pipeline');
      return;
    }
    
    pipeline.nodes[nodeIndex].config.promptTemplate = SUPER_PROMPT;
    pipeline.nodes[nodeIndex].config.isJson = true;
    pipeline.nodes[nodeIndex].config.model = 'gemini-2.5-pro'; // Subimos de nivel para mayor precisión técnica
    
    // 3. Guardar cambios
    await dynamoDB.send(new UpdateCommand({
      TableName: TABLES.PIPELINES,
      Key: { pipelineId: PIELINE_ID },
      UpdateExpression: 'set nodes = :n, updatedAt = :u',
      ExpressionAttributeValues: {
        ':n': pipeline.nodes,
        ':u': new Date().toISOString()
      }
    }));
    
    console.log('✅ Pipeline actualizado con el Super-Prompt técnico');
  } catch (err) {
    console.error('Error actualizando pipeline:', err);
  }
}

updatePipeline();
