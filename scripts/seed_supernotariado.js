require('dotenv').config();
const { dynamoDB, TABLES } = require('../src/config/database');
const { PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

// Token y Chat ID cargados desde el archivo .env por seguridad
const TELEGRAM_TOKEN = process.env.TELEGRAM_NOTICE_TOKEN;
const YOUR_CHAT_ID = process.env.TELEGRAM_NOTICE_CHAT_ID; 

if (!TELEGRAM_TOKEN || !YOUR_CHAT_ID) {
  console.error('❌ Error: TELEGRAM_NOTICE_TOKEN o TELEGRAM_NOTICE_CHAT_ID no configurados en el .env');
  process.exit(1);
}

async function seed() {
  try {
    console.log('🚀 Iniciando configuración de Supernotariado en ScraperLab...');

    // 1. Configurar el Dominio en DynamoDB
    const domain = {
      domainId: 'estadotramiteciud.supernotariado.gov.co',
      providerId: 'api', // Usamos el nuevo provider gratuito
      enabled: true,
      countryCode: 'CO',
      strategyOrder: ['css'], 
      scraperConfig: {
        detail: {
          // Mapeo directo del JSON de la API de Supernotariado
          jsonPath: {
            title: 'entidad',
            currentPrice: 'estadoTramiteFecha', // Usamos la fecha como valor de control
            status_date: 'estadoTramiteFecha',
            radicado_date: 'estadoRadicadoFecha',
            available_date: 'estadoDisponibleFecha',
            ciudad: 'ciudad'
          }
        }
      }
    };

    // 2. Configurar el Pipeline de Monitoreo
    const pipeline = {
      pipelineId: 'monitor-supernotariado',
      name: 'Monitoreo de Trámite Ciudadano',
      enabled: true,
      nodes: [
        {
          id: 'start',
          type: 'TRIGGER',
          config: { inputType: 'turno' },
          next: 'scrape-api'
        },
        {
          id: 'scrape-api',
          type: 'SCRAPE_DETAIL',
          config: { 
            // Construye la URL dinámicamente con el turno del input
            urlTemplate: 'https://estadotramiteciud.supernotariado.gov.co/Portal/EstadoTramiteCiud/webresources/tramite/140,{{input.turno}}'
          },
          next: 'notify-telegram'
        },
        {
          id: 'notify-telegram',
          type: 'API_REQUEST',
          config: {
            url: `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            method: 'POST',
            bodyTemplate: {
              chat_id: YOUR_CHAT_ID,
              text: "🔔 *Actualización de Trámite*\n\n" +
                    "📍 *Turno:* {{input.turno}}\n" +
                    "🏢 *Entidad:* {{nodes.scrape-api.data.details.title}}\n" +
                    "🌆 *Ciudad:* {{nodes.scrape-api.data.details.ciudad}}\n\n" +
                    "📅 *Estado Trámite:* {{nodes.scrape-api.data.details.status_date}}\n" +
                    "📦 *Disponible Entrega:* {{nodes.scrape-api.data.details.available_date}}\n\n" +
                    "🔗 [Ver en el Portal](https://estadotramiteciud.supernotariado.gov.co/Portal/EstadoTramiteCiud/)",
              parse_mode: "Markdown"
            }
          },
          next: null
        }
      ]
    };

    // Ejecutar inserts
    await dynamoDB.send(new PutItemCommand({
      TableName: TABLES.DOMAINS,
      Item: marshall(domain)
    }));
    console.log('✅ Dominio estadotramiteciud.supernotariado.gov.co configurado.');

    await dynamoDB.send(new PutItemCommand({
      TableName: TABLES.PIPELINES,
      Item: marshall(pipeline)
    }));
    console.log('✅ Pipeline "monitor-supernotariado" creado.');

    console.log('\n✨ Configuración completada con éxito.');
    console.log('Ahora puedes ejecutar el pipeline desde el panel de ScraperLab enviando un "turno".');

  } catch (error) {
    console.error('❌ Error ejecutando el seed:', error);
  }
}

seed();
