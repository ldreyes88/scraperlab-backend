/**
 * scripts/agent-orchestrator.js
 * 
 * Orquestador local 24/7 para Mac M4 / Background:
 * 1. Lee tareas pendientes de `AgentTaskRepository` o la API local.
 * 2. Si hay tareas en 'ideation', el Agente PO analiza el mercado y genera los requerimientos.
 * 3. Si hay tareas en 'architecture' (aprobadas o en diseño), el Agente Arquitecto genera el RFC técnico.
 * 4. Si hay tareas en 'coding', el Agente Dev prepara la rama y el esqueleto.
 * 5. Si hay tareas en 'testing', el Agente QA corre las pruebas.
 */

require('dotenv').config();
const AgentTaskRepository = require('../src/repositories/AgentTaskRepository');

async function processTasksCycle() {
  try {
    const tasks = await AgentTaskRepository.getAll();
    console.log(`[Orchestrator] ${new Date().toISOString()} - Escaneando tareas... Total: ${tasks.length}`);

    for (const task of tasks) {
      if (task.status === 'ideation') {
        console.log(`[Orchestrator] PO Agent analizando requerimiento: "${task.title}" (${task.project})`);
        
        // Simulación / integración de llamada con Gemini Flash
        const specSummary = `Especificación generada por PO Agent:
- Proyecto: ${task.project}
- Objetivo: ${task.title}
- Entradas requeridas: Parámetros de consulta, credenciales o endpoints públicos.
- Salidas esperadas: JSON normalizado para Oferty/Influenty.`;

        await AgentTaskRepository.update(task.taskId, {
          status: 'architecture',
          currentAgent: 'arch_agent',
          actionNote: 'PO Agent completó especificación funcional',
          artifacts: {
            ...(task.artifacts || {}),
            spec: specSummary
          }
        });
        console.log(`[Orchestrator] Tarea ${task.taskId} promovida a etapa de Arquitectura.`);
      }
    }
  } catch (error) {
    console.error('[Orchestrator] Error en ciclo:', error);
  }
}

// Ejecución cíclica cada 30 segundos
if (require.main === module) {
  console.log('[Orchestrator] Iniciando servicio de orquestación de agentes en segundo plano...');
  processTasksCycle();
  setInterval(processTasksCycle, 30000);
}

module.exports = { processTasksCycle };
