// src/handlers/chat.js
const AgentOrchestratorService = require('../services/AgentOrchestratorService');
const ChatSessionRepository = require('../repositories/ChatSessionRepository');

/**
 * Enviar mensaje al bot (Endpoint público para widgets web y canales)
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { botId = 'scrapy', sessionId, message, history = [], channel = 'web' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'El campo message es requerido'
      });
    }

    const response = await AgentOrchestratorService.processMessage({
      botId,
      sessionId,
      message,
      history,
      channel
    });

    return res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Guardar lead explícitamente desde formulario o modal
 */
exports.saveLead = async (req, res, next) => {
  try {
    const { sessionId, leadData } = req.body;

    if (!sessionId || !leadData) {
      return res.status(400).json({
        success: false,
        message: 'sessionId y leadData son requeridos'
      });
    }

    const updated = await ChatSessionRepository.updateLead(sessionId, leadData);

    return res.json({
      success: true,
      message: 'Lead registrado exitosamente',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener historial de una sesión de chat
 */
exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSessionRepository.getById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Sesión ${sessionId} no encontrada`
      });
    }

    return res.json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar sesiones de un bot específico (Panel de administración)
 */
exports.getBotSessions = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const { limit = 50 } = req.query;

    const sessions = await ChatSessionRepository.getByBotId(botId, parseInt(limit, 10));

    return res.json({
      success: true,
      data: sessions,
      total: sessions.length
    });
  } catch (error) {
    next(error);
  }
};
