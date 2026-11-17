const path = require('path');
require('dotenv').config();
const PipelineRepository = require('../src/repositories/PipelineRepository');

async function update() {
  const pipelineId = 'pipeline-whatsapp-caribe-partes';
  const pipeline = {
    pipelineId,
    name: 'Pipeline WhatsApp Caribe Partes (3219662703)',
    description: 'Orquestación de canal WhatsApp hacia el bot de Caribe Partes con memoria contextual en DynamoDB y RAG de catálogo.',
    clientId: 'caribe-partes',
    enabled: true,
    nodes: [
      {
        id: 'whatsapp-trigger',
        type: 'TRIGGER',
        config: {
          channel: 'whatsapp',
          phoneNumber: '573219662703',
          phoneNumberId: '1372470465958598',
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
        configOverride: {
          url: 'https://graph.facebook.com/v21.0/1372470465958598/messages',
          bodyTemplate: {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '{{input.fromNumber}}',
            type: 'text',
            text: {
              body: '{{nodes.orchestrator-caribe-partes.reply}}',
              preview_url: false
            }
          }
        },
        next: null
      }
    ]
  };

  await PipelineRepository.update(pipelineId, pipeline);
  console.log('✅ Pipeline actualizado con configOverride particular para Caribe Partes');
}
update();
