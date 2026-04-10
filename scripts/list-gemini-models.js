require('dotenv').config();

async function listSupportedModels() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: No se encontró la variable GEMINI_API_KEY en tu .env");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("=== Modelos y métodos soportados ===");
      data.models.forEach(model => {
        if (model.name.includes("gemini")) {
          console.log(`- Modelo: ${model.name}`);
          console.log(`  Métodos: ${model.supportedGenerationMethods.join(', ')}`);
        }
      });
    } else {
      console.error("Error obteniendo modelos:", data);
    }
  } catch (error) {
    console.error("Error de petición:", error.message);
  }
}

listSupportedModels();
