// src/services/AIService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('GEMINI_API_KEY no configurado en variables de entorno');
    }
    // Usamos v1 para mayor estabilidad con modelos 1.5
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey, { apiVersion: 'v1' }) : null;
  }

  async generateContent(prompt, modelName = 'gemini-2.5-flash', config = {}) {
    if (!this.genAI) {
      throw new Error('Google Generative AI no inicializado - Falta API Key');
    }

    // Limpieza de nombre y migración automática desde 1.5 (retirados) a 2.5
    let cleanModelName = modelName?.trim() || 'gemini-2.5-flash';
    if (cleanModelName === 'gemini-1.5-flash' || cleanModelName.includes('1.5-flash')) {
      cleanModelName = 'gemini-2.5-flash';
    } else if (cleanModelName === 'gemini-1.5-pro' || cleanModelName.includes('1.5-pro')) {
      cleanModelName = 'gemini-2.5-pro';
    }
    
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: cleanModelName,
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

  async generateJSON(prompt, modelName = 'gemini-2.5-flash', config = {}) {
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
