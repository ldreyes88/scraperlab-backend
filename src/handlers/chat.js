// src/handlers/chat.js
const AgentOrchestratorService = require('../services/AgentOrchestratorService');
const ChatSessionRepository = require('../repositories/ChatSessionRepository');
const BotRepository = require('../repositories/BotRepository');

/**
 * Enviar mensaje al bot (Endpoint público para widgets web y canales)
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { botId = 'scrapy', sessionId, message, history = [], channel = 'web', mode } = req.body;

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
      channel,
      mode
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
 * Listar todas las sesiones y leads (Panel de administración global o filtrado por empresa)
 */
exports.getAllSessions = async (req, res, next) => {
  try {
    const { botId, hasLead, limit = 20, page, from, to, search } = req.query;
    const tenant = req.tenant;

    let allowedClientIds = null;
    let enterpriseBotIds = null;

    if (tenant && !tenant.isAdmin && tenant.isEnterprise) {
      allowedClientIds = tenant.clientIds;
      const botsArrays = await Promise.all(tenant.clientIds.map(cId => BotRepository.getByClientId(cId)));
      enterpriseBotIds = botsArrays.flat().map(b => b.botId);
    }

    // Si viene page o from o to o search, responder con paginación
    if (page !== undefined || from || to || search) {
      const currentPage = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 20;

      const result = await ChatSessionRepository.getPaginated(currentPage, pageSize, {
        clientIds: allowedClientIds,
        enterpriseBotIds,
        botId: botId || null,
        hasLead: hasLead === 'true',
        from,
        to,
        search
      });

      return res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    }

    let sessions = await ChatSessionRepository.getAllSessions({
      botId: botId || null,
      hasLead: hasLead === 'true',
      limit: parseInt(limit, 10)
    });

    // Si el usuario no es admin y pertenece a empresas, aislar sólo a las sesiones de sus empresas o bots
    if (tenant && !tenant.isAdmin && tenant.isEnterprise) {
      sessions = sessions.filter(
        s => tenant.clientIds.includes(s.clientId) || enterpriseBotIds.includes(s.botId)
      );
    }

    return res.json({
      success: true,
      data: sessions,
      total: sessions.length
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
