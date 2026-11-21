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
   * @param {string} params.to - Número de destino o user_id de WhatsApp
   * @param {string} params.text - Mensaje a enviar
   * @param {string} [params.contextMessageId] - ID del mensaje recibido al cual se responde (wamid)
   * @param {Object} [params.bot] - Instancia del bot con credenciales personalizadas
   * @param {string} [params.previewUrl] - Booleano para activar vista previa de URLs
   */
  static async sendTextMessage({ to, text, contextMessageId = null, bot = null, previewUrl = false }) {
    if (!to || !text) {
      throw new Error('Parámetros "to" y "text" son obligatorios para enviar mensaje por WhatsApp');
    }

    // Si es un user_id de WhatsApp (ej: "CO.1664368808670870"), se envía tal cual.
    // Si es un número telefónico tradicional, dejamos únicamente los dígitos.
    const isUserId = typeof to === 'string' && to.includes('.');
    const cleanTo = isUserId ? to.trim() : String(to).replace(/\D/g, '');
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

    // Para usuarios con WhatsApp Username / user_id, vincular el contextMessageId
    // garantiza que Meta entregue el mensaje directamente en el hilo de conversación correspondiente
    if (contextMessageId) {
      payload.context = {
        message_id: contextMessageId
      };
    }

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
    // Meta v21+ puede enviar el número en `from` o un identificador de usuario `from_user_id` / `user_id`
    // cuando el usuario tiene configurada privacidad por Username.
    const contactObj = value.contacts?.[0] || {};
    const fromNumber = messageObj.from || contactObj.wa_id || messageObj.from_user_id || contactObj.user_id;
    const businessPhoneNumberId = value.metadata?.phone_number_id; // ID del número receptor de la empresa
    const contactName = contactObj.profile?.name || contactObj.profile?.username || '';

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
      const allBots = await BotRepository.getAll();
      targetBot = allBots.find(b => b.botId === 'lubricantes-caribe' || b.botId === 'caribe-partes' || b.botId === 'llantas' || b.botId === 'oferty' || b.botId === 'scrapy') || allBots[0];
    }

    const botId = targetBot?.botId || 'scrapy';
    const sessionId = `wa_${botId}_${fromNumber}`;

    console.log(`[WhatsAppService] Mensaje recibido de ${contactName} (${fromNumber}): "${userText}" -> Asignado a Bot: ${botId}`);

    // Construir perfil estructurado del contacto para Leads & Chats
    const isPhoneNumber = fromNumber && /^\d+$/.test(fromNumber);
    const userContact = {
      phone: isPhoneNumber ? fromNumber : (contactObj.wa_id || null),
      name: contactObj.profile?.name || contactName || null,
      username: contactObj.profile?.username || null,
      userId: contactObj.user_id || messageObj.from_user_id || null,
      rawIdentifier: fromNumber
    };

    // 2. Procesar a través del AgentOrchestratorService
    const AgentOrchestratorService = require('./AgentOrchestratorService');
    const orchestratorResult = await AgentOrchestratorService.processMessage({
      botId,
      sessionId,
      message: userText,
      channel: 'whatsapp',
      mode: targetBot?.defaultMode || null,
      userContact,
      metadata: {
        whatsappPhoneId: businessPhoneNumberId,
        messageId: messageObj.id,
        userContact
      }
    });

    // Si la sesión está en control humano, NO enviar respuesta automática de IA por WhatsApp
    if (orchestratorResult?.silent || orchestratorResult?.humanTakeover) {
      console.log(`[WhatsAppService] Mensaje entrante procesado pero no respondido por IA debido a HUMAN TAKEOVER en sesión ${sessionId}`);
      return {
        success: true,
        silent: true,
        humanTakeover: true,
        botId,
        fromNumber,
        contactName,
        query: userText
      };
    }

    const replyText = orchestratorResult?.reply || 'Lo siento, en este momento no pude procesar tu solicitud.';

    // 3. Enviar la respuesta de vuelta por WhatsApp
    const sendResult = await this.sendTextMessage({
      to: fromNumber,
      text: replyText,
      contextMessageId: messageObj.id,
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
