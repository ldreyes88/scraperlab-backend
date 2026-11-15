// src/services/WhatsAppService.js
const axios = require('axios');
const BotRepository = require('../repositories/BotRepository');

class WhatsAppService {
  /**
   * Resuelve las credenciales de WhatsApp Cloud API para un bot o empresa específica.
   * Si el bot tiene configuración propia en `bot.channels.whatsapp`, se utiliza esa;
   * de lo contrario, recurre a las variables de entorno globales.
   */
  static getWhatsAppCredentials(bot = null) {
    const channelConfig = bot?.channels?.whatsapp || {};
    
    const phoneNumberId = channelConfig.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const accessToken = channelConfig.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
    const verifyToken = channelConfig.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'scraperlabs_whatsapp_verify_token';
    const apiVersion = channelConfig.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0';

    return {
      phoneNumberId,
      accessToken,
      verifyToken,
      apiVersion,
      isEnabled: channelConfig.enabled !== false
    };
  }

  /**
   * Envía un mensaje de texto a través de WhatsApp Cloud API (Meta Graph API)
   * @param {Object} params
   * @param {string} params.to - Número de destino con código de país (ej: "573001234567")
   * @param {string} params.text - Mensaje a enviar
   * @param {Object} [params.bot] - Instancia del bot con credenciales personalizadas
   * @param {string} [params.previewUrl] - Booleano para activar vista previa de URLs
   */
  static async sendTextMessage({ to, text, bot = null, previewUrl = false }) {
    if (!to || !text) {
      throw new Error('Parámetros "to" y "text" son obligatorios para enviar mensaje por WhatsApp');
    }

    const cleanTo = String(to).replace(/\D/g, ''); // Solo dígitos
    const credentials = this.getWhatsAppCredentials(bot);

    if (!credentials.phoneNumberId || !credentials.accessToken) {
      console.warn(`[WhatsAppService] No se enviará mensaje a ${cleanTo}: Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN`);
      return {
        success: false,
        error: 'Credenciales de WhatsApp Cloud API no configuradas (phoneNumberId o accessToken)'
      };
    }

    const url = `https://graph.facebook.com/${credentials.apiVersion}/${credentials.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: Boolean(previewUrl),
        body: text
      }
    };

    try {
      console.log(`[WhatsAppService] Enviando mensaje a ${cleanTo} usando PhoneID: ${credentials.phoneNumberId}`);
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data || error.message;
      console.error(`[WhatsAppService] Error enviando mensaje a ${cleanTo} (${status}):`, JSON.stringify(errorData));
      return {
        success: false,
        status,
        error: errorData
      };
    }
  }

  /**
   * Procesa el payload entrante de un webhook de WhatsApp Cloud API
   * y responde al usuario utilizando el AgentOrchestratorService del bot asignado.
   * @param {Object} payload - Body de la petición del webhook de Meta
   * @param {string} [defaultBotId] - Bot ID a utilizar si el webhook no especifica otro
   */
  static async handleIncomingWebhook(payload, defaultBotId = null) {
    // Validar estructura de WhatsApp Cloud API
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || !value.messages || value.messages.length === 0) {
      // Puede ser una notificación de estado (sent, delivered, read)
      return { ignored: true, reason: 'No es un mensaje entrante de usuario' };
    }

    const messageObj = value.messages[0];
    const fromNumber = messageObj.from; // Número del cliente que escribe
    const businessPhoneNumberId = value.metadata?.phone_number_id; // ID del número receptor de la empresa
    const contactName = value.contacts?.[0]?.profile?.name || '';

    // Extraer texto según tipo de mensaje
    let userText = '';
    if (messageObj.type === 'text') {
      userText = messageObj.text?.body || '';
    } else if (messageObj.type === 'interactive') {
      userText = messageObj.interactive?.button_reply?.title || messageObj.interactive?.list_reply?.title || '';
    } else {
      console.log(`[WhatsAppService] Tipo de mensaje no soportado actualmente: ${messageObj.type}`);
      return { ignored: true, reason: `Tipo ${messageObj.type} no soportado` };
    }

    if (!userText.trim()) {
      return { ignored: true, reason: 'Mensaje vacío' };
    }

    // 1. Identificar el Bot correspondiente
    let targetBot = null;

    if (defaultBotId) {
      targetBot = await BotRepository.getById(defaultBotId);
    }

    // Si no vino botId por parámetro o no se encontró, buscar qué bot tiene este businessPhoneNumberId
    if (!targetBot && businessPhoneNumberId) {
      const allBots = await BotRepository.getAll();
      targetBot = allBots.find(b => 
        b.channels?.whatsapp?.phoneNumberId === businessPhoneNumberId ||
        b.channels?.whatsapp?.phoneNumber === businessPhoneNumberId
      );
    }

    // Fallback si aún no encontramos bot específico
    if (!targetBot) {
      // Si hay un bot de llantas o default
      const allBots = await BotRepository.getAll();
      targetBot = allBots.find(b => b.botId === 'llantas' || b.botId === 'oferty' || b.botId === 'scrapy') || allBots[0];
    }

    const botId = targetBot?.botId || 'scrapy';
    const sessionId = `wa_${botId}_${fromNumber}`;

    console.log(`[WhatsAppService] Mensaje recibido de ${contactName} (${fromNumber}): "${userText}" -> Asignado a Bot: ${botId}`);

    // 2. Procesar a través del AgentOrchestratorService
    const AgentOrchestratorService = require('./AgentOrchestratorService');
    const orchestratorResult = await AgentOrchestratorService.processMessage({
      botId,
      sessionId,
      message: userText,
      channel: 'whatsapp',
      mode: targetBot?.defaultMode || null
    });

    const replyText = orchestratorResult?.reply || 'Lo siento, en este momento no pude procesar tu solicitud.';

    // 3. Enviar la respuesta de vuelta por WhatsApp
    const sendResult = await this.sendTextMessage({
      to: fromNumber,
      text: replyText,
      bot: targetBot
    });

    return {
      success: true,
      botId,
      fromNumber,
      contactName,
      query: userText,
      reply: replyText,
      sendResult
    };
  }
}

module.exports = WhatsAppService;
