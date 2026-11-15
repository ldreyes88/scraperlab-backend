/**
 * Script de Inicialización: Empresa de Llantas ("Llantas Ya" / bot "llantas")
 * 
 * Configura:
 * 1. Bot en ScraperLab-Bots adaptado para WhatsApp y atención al cliente.
 * 2. Base de Conocimiento RAG en ScraperLab-BotKnowledge con catálogo de llantas, medidas, marcas, stock y precios.
 * 3. Nodo Reutilizable 'whatsapp-notice' en ScraperLab-Nodes para pipelines.
 */
require('dotenv').config();
const BotRepository = require('../src/repositories/BotRepository');
const BotKnowledgeRepository = require('../src/repositories/BotKnowledgeRepository');
const NodeRepository = require('../src/repositories/NodeRepository');
const { nowColombiaISO } = require('../src/utils/time');

async function seedLlantasBotAndWhatsApp() {
  console.log('🚀 Iniciando configuración de Bot de Llantas y WhatsApp en ScraperLab...');

  try {
    // ==========================================
    // 1. REGISTRAR O ACTUALIZAR NODO WHATSAPP EN EL CATÁLOGO DE PIPELINES
    // ==========================================
    const whatsappNode = {
      nodeId: 'whatsapp-notice',
      name: 'Notificador WhatsApp Cloud API',
      description: 'Envía alertas o resultados de pipelines a WhatsApp usando Meta Graph API',
      type: 'API_REQUEST',
      category: 'integration',
      clientId: 'scraperlab',
      enabled: true,
      defaultConfig: {
        method: 'POST',
        url: 'https://graph.facebook.com/v21.0/{{config.WHATSAPP_PHONE_NUMBER_ID}}/messages',
        headers: {
          'Authorization': 'Bearer {{config.WHATSAPP_ACCESS_TOKEN}}',
          'Content-Type': 'application/json'
        },
        bodyTemplate: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '{{config.WHATSAPP_DEFAULT_RECIPIENT}}',
          type: 'text',
          text: {
            preview_url: false,
            body: '🔔 *[ScraperLab Alerta]*\n\n{{nodes.ai_matcher.message}}'
          }
        }
      }
    };

    await NodeRepository.create(whatsappNode);
    console.log('✅ Nodo "whatsapp-notice" registrado en el catálogo de nodos.');

    // ==========================================
    // 2. CREAR O ACTUALIZAR BOT "llantas"
    // ==========================================
    const botId = 'llantas';
    const existingBot = await BotRepository.getById(botId);

    const botData = {
      botId,
      name: 'Llantas Ya - Asesor Virtual',
      clientId: 'llantas-ya',
      status: 'active',
      enabled: true,
      hideArchitecture: true,
      restrictOffTopic: true,
      avatarUrl: '/images/tire-bot.png',
      channels: {
        web: { enabled: true, allowedDomains: ['*'] },
        whatsapp: {
          enabled: true,
          phoneNumber: '573001234567', // Número de WhatsApp visible
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '', // ID de Meta Cloud API
          accessToken: '', // Si está vacío usa WHATSAPP_ACCESS_TOKEN global
          verifyToken: 'scraperlab_whatsapp_verify_token',
          agentPhoneNumber: '573219662703' // Número de asesor humano para transferencias
        }
      },
      branding: {
        primaryColor: '#e11d48',
        secondaryColor: '#0f172a',
        welcomeMessage: '¡Hola! Bienvenido a Llantas Ya 🚗💨. ¿Qué medida de llanta buscas o para qué vehículo necesitas cotizar?',
        quickSuggestions: [
          'Cotizar 205/55 R16',
          'Llantas para Renault Duster',
          'Promociones Michelin y Goodyear',
          'Hablar con un asesor'
        ]
      },
      systemPrompt: `Eres el asesor experto en llantas y servicio al cliente de "Llantas Ya".
Atiendes clientes tanto en la página web como por WhatsApp.

Tus objetivos:
1. Asesorar al cliente sobre la llanta ideal para su vehículo (automóvil, SUV, camioneta, moto o carga).
2. Preguntar la medida de la llanta (ejemplo: 205/55 R16) o la marca y modelo del vehículo si el cliente no la conoce.
3. Consultar tu catálogo en la base de conocimiento y brindar opciones con marca, precio, garantía y disponibilidad actual.
4. Si el cliente desea comprar o agendar instalación en serviteca, captura amablemente su nombre y ciudad para que un asesor complete su pedido.

Personalidad:
- Rápido, claro, cordial y experto en el sector automotriz.
- Formato de respuesta limpio y legible para WhatsApp (usa negritas con *asterisco* y listas cortas).
- No inventes medidas o precios que no estén en tu conocimiento.`
    };

    if (existingBot) {
      await BotRepository.update(botId, botData);
      console.log(`✅ Bot "${botId}" actualizado.`);
    } else {
      await BotRepository.create(botData);
      console.log(`✅ Bot "${botId}" creado.`);
    }

    // ==========================================
    // 3. BASE DE CONOCIMIENTO (RAG): Catálogo de Llantas y Preguntas Frecuentes
    // ==========================================
    await BotKnowledgeRepository.deleteByBotId(botId);

    // Ítem 1: Catálogo de Medidas Más Vendidas
    await BotKnowledgeRepository.create({
      botId,
      sourceUrl: 'https://llantasya.com/catalogo',
      title: 'Catálogo de Llantas y Precios Disponibles',
      summary: 'Inventario activo de llantas para automóviles, camionetas y SUVs con precios promocionales, índice de carga y velocidad.',
      services: [
        'Medida 185/65 R15 - Hankook Kinergy Eco2: $265.000 COP (Garantía 5 años, ideal Logan, Sandero, Aveo)',
        'Medida 205/55 R16 - Goodyear EfficientGrip: $340.000 COP (Excelente agarre en mojado, ideal Corolla, Mazda 3, Golf)',
        'Medida 205/55 R16 - Michelin Primacy 4: $420.000 COP (Máxima durabilidad y frenado seguro)',
        'Medida 215/65 R16 - Pirelli Scorpion ATR: $485.000 COP (Uso mixto 50% asfalto / 50% destapado, ideal Renault Duster)',
        'Medida 225/65 R17 - Bridgestone Dueler H/T: $590.000 COP (Confort premium, ideal Mazda CX-5, Toyota RAV4)',
        'Medida 265/65 R17 - BFGoodrich All-Terrain T/A KO2: $1.150.000 COP (Alta resistencia todoterreno, Toyota Hilux, Fortuner, Prado)'
      ],
      faqs: [
        {
          question: '¿Cómo saber la medida de mi llanta?',
          answer: 'Puedes revisar el costado exterior de tu llanta actual. Verás una serie de números como 205/55 R16, donde 205 es el ancho en mm, 55 el perfil en porcentaje, y R16 el rin en pulgadas.'
        },
        {
          question: '¿El precio incluye instalación, montaje y balanceo?',
          answer: '¡Sí! Por la compra del par o el juego de 4 llantas, el montaje y balanceo son totalmente gratis en nuestras servitecas aliadas de Bogotá, Medellín, Cali y Barranquilla.'
        },
        {
          question: '¿Hacen envíos a nivel nacional?',
          answer: 'Sí, despachamos a cualquier municipio de Colombia por transportadora con entrega de 24 a 48 horas.'
        },
        {
          question: '¿Qué garantía tienen las llantas?',
          answer: 'Todas nuestras llantas son 100% nuevas y originales con 5 años de garantía de fábrica contra defectos de fabricación.'
        }
      ],
      contactInfo: {
        whatsapp: '+57 300 123 4567',
        servitecas: 'Bogotá (Calle 80, Calle 134), Medellín (Poblado, Guayabal), Cali (Pasoancho)',
        horario: 'Lunes a Sábado de 8:00 AM a 6:00 PM'
      }
    });

    console.log('✅ Base de conocimiento RAG de Llantas cargada con éxito.');
    console.log('\n✨ Configuración finalizada con éxito.');

  } catch (error) {
    console.error('❌ Error en el seed de Llantas y WhatsApp:', error);
  }
}

seedLlantasBotAndWhatsApp();
