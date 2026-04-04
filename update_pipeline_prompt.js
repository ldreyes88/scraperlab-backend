require('dotenv').config();
const { dynamoDB, TABLES } = require('./src/config/database');
const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const PIELINE_ID = 'gemini-catalog-builder';

const SUPER_PROMPT = `# INSTRUCCIÓN DE GENERACIÓN DE CATÁLOGO (OFERTY AI)
Actúa como un Ingeniero de Datos experto en el catálogo de Oferty. Tu objetivo es generar un JSON estructurado para el término: "{{input.product_family_name}}" basado en los resultados de búsqueda previos: {{nodes.rag_search.data.results}}.

# CONTEXTO TÉCNICO (MODELO DE DATOS)
Debes seguir este esquema de Single-Table Design:

### 👨‍👩‍👧 FAMILIA (family)
- 'familyName': Nombre comercial base sin variantes (ej: "Motorola Edge 60").
- 'brand': Marca oficial (ej: "Motorola").
- 'category': Categoría principal (Ver listado abajo).
- 'genericSpecs': Objeto con specs comunes (Procesador, OS, etc.). 
  REGLA: Las LLAVES deben estar en MINÚSCULAS. Los VALORES deben conservar su formato natural (ej: "Snapdragon 8 Gen 3").
- 'variantFields': Array con nombres de campos que varían en MINÚSCULAS (ej: ["color", "storage", "ram"]).

### 📦 PRODUCTOS (products)
- 'name': Nombre completo de la variante. REGLA: Si tiene color, debe terminar en "- {Color}" (ej: "Motorola Edge 60 512GB - Verde").
- 'brand': Marca del producto.
- 'model': Referencia o SKU técnico del fabricante.
- 'description': Detalle corto del producto.
- 'category': Subcategoría del listado.
- 'parentCategory': Categoría principal.
- 'brandName': Marca.
- 'productFamilyName': Nombre de la familia.
- 'specs': Ficha técnica completa. DEBE incluir la combinación de 'genericSpecs' de la familia + los valores específicos de la variante. 
  REGLA: Las LLAVES deben estar en MINÚSCULAS. Los VALORES deben conservar su formato natural (ej: "Gris Titanio").
- 'variantType': Array con los nombres de las variantes en MINÚSCULAS.
- 'variantSpecs': Objeto con las especificaciones que varían. 
  REGLA CRÍTICA: Las LLAVES deben estar en MINÚSCULAS. Los VALORES deben conservar su formato natural (ej: "512GB").

### 📂 LISTADO OFICIAL DE CATEGORÍAS (Usar estos valores EXACTOS)
1. Tecnología (parentCategory: "Tecnologia")
   - Subcategorías: "Celulares", "Computadores", "Tablets", "Tecnologia-Accesorios"
2. Moda (parentCategory: "Moda")
   - Subcategorías: "Infantil", "Dama", "Caballero", "Calzado"
3. Electrodomésticos (parentCategory: "Electrodomesticos")
   - Subcategorías: "Televisores", "Neveras", "Lavadoras", "Aires-Acondicionados", "Pequenos-Electrodomesticos"

# REGLAS CRÍTICAS
1. LLAVES EN MINÚSCULAS: En 'genericSpecs', 'specs', 'variantType' y 'variantSpecs', las LLAVES deben ser siempre en minúsculas. Los VALORES deben ser precisos y mantener su capitalización original (ej: "Negro Ónix").
2. HERENCIA Y SINCRONIZACIÓN: El campo 'specs' del producto es la unión de las especificaciones comunes y las variantes. Nada que esté en 'variantSpecs' debe faltar en 'specs'.
3. CATEGORÍAS: Usa SOLO los valores del listado oficial. No inventes subcategorías.
4. RAG CONTEXT: Si la búsqueda RAG devuelve datos, úsalos para mayor precisión técnica (especificaciones), pero NUNCA copies nombres o categorías si violan el nuevo formato ( - {Color}). Prioriza ESTE prompt sobre el contexto previo.
5. NOMBRES: Asegura el formato "{Nombre} {Capacidad} - {Color}". 
6. SKU: El campo 'model' debe contener el código de referencia/SKU si está disponible en la búsqueda.
7. Salida: ÚNICAMENTE un objeto JSON válido con las llaves raíz 'family' y 'products'.

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
    pipeline.nodes[nodeIndex].config.model = 'gemini-2.5-flash'; // Tag estable en tu entorno para catálogo
    
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
