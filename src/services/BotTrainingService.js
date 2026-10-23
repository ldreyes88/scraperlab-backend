// src/services/BotTrainingService.js
const axios = require('axios');
const cheerio = require('cheerio');
const BotRepository = require('../repositories/BotRepository');
const BotKnowledgeRepository = require('../repositories/BotKnowledgeRepository');
const AIService = require('./AIService');
const { nowColombiaISO } = require('../utils/time');

class BotTrainingService {
  /**
   * Entrena un bot extrayendo y procesando una o más URLs
   * @param {string} botId
   * @param {string[]} targetUrls
   * @param {Object} options - { replaceExisting: boolean, customInstructions: string }
   */
  static async trainBotFromUrls(botId, targetUrls = [], options = {}) {
    const { replaceExisting = true, customInstructions = '' } = options;

    const bot = await BotRepository.getById(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} no encontrado`);
    }

    if (!Array.isArray(targetUrls) || targetUrls.length === 0) {
      throw new Error('Se requiere al menos una URL válida para entrenar el bot');
    }

    // Actualizar estado a entrenamiento
    await BotRepository.update(botId, {
      status: 'training',
      targetUrls,
      lastTrainedAt: nowColombiaISO()
    });

    console.log(`[BotTrainingService] Iniciando entrenamiento para bot ${botId} (${bot.name || 'Sin nombre'}) con ${targetUrls.length} URLs`);

    if (replaceExisting) {
      console.log(`[BotTrainingService] Limpiando conocimiento previo de bot ${botId}`);
      await BotKnowledgeRepository.deleteByBotId(botId);
    }

    const processedPages = [];
    const allFaqs = [];
    const allServices = [];

    for (const url of targetUrls) {
      try {
        console.log(`[BotTrainingService] Raspando y procesando URL: ${url}`);
        const pageData = await this.scrapeAndCleanUrl(url);

        if (!pageData.text || pageData.text.length < 50) {
          console.warn(`[BotTrainingService] Contenido insuficiente en ${url}, omitiendo.`);
          continue;
        }

        // Estructurar con Gemini Flash Lite
        const extracted = await this.extractStructuredKnowledge(pageData, bot, customInstructions);

        // Guardar conocimiento en DynamoDB
        const knowledgeItem = await BotKnowledgeRepository.create({
          botId,
          sourceUrl: url,
          title: pageData.title || extracted.pageTitle || url,
          summary: extracted.businessSummary || '',
          services: extracted.keyOfferings || [],
          faqs: extracted.faqs || [],
          contactInfo: extracted.contactInfo || {},
          rawExcerpt: pageData.text.slice(0, 1500)
        });

        processedPages.push(knowledgeItem);
        if (Array.isArray(extracted.faqs)) allFaqs.push(...extracted.faqs);
        if (Array.isArray(extracted.keyOfferings)) allServices.push(...extracted.keyOfferings);

      } catch (err) {
        console.error(`[BotTrainingService] Error procesando URL ${url}:`, err.message);
      }
    }

    if (processedPages.length === 0) {
      await BotRepository.update(botId, { status: 'failed' });
      throw new Error('No se pudo extraer contenido válido de ninguna de las URLs proporcionadas.');
    }

    // Generar System Prompt optimizado para el bot
    const compiledKnowledge = await this.getKnowledgeContext(botId);
    const generatedSystemPrompt = this.buildSystemPrompt(bot, compiledKnowledge, customInstructions);

    // Actualizar bot como activo
    const updatedBot = await BotRepository.update(botId, {
      status: 'active',
      systemPrompt: bot.systemPrompt || generatedSystemPrompt,
      trainingSummary: {
        pagesProcessed: processedPages.length,
        totalFaqs: allFaqs.length,
        totalServices: allServices.length,
        completedAt: nowColombiaISO()
      }
    });

    console.log(`[BotTrainingService] Entrenamiento completado con éxito para bot ${botId}`);
    return {
      success: true,
      bot: updatedBot,
      pagesProcessed: processedPages.length,
      faqsExtracted: allFaqs.length
    };
  }

  /**
   * Raspa y limpia el HTML de una URL
   */
  static async scrapeAndCleanUrl(url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 25000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    // Remover elementos irrelevantes
    $('script, style, noscript, svg, iframe, nav, footer, link, header, [role="navigation"], [role="banner"]').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || '';
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    // Extraer texto ordenado por headings y párrafos
    const textBlocks = [];
    if (metaDescription) textBlocks.push(`Descripción: ${metaDescription}`);

    $('h1, h2, h3, h4, p, li').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length > 15) {
        textBlocks.push(text);
      }
    });

    // Detectar posibles links de contacto
    const contactLinks = [];
    $('a[href^="mailto:"], a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"]').each((_, el) => {
      contactLinks.push($(el).attr('href'));
    });

    return {
      title,
      text: textBlocks.slice(0, 150).join('\n'), // Limitar a las primeras 150 líneas significativas
      contactLinks: [...new Set(contactLinks)]
    };
  }

  /**
   * Extrae conocimiento estructurado usando Gemini
   */
  static async extractStructuredKnowledge(pageData, bot, customInstructions = '') {
    const prompt = `Actúa como un extractor y sintetizador de conocimiento de IA para un chatbot empresarial.
Nombre del Bot: ${bot.name || 'Asistente Virtual'}
Cliente/Empresa: ${bot.clientId || 'Empresa'}
Título de la página: ${pageData.title}
Enlaces de contacto detectados: ${JSON.stringify(pageData.contactLinks)}

Instrucciones adicionales del cliente:
${customInstructions || 'Extrae información relevante de productos, servicios, precios, preguntas frecuentes y contacto.'}

Contenido textual de la página web:
"""
${pageData.text.slice(0, 12000)}
"""

Analiza el texto y genera un JSON con la siguiente estructura exacta:
{
  "pageTitle": "Título claro de la sección o página",
  "businessSummary": "Resumen ejecutivo de qué ofrece la empresa o esta sección (máximo 3 párrafos concisos)",
  "keyOfferings": [
    "Nombre de servicio o producto 1 con breve descripción y precio si se menciona",
    "Nombre de servicio o producto 2..."
  ],
  "faqs": [
    {
      "question": "Pregunta frecuente que un cliente haría",
      "answer": "Respuesta clara y precisa basada estrictamente en el texto"
    }
  ],
  "contactInfo": {
    "whatsapp": "Número o enlace de WhatsApp si existe",
    "email": "Correo si existe",
    "phone": "Teléfono si existe",
    "supportUrl": "Enlace de ayuda si existe"
  }
}`;

    try {
      const result = await AIService.generateJSON(prompt, 'gemini-flash-lite-latest', {
        temperature: 0.3
      });
      return result || {};
    } catch (err) {
      console.error('[BotTrainingService] Falló Gemini en estructuración JSON:', err.message);
      return {
        pageTitle: pageData.title,
        businessSummary: pageData.text.slice(0, 300),
        faqs: [],
        keyOfferings: []
      };
    }
  }

  /**
   * Construye el contexto de conocimiento listo para inyectar al agente conversacional
   */
  static async getKnowledgeContext(botId) {
    const items = await BotKnowledgeRepository.getByBotId(botId);
    if (!items || items.length === 0) return '';

    let context = '=== BASE DE CONOCIMIENTO ENTRENADA DEL BOT ===\n\n';

    items.forEach((item, index) => {
      context += `[DOCUMENTO ${index + 1}: ${item.title || item.sourceUrl}]\n`;
      if (item.summary) context += `Resumen: ${item.summary}\n`;
      if (item.services && item.services.length > 0) {
        context += `Servicios/Productos:\n - ${item.services.join('\n - ')}\n`;
      }
      if (item.faqs && item.faqs.length > 0) {
        context += `Preguntas Frecuentes:\n`;
        item.faqs.forEach(f => {
          context += `  P: ${f.question}\n  R: ${f.answer}\n`;
        });
      }
      if (item.contactInfo && Object.keys(item.contactInfo).length > 0) {
        context += `Contacto: ${JSON.stringify(item.contactInfo)}\n`;
      }
      context += '\n';
    });

    return context;
  }

  /**
   * Crea el System Prompt por defecto
   */
  static buildSystemPrompt(bot, knowledgeContext, customInstructions = '') {
    return `Eres ${bot.name || 'Scrapy'}, el agente oficial y asistente virtual de atención al cliente para ${bot.clientId || 'ScraperLabs'}.

Rol y Personalidad:
- Eres amable, técnico, transparente y conciso.
- Respondes en Español con excelente ortografía.
- Tu misión es resolver dudas de visitantes, explicar servicios o productos, capturar oportunidades comerciales (leads) y guiar a los clientes.
- Si no sabes una respuesta con certeza o no está en tu base de conocimiento, admítelo con honestidad y sugiere hablar directamente con un asesor por WhatsApp.

${customInstructions ? `Instrucciones especiales:\n${customInstructions}\n` : ''}

${knowledgeContext}

Reglas operativas de respuesta:
1. No inventes características, precios o políticas que no estén explícitas en tu base de conocimiento.
2. Si el usuario muestra interés en contratar o cotizar, solicita con amabilidad su correo o número de contacto y la información de su necesidad.
3. Si el usuario pide hablar con una persona humana, facilítale amablemente la transición al canal de WhatsApp.`;
  }
}

module.exports = BotTrainingService;
