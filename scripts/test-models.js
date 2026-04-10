require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelsToTest = [
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite-001',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-pro-latest'
];

async function testModels() {
  for (const modelName of modelsToTest) {
    console.log(`\nProbando ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hola, esto es una prueba respondiendo rapido 'OK'");
      console.log(`✅ EXITO: ${modelName} -> ${result.response.text().trim()}`);
    } catch (error) {
      console.error(`❌ ERROR en ${modelName}:`, error.message);
    }
  }
}

testModels();
