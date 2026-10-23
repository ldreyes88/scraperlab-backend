/**
 * Script para sembrar el Bot oficial "Scrapy" y su base de conocimiento en DynamoDB
 * 
 * Uso:
 *   node scripts/seed-scrapy-bot.js
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../src/utils/time');

const STAGE = process.env.STAGE || 'dev';
const isLocal = STAGE === 'dev';

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1'
};

if (isLocal) {
  clientConfig.endpoint = 'http://localhost:8000';
  clientConfig.credentials = { accessKeyId: 'fake', secretAccessKey: 'fake' };
}

const client = new DynamoDBClient(clientConfig);
const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false }
});

const TABLES = {
  BOTS: process.env.BOTS_TABLE_NAME || 'ScraperLab-Bots',
  BOT_KNOWLEDGE: process.env.BOT_KNOWLEDGE_TABLE_NAME || 'ScraperLab-BotKnowledge'
};

const scrapyBot = {
  botId: 'scrapy',
  name: 'Scrapy',
  clientId: 'scraperlab',
  enabled: true,
  status: 'active',
  avatarUrl: '/images/scrapy.png',
  description: 'Embajador y asistente técnico oficial de ScraperLabs para atención al cliente y cotización web.',
  branding: {
    primaryColor: '#4f46e5',
    secondaryColor: '#f97316',
    welcomeMessage: '¡Hola! Soy Scrapy, el bot oficial de ScraperLabs. ¿En qué puedo ayudarte hoy?',
    quickSuggestions: [
      '¿Qué servicios ofrecen?',
      'Cotizar un scraping',
      '¿Cómo evitan los bloqueos?',
      'Hablar con un asesor'
    ]
  },
  channels: {
    web: {
      enabled: true,
      allowedDomains: ['*']
    },
    whatsapp: {
      enabled: true,
      phoneNumber: '573105741697'
    }
  },
  systemPrompt: `Eres Scrapy, el robot embajador oficial de ScraperLabs (tienes cabeza de monitor retro con los ojos espirales azul y naranja con las iniciales SC, tableta de analíticas y actitud alegre y súper tecnológica).

MISIÓN:
Atender a los visitantes de scraperlabs.co, responder sus dudas sobre nuestros servicios de web scraping y automatización, calificar oportunidades de negocio y guiarlos para cotizar proyectos.

SERVICIOS CLAVE DE SCRAPERLABS:
1. Web Scraping & Extracción a Gran Escala:
   - Extracción de millones de registros diarios con alta velocidad y estructura en JSON/CSV/Base de datos.
2. Anti-detección & Resiliencia Empresarial:
   - Rotación inteligente de proxies residenciales y datacenter.
   - Evasión de bloqueos Cloudflare, Akamai, Datadome, reCAPTCHA y Turnstile.
3. Monitoreo de Precios para E-commerce:
   - Seguimiento en tiempo real de competidores en MercadoLibre, Falabella, Éxito, Alkosto, etc.
   - Matching inteligente de productos con IA para descartar accesorios o repuestos.
4. Extracción de Licitaciones y Sector Público (SECOP II):
   - Alertas automáticas y descarga de pliegos de contratación pública en Colombia.
5. Pipelines de Agentes & Bots de Servicio al Cliente:
   - Creación de chatbots entrenados con el contenido de cualquier sitio web en minutos.

REGLAS DE INTERACCIÓN:
- Sé amigable, directo, profesional y conciso.
- Responde siempre en Español.
- Si el usuario quiere cotizar o extraer un sitio, pídele la URL objetivo y su correo o WhatsApp.
- Si el usuario solicita hablar con una persona o asesor, proporciónale el enlace directo a WhatsApp (+57 310 574 1697).`,
  targetUrls: [
    'https://scraperlabs.com.co',
    'https://scraperlabs.com.co/precios',
    'https://scraperlabs.com.co/contacto'
  ],
  stats: {
    totalConversations: 0,
    totalMessages: 0,
    totalLeads: 0
  },
  createdAt: nowColombiaISO(),
  updatedAt: nowColombiaISO()
};

const scrapyKnowledgeItems = [
  {
    knowledgeId: 'scrapy-core-services',
    botId: 'scrapy',
    sourceUrl: 'https://scraperlabs.com.co',
    title: 'Servicios Principales y Tecnologías de ScraperLabs',
    summary: 'ScraperLabs ofrece infraestructura de web scraping, monitoreo de precios, extracción de licitaciones públicas y creación de chatbots inteligentes para sitios web.',
    services: [
      'Scraping masivo y APIs a la medida por suscripción o batch',
      'Monitoreo y comparador de precios de e-commerce retail en Colombia',
      'Extracción inteligente de SECOP II Colombia',
      'Infraestructura anti-baneo con proxies rotativos y resolución de captchas',
      'Chatbots y agentes conversacionales para sitios web y WhatsApp'
    ],
    faqs: [
      {
        question: '¿Qué es ScraperLabs?',
        answer: 'ScraperLabs es una plataforma y laboratorio especializado en ingeniería de web scraping, monitoreo competitivo de precios y orquestación de agentes de IA para empresas.'
      },
      {
        question: '¿Cómo garantizan que no bloqueen los scrapers?',
        answer: 'Implementamos un pool de proxies residenciales geolocalizados, rotación de huellas digitales de navegador (fingerprints), renderizado con navegadores headless y resolución automatizada de captchas.'
      },
      {
        question: '¿Pueden raspar cualquier página web?',
        answer: 'Sí, podemos extraer prácticamente cualquier sitio público, marketplaces, catálogos de productos, portales inmobiliarios y plataformas gubernamentales.'
      },
      {
        question: '¿Cómo puedo solicitar una cotización?',
        answer: 'Puedes escribirnos directamente en este chat indicando la URL del sitio que necesitas extraer y tu correo o número de contacto, o hablar directamente con nuestros ingenieros por WhatsApp al +57 310 574 1697.'
      }
    ],
    contactInfo: {
      whatsapp: '+57 310 574 1697',
      web: 'https://scraperlabs.com.co'
    },
    createdAt: nowColombiaISO(),
    updatedAt: nowColombiaISO()
  }
];

async function seed() {
  console.log(`\n======================================================`);
  console.log(`🚀 Sembrando Bot Oficial "Scrapy" y Base de Conocimiento`);
  console.log(`======================================================\n`);

  try {
    // 1. Guardar Bot
    console.log(`Registrando bot: ${scrapyBot.botId} (${scrapyBot.name})...`);
    await dynamoDB.send(new PutCommand({
      TableName: TABLES.BOTS,
      Item: scrapyBot
    }));
    console.log(`✅ Bot ${scrapyBot.name} registrado exitosamente.`);

    // 2. Guardar Documentos de Conocimiento
    for (const item of scrapyKnowledgeItems) {
      console.log(`Registrando conocimiento: ${item.title}...`);
      await dynamoDB.send(new PutCommand({
        TableName: TABLES.BOT_KNOWLEDGE,
        Item: item
      }));
    }
    console.log(`✅ Base de conocimiento sembrada exitosamente.\n`);

  } catch (error) {
    console.error('❌ Error sembrando bot Scrapy:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, scrapyBot, scrapyKnowledgeItems };
