/**
 * Servicio de Chatbot para oferty-backend
 * Conecta con el motor de agentes e IA de ScraperLabs
 * 
 * Ubicación recomendada en oferty-backend:
 * src/services/chatService.js
 */

const SCRAPERLABS_API_URL = process.env.SCRAPERLABS_API_URL || 'https://api.scraperlabs.com.co';
const SCRAPERLABS_API_KEY = process.env.SCRAPERLABS_API_KEY || '';

class OfertyChatService {
  /**
   * Procesa una consulta enviándola al orquestador de ScraperLabs
   * @param {Object} params
   * @param {string} params.message - Mensaje del usuario
   * @param {string} params.sessionId - ID de sesión del usuario
   * @param {Array} params.history - Historial de conversación
   * @returns {Promise<Object>} Respuesta del bot Oferty
   */
  static async sendMessage({ message, sessionId, history = [] }) {
    if (!message || message.trim() === '') {
      throw new Error('El mensaje no puede estar vacío');
    }

    const payload = {
      botId: 'oferty',
      clientId: 'oferty',
      sessionId: sessionId || null,
      message: message.trim(),
      history: history.slice(-6),
      channel: 'web'
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (SCRAPERLABS_API_KEY) {
      headers['x-api-key'] = SCRAPERLABS_API_KEY;
    }

    const response = await fetch(`${SCRAPERLABS_API_URL}/api/chat/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en API ScraperLabs (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    return json.data;
  }
}

module.exports = OfertyChatService;
