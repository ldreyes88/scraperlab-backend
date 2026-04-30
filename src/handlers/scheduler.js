const PipelineRepository = require('../repositories/PipelineRepository');
const PipelineService = require('../services/PipelineService');
const { nowColombiaISO } = require('../utils/time');

module.exports.handler = async (event) => {
  console.log('[SchedulerHandler] Iniciando verificación de tareas programadas en pipelines...');
  
  try {
    const pipelines = await PipelineRepository.getAll();
    const now = new Date();
    
    for (const pipeline of pipelines) {
      if (!pipeline.enabled || !pipeline.schedules || !Array.isArray(pipeline.schedules)) {
        continue;
      }

      let updated = false;
      const updatedSchedules = [...pipeline.schedules];

      for (let i = 0; i < updatedSchedules.length; i++) {
        const schedule = updatedSchedules[i];
        const { input, intervalHours = 5, lastRun, enabled = true } = schedule;

        if (!enabled) continue;

        let shouldRun = false;
        if (!lastRun) {
          shouldRun = true;
        } else {
          const lastRunDate = new Date(lastRun);
          const hoursSinceLastRun = (now - lastRunDate) / (1000 * 60 * 60);
          if (hoursSinceLastRun >= intervalHours) {
            shouldRun = true;
          }
        }

        if (shouldRun) {
          console.log(`[SchedulerHandler] Ejecutando pipeline ${pipeline.pipelineId} para el turno ${input.turno || 'unknown'}`);
          try {
            await PipelineService.start(pipeline.pipelineId, input, { isSync: true, trigger: 'scheduler' });
            updatedSchedules[i] = { ...schedule, lastRun: now.toISOString() };
            updated = true;
          } catch (error) {
            console.error(`[SchedulerHandler] Error ejecutando pipeline ${pipeline.pipelineId}:`, error);
          }
        }
      }

      if (updated) {
        await PipelineRepository.update(pipeline.pipelineId, { schedules: updatedSchedules });
        console.log(`[SchedulerHandler] Pipeline ${pipeline.pipelineId} actualizado con nuevas fechas de ejecución.`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Schedules processed successfully' })
    };
  } catch (error) {
    console.error('[SchedulerHandler] Error crítico:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
