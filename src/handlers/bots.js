// src/handlers/bots.js
const BotRepository = require('../repositories/BotRepository');
const BotKnowledgeRepository = require('../repositories/BotKnowledgeRepository');
const BotTrainingService = require('../services/BotTrainingService');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Obtener todos los bots (opcionalmente filtrados por clientId)
 */
exports.getAllBots = async (req, res, next) => {
  try {
    const { clientId } = req.query;
    let bots = [];

    if (clientId) {
      bots = await BotRepository.getByClientId(clientId);
    } else {
      bots = await BotRepository.getAll();
    }

    return res.json({
      success: true,
      data: bots,
      total: bots.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un bot por su ID
 */
exports.getBot = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const bot = await BotRepository.getById(botId);

    if (!bot) {
      return res.status(404).json({
        success: false,
        message: `Bot ${botId} no encontrado`
      });
    }

    return res.json({
      success: true,
      data: bot
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener la base de conocimiento de un bot
 */
exports.getBotKnowledge = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const knowledge = await BotKnowledgeRepository.getByBotId(botId);

    return res.json({
      success: true,
      data: knowledge,
      total: knowledge.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo bot
 */
exports.createBot = async (req, res, next) => {
  try {
    const { botId, name, clientId, systemPrompt, avatarUrl, channels, targetUrls } = req.body;

    if (!botId || !name || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'botId, name y clientId son campos requeridos'
      });
    }

    const existing = await BotRepository.getById(botId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `El bot con ID '${botId}' ya existe`
      });
    }

    const newBot = await BotRepository.create({
      botId,
      name,
      clientId,
      systemPrompt: systemPrompt || '',
      avatarUrl: avatarUrl || '/images/scrapy.png',
      targetUrls: targetUrls || [],
      channels: channels || {
        web: { enabled: true, allowedDomains: ['*'] },
        whatsapp: { enabled: false, phoneNumber: '' }
      },
      branding: req.body.branding || {
        primaryColor: '#4f46e5',
        secondaryColor: '#f97316',
        welcomeMessage: `¡Hola! Soy ${name}. ¿En qué te puedo ayudar hoy?`,
        quickSuggestions: [
          '¿Qué servicios ofrecen?',
          'Cotizar un proyecto',
          'Hablar con un asesor'
        ]
      }
    });

    return res.status(201).json({
      success: true,
      data: newBot,
      message: `Bot ${botId} creado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar configuración de un bot
 */
exports.updateBot = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const updated = await BotRepository.update(botId, req.body);

    return res.json({
      success: true,
      data: updated,
      message: `Bot ${botId} actualizado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un bot y su conocimiento
 */
exports.deleteBot = async (req, res, next) => {
  try {
    const { botId } = req.params;
    await BotKnowledgeRepository.deleteByBotId(botId);
    await BotRepository.delete(botId);

    return res.json({
      success: true,
      message: `Bot ${botId} y su base de conocimiento eliminados exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disparar entrenamiento del bot a partir de URLs
 */
exports.trainBot = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const { targetUrls, options = {} } = req.body;

    const bot = await BotRepository.getById(botId);
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: `Bot ${botId} no encontrado`
      });
    }

    const urlsToTrain = targetUrls || bot.targetUrls || [];
    if (!urlsToTrain || urlsToTrain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay URLs especificadas para entrenar el bot'
      });
    }

    // Iniciar el entrenamiento en background o síncrono si se solicita
    const isSync = req.query.sync === 'true';

    if (isSync) {
      const result = await BotTrainingService.trainBotFromUrls(botId, urlsToTrain, options);
      return res.json(result);
    } else {
      // Disparar en background
      BotTrainingService.trainBotFromUrls(botId, urlsToTrain, options).catch(err => {
        console.error(`[TrainBot Error] Falló entrenamiento background para ${botId}:`, err);
      });

      return res.json({
        success: true,
        message: `Entrenamiento iniciado en segundo plano para el bot ${botId}`,
        targetUrls: urlsToTrain
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint PÚBLICO para el widget web:
 * Retorna solo la configuración visual y de bienvenida sin datos sensibles.
 */
exports.getPublicBotConfig = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const bot = await BotRepository.getById(botId);

    if (!bot) {
      return res.status(404).json({
        success: false,
        message: `Bot ${botId} no encontrado`
      });
    }

    if (!bot.enabled) {
      return res.status(403).json({
        success: false,
        message: `El bot ${botId} se encuentra temporalmente deshabilitado`
      });
    }

    return res.json({
      success: true,
      data: {
        botId: bot.botId,
        name: bot.name,
        avatarUrl: bot.avatarUrl || '/images/scrapy.png',
        branding: bot.branding || {
          primaryColor: '#4f46e5',
          secondaryColor: '#f97316',
          welcomeMessage: `¡Hola! Soy ${bot.name}. ¿En qué puedo ayudarte?`,
          quickSuggestions: ['¿Qué servicios ofrecen?', 'Cotizar un scraping', 'Hablar con un asesor']
        },
        whatsapp: bot.channels?.whatsapp || null,
        status: bot.status
      }
    });
  } catch (error) {
    next(error);
  }
};
