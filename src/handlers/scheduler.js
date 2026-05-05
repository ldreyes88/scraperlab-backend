const PipelineRepository = require('../repositories/PipelineRepository');
const PipelineService = require('../services/PipelineService');
const cronParser = require('cron-parser');

module.exports.handler = async (event) => {
  console.log('[SchedulerHandler] Iniciando verificación de cron jobs en pipelines...');
  
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
        const { input, cron, lastRun, enabled = true } = schedule;

        if (!enabled || !cron) continue;

        let shouldRun = false;
        
        try {
          // Obtener la última ejecución programada que ya pasó
          const interval = cronParser.parseExpression(cron, { currentDate: now });
          const lastScheduledRun = interval.prev().toDate();
          const lastRunDate = lastRun ? new Date(lastRun) : new Date(0);

          if (lastRunDate < lastScheduledRun) {
            shouldRun = true;
          }
        } catch (err) {
          console.error(`[SchedulerHandler] Cron inválido en pipeline ${pipeline.pipelineId}: ${cron}`, err.message);
          continue;
        }

        if (shouldRun) {
          console.log(`[SchedulerHandler] Ejecutando cron job para pipeline ${pipeline.pipelineId} (${cron})`);
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
