// Archivo: scripts/ai-pim-generator.js
// Prueba Conceptual Fase 1: El Cerebro (Generación de JSON perfecto para DynamoDB)

require('dotenv').config();

// Debes instalar: npm install @google/genai
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// Recomiendo usar Gemini Flash Lite Latest para evadir los servidores con alta demanda (error 503)
const MODEL_NAME = 'gemini-flash-lite-latest'; 

async function generateOfertyProduct(productQuery) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: No se encontró la variable GEMINI_API_KEY en tu .env");
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          family: {
            type: SchemaType.OBJECT,
            properties: {
              familyName: { type: SchemaType.STRING, description: "Nombre de la familia (ej: iPhone 15 Series)" },
              brand: { type: SchemaType.STRING, description: "Marca capitalizada" },
              category: { type: SchemaType.STRING, description: "Categoría principal" },
              genericSpecs: { type: SchemaType.OBJECT, description: "Specs compartidas por todos" }
            },
            required: ["familyName", "brand", "category", "genericSpecs"]
          },
          products: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Nombre completo de la variante" },
                variantType: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                specs: { type: SchemaType.OBJECT, description: "Specs técnicas completas" },
                variantSpecs: { type: SchemaType.OBJECT, description: "Valores específicos de la variante" }
              },
              required: ["name", "variantType", "specs", "variantSpecs"]
            }
          }
        },
        required: ["family", "products"]
      }
    }
  });

  console.log(`🧠 Iniciando PROMPT MAESTRO para: "${productQuery}"...`);

  const prompt = `
  Eres un experto en ecommerce y Head of Catalog para una tienda de Colombia.
  Genera el catálogo técnico estricto para el término: "${productQuery}".
  
  Instrucciones:
  1. Identifica la familia correcta.
  2. Genera hasta 4 variantes representativas (colores, capacidades).
  3. Asegura que variantType sea siempre un array de strings.
  4. Responde con el JSON estructurado.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const productoGenerado = JSON.parse(response.text());

    console.log("✅ Catálogo Generado Exitosamente:\n");
    console.log(JSON.stringify(productoGenerado, null, 2));

  } catch (error) {
    console.error("❌ Error de la IA:", error.message);
  }
}
// Ejemplo de Run local: node scripts/ai-pim-generator.js "Samsung S25 Ultra 512GB"

// Ejemplo de Run local: node scripts/ai-pim-generator.js "Samsung S25 Ultra 512GB"
const query = process.argv[2] || "Nintendo Switch OLED - Modelo Blanco";
generateOfertyProduct(query);
