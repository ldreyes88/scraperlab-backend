/**
 * Seed & Configuración: Cliente "clientes empresariales" y Bot "Caribe Partes"
 */
require('dotenv').config();
const ClientRepository = require('../src/repositories/ClientRepository');
const BotRepository = require('../src/repositories/BotRepository');
const BotKnowledgeRepository = require('../src/repositories/BotKnowledgeRepository');
const PipelineRepository = require('../src/repositories/PipelineRepository');
const NodeRepository = require('../src/repositories/NodeRepository');

async function seedCaribePartes() {
  console.log('🚀 Iniciando configuración de Caribe Partes y Cliente Empresarial en ScraperLab...');

  try {
    // ==========================================
    // 1. CREAR / ACTUALIZAR CLIENTE "clientes empresariales"
    // ==========================================
    const clientId = 'clientes-empresariales';
    let client = await ClientRepository.getClientById(clientId);

    if (!client) {
      client = await ClientRepository.createClient({
        clientId,
        name: 'Clientes Empresariales',
        type: 'ENTERPRISE_BOT',
        allowedUsers: ['ldreyes88@gmail.com', 'admin@scraperlab.com'],
        isActive: true,
        settings: {
          defaultChannel: 'whatsapp',
          primaryPhone: '573219662703'
        }
      });
      console.log('✅ Cliente "Clientes Empresariales" creado exitosamente.');
    } else {
      console.log('ℹ️  Cliente "Clientes Empresariales" ya existía.');
    }

    // ==========================================
    // 2. CREAR / ACTUALIZAR BOT "Caribe Partes" (id: caribe-partes)
    // ==========================================
    const botId = 'caribe-partes';
    const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1459103610618616';

    const botData = {
      botId,
      name: 'Caribe Partes',
      clientId: 'clientes-empresariales',
      status: 'active',
      enabled: true,
      hideArchitecture: true,
      restrictOffTopic: true,
      avatarUrl: '/images/caribe-partes.png',
      channels: {
        web: { enabled: true, allowedDomains: ['*'] },
        whatsapp: {
          enabled: true,
          phoneNumber: '573219662703',
          phoneNumberId: phoneId,
          accessToken: token,
          verifyToken: 'scraperlabs_whatsapp_verify_token',
          agentPhoneNumber: '573219662703'
        }
      },
      branding: {
        primaryColor: '#e11d48',
        secondaryColor: '#0f172a',
        welcomeMessage: '¡Hola! Bienvenido a Caribe Partes 🚗 - Garantía Total. ¿En qué repuesto, accesorio o llanta podemos ayudarte hoy?',
        quickSuggestions: [
          'Llantas para Renault Duster',
          'Llantas para Chevrolet Ónix Turbo',
          'Cotizar repuestos y autopartes',
          'Hablar con un asesor'
        ]
      },
      systemPrompt: `Eres el asesor virtual oficial de "Caribe Partes" - Garantía Total.
Atiendes clientes comerciales y particulares por WhatsApp y web en Colombia.

Especialidad:
- Venta de autopartes, repuestos originales y homologados, y llantas de marcas líderes (Goodyear, Michelin, Hankook, Pirelli, Bridgestone, Continental).
- Asesoría técnica por marca, modelo, línea y año de vehículo (Chevrolet Ónix, Renault Duster, Sandero, Stepway, Toyota Hilux/Prado, Mazda 2/3/CX-5, Kia Picanto/Rio, etc.).

Reglas de Conversación y Memoria:
1. Mantén siempre el hilo de la conversación considerando todo el historial previo, incluso si el cliente tarda horas o días en responder.
2. Si el cliente ya mencionó su vehículo o medida en mensajes anteriores, NO vuelvas a preguntárselo; usa esa información para avanzar.
3. Brinda precios en pesos colombianos (COP), tiempos de despacho nacional (24-48 horas) e instalación/montaje según aplique.
4. Si el cliente desea concretar la compra, solicita amablemente su nombre y ciudad de destino para generar la orden o transferir a un asesor humano.
5. Formato claro con emojis automotrices, viñetas y texto legible para WhatsApp (*negrita* con asteriscos).`
    };

    const existingBot = await BotRepository.getById(botId);
    if (existingBot) {
      await BotRepository.update(botId, botData);
      console.log('✅ Bot "caribe-partes" actualizado en DynamoDB.');
    } else {
      await BotRepository.create(botData);
      console.log('✅ Bot "caribe-partes" creado en DynamoDB.');
    }

    // ==========================================
    // 3. BASE DE CONOCIMIENTO (RAG) DE CARIBE PARTES
    // ==========================================
    await BotKnowledgeRepository.deleteByBotId(botId);

    await BotKnowledgeRepository.create({
      botId,
      sourceUrl: 'https://caribepartes.com/catalogo',
      title: 'Catálogo Oficial Caribe Partes - Llantas y Autopartes',
      summary: 'Portafolio de llantas, autopartes, frenos, suspensión y mantenimiento con precios de distribuidor y garantía total.',
      services: [
        'Chevrolet Ónix Turbo (2020-2024): Medida 195/55 R16 - Goodyear Assurance MaxGuard $315.000 COP | Continental UltraContact $350.000 COP | Hankook Kinergy Eco2 $290.000 COP',
        'Renault Duster: Medida 215/65 R16 - Pirelli Scorpion ATR (Mixta 50/50) $485.000 COP | Goodyear Wrangler Workhorse $460.000 COP | Michelin LTX Force $540.000 COP',
        'Renault Sandero / Logan / Stepway: Medida 185/65 R15 - Hankook Kinergy Eco2 $265.000 COP | Michelin Energy XM2+ $330.000 COP',
        'Mazda 3 / Toyota Corolla: Medida 205/55 R16 - Goodyear EfficientGrip $340.000 COP | Michelin Primacy 4 $420.000 COP',
        'Toyota Hilux / Fortuner / Prado: Medida 265/65 R17 - BFGoodrich All-Terrain KO2 $1.150.000 COP | Bridgestone Dueler A/T $780.000 COP',
        'Kit de Pastillas de Freno y Discos para Chevrolet Ónix Turbo y Renault Duster (Marcas Brembo, Incolbest, Bosch)',
        'Amortiguadores y suspensión reforzada para transporte y particulares'
      ],
      faqs: [
        {
          question: '¿Qué medida de llanta usa el Chevrolet Ónix Turbo?',
          answer: 'El Chevrolet Ónix Turbo (versiones LTZ y Premier) equipa de fábrica rin 16 con medida 195/55 R16. En la versión LT o sedán básica equipa rin 15 con medida 185/65 R15.'
        },
        {
          question: '¿Qué incluye la compra de llantas en Caribe Partes?',
          answer: 'Por la compra del juego de llantas, incluye montaje, válvulas nuevas y balanceo computarizado sin costo en nuestras servitecas aliadas a nivel nacional.'
        },
        {
          question: '¿Hacen envíos a toda Colombia?',
          answer: 'Sí, despachamos el mismo día por Coordinadora, Servientrega o Envia con cobertura nacional y pago contraentrega o transferencia segura.'
        },
        {
          question: '¿Qué garantía ofrece Caribe Partes?',
          answer: 'Garantía Total de 5 años por defectos de fabricación en llantas y 1 año de garantía en autopartes mecánicas y eléctricas.'
        }
      ],
      contactInfo: {
        telefono: '+57 321 966 2703',
        whatsapp: '+57 321 966 2703',
        atencion: 'Lunes a Sábado 8:00 AM a 6:00 PM',
        servitecas: 'Barranquilla, Cartagena, Santa Marta, Valledupar, Montería, Bogotá, Medellín, Cali'
      }
    });

    console.log('✅ Base de conocimiento RAG de Caribe Partes registrada.');

    // ==========================================
    // 4. PIPELINE: Chat WhatsApp 3219662703 -> Bot Caribe Partes
    // ==========================================
    const pipelineId = 'pipeline-whatsapp-caribe-partes';
    const pipelineData = {
      pipelineId,
      name: 'Pipeline WhatsApp Caribe Partes (3219662703)',
      description: 'Orquestación de canal WhatsApp hacia el bot de Caribe Partes con memoria contextual en DynamoDB y RAG de catálogo.',
      clientId: 'clientes-empresariales',
      enabled: true,
      nodes: [
        {
          id: 'whatsapp-trigger',
          type: 'TRIGGER',
          config: {
            channel: 'whatsapp',
            phoneNumber: '573219662703',
            botId: 'caribe-partes'
          },
          next: 'orchestrator-caribe-partes'
        },
        {
          id: 'orchestrator-caribe-partes',
          type: 'AI_PROMPT',
          config: {
            botId: 'caribe-partes',
            service: 'AgentOrchestratorService',
            sessionPrefix: 'wa_caribe-partes',
            enableMemory: true,
            memoryLimit: 10
          },
          next: 'whatsapp-response'
        },
        {
          id: 'whatsapp-response',
          type: 'API_REQUEST',
          nodeRef: 'whatsapp-notice',
          next: null
        }
      ]
    };

    const existingPipeline = await PipelineRepository.getById(pipelineId);
    if (existingPipeline) {
      await PipelineRepository.update(pipelineId, pipelineData);
      console.log('✅ Pipeline "pipeline-whatsapp-caribe-partes" actualizado.');
    } else {
      await PipelineRepository.create(pipelineData);
      console.log('✅ Pipeline "pipeline-whatsapp-caribe-partes" creado.');
    }

    console.log('\n✨ ¡Configuración completa de Caribe Partes exitosa!');
  } catch (error) {
    console.error('❌ Error configurando Caribe Partes:', error);
  }
}

seedCaribePartes();
