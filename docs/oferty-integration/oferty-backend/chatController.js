/**
 * Controlador de Chat para oferty-backend
 * Endpoint: POST /api/chat
 * 
 * Ubicación recomendada en oferty-backend:
 * src/controllers/chatController.js
 */

const OfertyChatService = require('../services/chatService');

exports.handleChatMessage = async (req, res, next) => {
  try {
    const { message, sessionId, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El campo message es requerido'
      });
    }

    const chatResponse = await OfertyChatService.sendMessage({
      message,
      sessionId,
      history: Array.isArray(history) ? history : []
    });

    return res.json({
      success: true,
      data: chatResponse
    });
  } catch (error) {
    console.error('[OfertyChatController] Error procesando mensaje:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error procesando la consulta con el asistente de Oferty',
      error: error.message
    });
  }
};
