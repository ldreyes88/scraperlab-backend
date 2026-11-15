// src/handlers/whatsapp.js
const WhatsAppService = require('../services/WhatsAppService');
const BotRepository = require('../repositories/BotRepository');

/**
 * Verificación del Webhook de Meta (WhatsApp Cloud API)
 * Meta realiza una petición GET con hub.mode, hub.verify_token y hub.challenge
 */
exports.verifyWebhook = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    let expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'scraperlabs_whatsapp_verify_token';

    if (botId) {
      const bot = await BotRepository.getById(botId);
      if (bot?.channels?.whatsapp?.verifyToken) {
        expectedToken = bot.channels.whatsapp.verifyToken;
      }
    }

    if (mode === 'subscribe' && token === expectedToken) {
      console.log(`[WhatsApp Webhook] Verificado exitosamente${botId ? ` para el bot ${botId}` : ''}`);
      return res.status(200).send(challenge);
    } else {
      console.warn(`[WhatsApp Webhook] Fallo en la verificación. Token recibido: ${token}, Token esperado: ${expectedToken}`);
      return res.status(403).json({ error: 'Verification token mismatch' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Recepción de eventos y mensajes entrantes de Meta (WhatsApp Cloud API)
 * Meta envía una petición POST cuando el usuario envía un mensaje
 */
exports.handleWebhook = async (req, res, next) => {
  try {
    const { botId } = req.params;
    const payload = req.body;

    // En AWS Lambda NO podemos dejar promesas flotantes en segundo plano
    // porque el runtime congela el contenedor al responder. Esperamos el procesamiento:
    try {
      await WhatsAppService.handleIncomingWebhook(payload, botId);
    } catch (err) {
      console.error('[WhatsApp Webhook Error] Falló procesamiento de mensaje entrante:', err);
    }

    return res.status(200).json({ status: 'EVENT_RECEIVED' });
  } catch (error) {
    console.error('[WhatsApp Webhook Handler Error]:', error);
    return res.status(200).json({ status: 'EVENT_RECEIVED' });
  }
};

/**
 * Endpoint manual para enviar un mensaje de prueba o notificación vía WhatsApp
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { to, text, botId } = req.body;

    if (!to || !text) {
      return res.status(400).json({
        success: false,
        message: 'Los campos "to" y "text" son requeridos'
      });
    }

    let bot = null;
    if (botId) {
      bot = await BotRepository.getById(botId);
    }

    const result = await WhatsAppService.sendTextMessage({ to, text, bot });

    return res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
