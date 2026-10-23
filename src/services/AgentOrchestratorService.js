// src/services/AgentOrchestratorService.js
const { v4: uuidv4 } = require('uuid');
const BotRepository = require('../repositories/BotRepository');
const ChatSessionRepository = require('../repositories/ChatSessionRepository');
const BotTrainingService = require('./BotTrainingService');
const AIService = require('./AIService');

class AgentOrchestratorService {
  /**
   * Procesa un mensaje de usuario a través del orquestador multi-agente
   */
  static async processMessage({ botId = 'scrapy', sessionId = null, message, history = [], channel = 'web' }) {
    if (!message || message.trim() === '') {
      throw new Error('El mensaje no puede estar vacío');
    }

    const currentSessionId = sessionId || uuidv4();

    // 1. Obtener bot y validar
    let bot = await BotRepository.getById(botId);
    if (!bot) {
      // Fallback a bot Scrapy default
      bot = {
        botId: 'scrapy',
        name: 'Scrapy',
        clientId: 'scraperlab',
        channels: {
          whatsapp: { enabled: true, phoneNumber: '573105741697' }
        }
      };
    }

    // 2. Gestionar sesión en DynamoDB
    let session = await ChatSessionRepository.getById(currentSessionId);
    if (!session) {
      session = await ChatSessionRepository.create({
        sessionId: currentSessionId,
        botId,
        clientId: bot.clientId || 'scraperlab',
        channel
      });
      // Incrementar contador de conversaciones
      BotRepository.incrementMetric(botId, 'totalConversations').catch(() => {});
    }

    // Registrar mensaje del usuario en la sesión
    await ChatSessionRepository.addMessage(currentSessionId, {
      role: 'user',
      content: message
    });

    // 3. AGENTE 1: Triage & Router (Clasificación de Intención)
    const triageResult = await this.routeIntent(message, history, bot);
    console.log(`[Orchestrator] Intención detectada: ${triageResult.intent} (Confianza: ${triageResult.confidence})`);

    let reply = '';
    let action = null;
    let actionData = null;

    // 4. Ejecución del Agente Especializado
    if (triageResult.intent === 'WHATSAPP') {
      // AGENTE ESCALATION / WHATSAPP HANDOFF
      const phone = bot.channels?.whatsapp?.phoneNumber || '573105741697';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const encodedText = encodeURIComponent(`Hola ScraperLabs, estuve hablando con ${bot.name} en la web. Mi consulta es: "${message}"`);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

      reply = `¡Por supuesto! Puedes continuar la conversación de forma directa con nuestro equipo de ingenieros en WhatsApp.`;
      action = 'OPEN_WHATSAPP';
      actionData = { url: waUrl, phoneNumber: phone };

    } else if (triageResult.intent === 'LEAD') {
      // AGENTE LEAD QUALIFIER & CAPTURE
      if (triageResult.entities && Object.keys(triageResult.entities).length > 0) {
        await ChatSessionRepository.updateLead(currentSessionId, triageResult.entities);
        BotRepository.incrementMetric(botId, 'totalLeads').catch(() => {});
      }

      reply = await this.generateLeadResponse(message, history, bot, triageResult.entities);
      action = 'LEAD_CAPTURED';
      actionData = { entities: triageResult.entities };

    } else {
      // AGENTE KNOWLEDGE & RAG (Consulta informativa)
      const knowledgeContext = await BotTrainingService.getKnowledgeContext(bot.botId);
      reply = await this.generateKnowledgeResponse(message, history, bot, knowledgeContext);
    }

    // 5. Registrar respuesta del asistente en la sesión
    await ChatSessionRepository.addMessage(currentSessionId, {
      role: 'assistant',
      content: reply,
      action,
      metadata: actionData
    });

    // Incrementar métrica de mensajes
    BotRepository.incrementMetric(botId, 'totalMessages').catch(() => {});

    return {
      sessionId: currentSessionId,
      botId,
      reply,
      intent: triageResult.intent,
      action,
      actionData,
      quickSuggestions: this.getSuggestionsForIntent(triageResult.intent)
    };
  }

  /**
   * Router Agent: Clasifica la intención y extrae entidades del mensaje
   */
  static async routeIntent(message, history = [], bot) {
    const prompt = `Actúa como el clasificador de intenciones del bot "${bot.name}" para ${bot.clientId}.
Analiza el último mensaje del usuario teniendo en cuenta el historial reciente:

Historial:
${(history || []).slice(-4).map(h => `${h.role}: ${h.content}`).join('\n')}

Último mensaje del usuario: "${message}"

Determina la categoría de intención entre las siguientes:
1. "WHATSAPP": Si el usuario pide explícitamente hablar con un humano, asesor, persona real, o número de WhatsApp.
2. "LEAD": Si el usuario menciona que quiere cotizar, contratar, solicita presupuesto, o comparte datos de contacto (email, teléfono, nombre) o la URL de una página que necesita raspar/extraer.
3. "INFO": Si el usuario hace preguntas informativas sobre servicios, qué es scraping, precios, tecnologías, soporte o dudas generales.
4. "GREETING": Si es un saludo cordial simple (ej: "hola", "buenos días").

Extrae también entidades si las menciona (email, phone, targetUrl, name, company).

Devuelve exclusivamente este JSON:
{
  "intent": "INFO" | "LEAD" | "WHATSAPP" | "GREETING",
  "confidence": 0.95,
  "entities": {
    "email": null,
    "phone": null,
    "targetUrl": null,
    "name": null
  }
}`;

    try {
      const result = await AIService.generateJSON(prompt, 'gemini-flash-lite-latest', {
        temperature: 0.1
      });
      return result || { intent: 'INFO', confidence: 0.5, entities: {} };
    } catch (err) {
      console.warn('[RouterAgent] Error al clasificar intención, fallback a INFO:', err.message);
      return { intent: 'INFO', confidence: 0.5, entities: {} };
    }
  }

  /**
   * Knowledge Agent: Genera respuesta informada con RAG
   */
  static async generateKnowledgeResponse(message, history = [], bot, knowledgeContext = '') {
    const systemPrompt = bot.systemPrompt || BotTrainingService.buildSystemPrompt(bot, knowledgeContext);

    const prompt = `${systemPrompt}

=== HISTORIAL RECIENTE ===
${(history || []).slice(-4).map(h => `${h.role === 'user' ? 'Visitante' : bot.name}: ${h.content}`).join('\n')}

Visitante: "${message}"

${bot.name}:`;

    try {
      const reply = await AIService.generateContent(prompt, 'gemini-flash-lite-latest', {
        temperature: 0.6,
        max_output_tokens: 1024
      });
      return reply.trim();
    } catch (err) {
      console.error('[KnowledgeAgent] Error generando respuesta:', err);
      return `¡Hola! Soy ${bot.name}. En este momento estoy experimentando una alta demanda de procesamiento. Por favor prueba preguntarme nuevamente o escríbenos directamente a nuestro WhatsApp oficial.`;
    }
  }

  /**
   * Lead Qualifier Agent: Dialoga amablemente para capturar detalles del proyecto
   */
  static async generateLeadResponse(message, history = [], bot, entities = {}) {
    const prompt = `Eres ${bot.name}, el asistente comercial y técnico de ScraperLabs.
El usuario ha mostrado interés en un proyecto de scraping o extracción de datos.
Datos detectados hasta el momento: ${JSON.stringify(entities)}

Historial reciente:
${(history || []).slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')}

Último mensaje: "${message}"

Tu objetivo:
1. Felicita al usuario por su iniciativa de automatizar y extraer datos.
2. Si falta la URL del sitio objetivo, pregúntale amablemente qué página o marketplace necesita monitorear.
3. Si no ha dejado su correo o WhatsApp, pídeselo para que el equipo de arquitectura de ScraperLabs le prepare una propuesta a medida.
4. Mantén una extensión de 2 a 3 oraciones concisas y profesionales.`;

    try {
      const reply = await AIService.generateContent(prompt, 'gemini-flash-lite-latest', {
        temperature: 0.5
      });
      return reply.trim();
    } catch (err) {
      return `¡Excelente! Para prepararte una cotización a medida, ¿cuál es el sitio web que deseas extraer y a qué correo o WhatsApp podemos enviarte la propuesta técnica?`;
    }
  }

  /**
   * Sugerencias rápidas según la intención
   */
  static getSuggestionsForIntent(intent) {
    switch (intent) {
      case 'LEAD':
        return [
          'Hablar por WhatsApp',
          'Ver modelos de precios',
          '¿Cómo manejan los bloqueos y captchas?'
        ];
      case 'WHATSAPP':
        return [
          '¿Qué servicios ofrecen?',
          'Cotizar un proyecto',
          'Ver casos de éxito'
        ];
      default:
        return [
          '¿Cómo funciona el web scraping?',
          'Cotizar extracción de datos',
          'Hablar con un asesor'
        ];
    }
  }
}

module.exports = AgentOrchestratorService;
