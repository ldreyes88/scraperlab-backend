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

  async generateContent(prompt, modelName = 'gemini-flash-lite-latest', config = {}) {
    if (!this.genAI) {
      throw new Error('Google Generative AI no inicializado - Falta API Key');
    }

    // Limpieza de nombre y migración automática para evitar 503 (High Demand)
    let cleanModelName = modelName?.trim() || 'gemini-flash-lite-latest';
    
    // Si se solicita un modelo de alta demanda o una versión antigua, redirigimos a Flash Lite para estabilidad
    if (cleanModelName.includes('2.5-flash') || cleanModelName.includes('1.5-flash')) {
      cleanModelName = 'gemini-flash-lite-latest';
    }
    
    
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: cleanModelName,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.95,
          maxOutputTokens: config.max_output_tokens ?? 8192,
          responseMimeType: config.responseMimeType || 'text/plain'
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

  async generateJSON(prompt, modelName = 'gemini-flash-lite-latest', config = {}) {
    // Forzamos modo JSON nativo y una temperatura más baja para mayor precisión técnica
    const jsonConfig = { 
      temperature: 0.4,
      ...config, 
      responseMimeType: 'application/json' 
    };
    const response = await this.generateContent(prompt, modelName, jsonConfig);
    
    try {
      // Limpiar Markdown si existe (fallback por si acaso)
      const cleaned = response.replace(/```(json)?|```/gi, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Error parsing JSON from Gemini:', response);
      throw new Error('La respuesta de la IA no es un JSON válido');
    }
  }
}

module.exports = new AIService();
