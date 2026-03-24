// src/services/AIService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('GEMINI_API_KEY no configurado en variables de entorno');
    }
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  async generateContent(prompt, modelName = 'gemini-1.5-flash', config = {}) {
    if (!this.genAI) {
      throw new Error('Google Generative AI no inicializado - Falta API Key');
    }

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.95,
          maxOutputTokens: config.max_output_tokens ?? 2048,
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  async generateJSON(prompt, modelName = 'gemini-1.5-flash', config = {}) {
    // Forzar respuesta JSON mediante el prompt por ahora
    const jsonPrompt = `${prompt}\n\nResponde ÚNICAMENTE con un objeto JSON válido.`;
    const response = await this.generateContent(jsonPrompt, modelName, config);
    
    try {
      // Limpiar Markdown si existe (vienen con ```json ... ``` a veces)
      const cleaned = response.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Error parsing JSON from Gemini:', response);
      throw new Error('La respuesta de la IA no es un JSON válido');
    }
  }
}

module.exports = new AIService();
