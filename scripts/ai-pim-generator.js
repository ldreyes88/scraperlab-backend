// Archivo: scripts/ai-pim-generator.js
// Prueba Conceptual Fase 1: El Cerebro (Generación de JSON perfecto para DynamoDB)

require('dotenv').config();

// Debes instalar: npm install @google/genai
const { GoogleGenAI, Type } = require('@google/genai');

// Recomiendo encarecidamente Gemini 1.5 Pro para estructuración compleja
const MODEL_NAME = 'gemini-2.5-flash'; 

async function generateOfertyProduct(productQuery) {
  // Asegurarse de tener la llave de API configurada en el root .env de scraperlab-backend
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: No se encontró la variable GEMINI_API_KEY en tu .env");
    console.log("Puedes conseguir una gratis en: https://aistudio.google.com/");
    return;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  console.log(`🧠 Iniciando agente IA para el producto: "${productQuery}"...`);

  const prompt = `
  Eres un experto en ecommerce y Head of Catalog para una tienda de Colombia.
  Dado el siguiente nombre de producto que buscó el usuario: "${productQuery}", 
  genera el perfil de datos estricto bajo nuestro formato en JSON.
  
  Instrucciones estrictas:
  1. brandName debe ser capitalizado (Ej: Apple, Samsung).
  2. category / parentCategory deben ser categorías de ecommerce lógicas (Ej: Celulares, Tecnología).
  3. specs debe contener todas las especificaciones técnicas del equipo (procesador, ram, almacenamiento, cámara, batería, pantalla).
  4. variants deben incluir variantes comunes de este equipo (como color y almacenamiento).
  5. Asegúrate de generar un productFamilyId entendible, todo en minúscula y separado por guiones.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        // Obligamos a Gemini a responder única y exclusivamente en el molde de DynamoDB
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            "name": { type: Type.STRING, description: "Nombre completo y atractivo de venta del producto base" },
            "brandName": { type: Type.STRING, description: "Marca" },
            "modelName": { type: Type.STRING, description: "Modelo específico sin la marca" },
            "category": { type: Type.STRING, description: "Subcategoría, Ej: Celulares" },
            "parentCategory": { type: Type.STRING, description: "Categoría padre, Ej: Tecnología" },
            "productFamilyId": { type: Type.STRING, description: "Slug del producto. Ej: samsung-galaxy-s24-ultra" },
            "description": { type: Type.STRING, description: "Breve descripción orientada a SEO y venta" },
            "globalRating": { type: Type.NUMBER, description: "Valor aleatorio entre 4.0 y 5.0" },
            "specs": { 
              type: Type.OBJECT, 
              // Podemos dejar que la IA deduzca las llaves libremente para mayor flexibilidad
              // Pero en Structured Outputs, si forzamos el esquema, es mejor dejar un description claro:
              description: "Objeto llave-valor con procesador, ram, almacenamiento, camara, etc."
            },
            "variantType": {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de posibles strings de variantes. Ej: ['color', 'storage']"
            }
          },
          required: ["name", "brandName", "modelName", "category", "parentCategory", "productFamilyId", "specs", "variantType"]
        }
      }
    });

    console.log("✅ JSON Generado Exitosamente por la IA:\n");
    
    // Parseamos el resultado que Gemini garantiza que es JSON
    const productoGenerado = JSON.parse(response.text);
    
    // Aquí es donde ensamblas el registro definitivo de DynamoDB
    const dyamoRecord = {
      PK: `PRODUCT#PENDING`, // Inicialmente entra a revisión
      SK: "METADATA",
      ...productoGenerado,
      updatableStatus: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(JSON.stringify(dyamoRecord, null, 2));
    
    console.log("\n🚀 Siguiente paso propuesto (Fase 2): Usar 'brandName', 'modelName' para buscar links automáticamente.");

  } catch (error) {
    console.error("❌ Error de la IA:", error.message);
  }
}

// Ejemplo de Run local: node scripts/ai-pim-generator.js "Samsung S25 Ultra 512GB"
const query = process.argv[2] || "Nintendo Switch OLED - Modelo Blanco";
generateOfertyProduct(query);
