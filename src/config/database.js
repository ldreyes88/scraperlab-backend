const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.STAGE === 'dev' && {
    endpoint: 'http://localhost:8000'
  })
});

const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false
  }
});

const TABLES = {
  PROVIDERS: process.env.PROVIDERS_TABLE_NAME || 'ScraperLab-Providers',
  DOMAINS: process.env.DOMAINS_TABLE_NAME || 'ScraperLab-Domains',
  PROCESS: process.env.PROCESS_TABLE_NAME || 'ScraperLab-Process',
  PROCESS_DETAIL: process.env.PROCESS_DETAIL_TABLE_NAME || 'ScraperLab-Process-Detail',
  USERS: process.env.USERS_TABLE_NAME || 'ScraperLab-Users',
  CLIENTS: process.env.CLIENTS_TABLE_NAME || 'ScraperLab-Clients',
  PIPELINES: process.env.PIPELINES_TABLE_NAME || 'ScraperLab-Pipelines',
  NODES: process.env.NODES_TABLE_NAME || 'ScraperLab-Nodes',
  BOTS: process.env.BOTS_TABLE_NAME || 'ScraperLab-Bots',
  BOT_KNOWLEDGE: process.env.BOT_KNOWLEDGE_TABLE_NAME || 'ScraperLab-BotKnowledge',
  CHAT_SESSIONS: process.env.CHAT_SESSIONS_TABLE_NAME || 'ScraperLab-ChatSessions'
};

module.exports = { dynamoDB, TABLES };