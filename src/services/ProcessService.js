const ProcessRepository = require('../repositories/ProcessRepository');
const ProcessDetailRepository = require('../repositories/ProcessDetailRepository');
const ScraperService = require('./ScraperService');
const { v4: uuidv4 } = require('uuid');

class ProcessService {
  /**
   * Obtener logs recientes
   */
  static async getRecentLogs(limit = 100) {
    return await ProcessRepository.getRecent(limit);
  }

  /**
   * Obtener procesos con paginación y filtros
   */
  static async getPaginatedLogs(page = 1, pageSize = 20, filters = {}) {
    return await ProcessRepository.getPaginated(page, pageSize, filters);
  }

  /**
   * Crear proceso batch
   */
  static async createBatchProcess(userId, userEmail, urls, defaultScrapeType = 'detail') {
    try {
      // Validar URLs
      if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error('Se requiere un array de URLs');
      }

      // Crear proceso padre
      const process = await ProcessRepository.createBatchProcess({
        userId,
        userEmail,
        totalUrls: urls.length,
        status: 'pending'
      });

      return process;
    } catch (error) {
      console.error('Error creating batch process:', error);
      throw error;
    }
  }

  /**
   * Procesar batch: scrape todas las URLs y guarda detalles
   */
  static async processBatch(processId, urls, scrapeType = 'detail') {
    try {
      // Actualizar status a processing
      await ProcessRepository.updateStatus(processId, 'processing');

      let successCount = 0;
      let failedCount = 0;
      const details = [];

      // Procesar cada URL
      for (const urlData of urls) {
        const url = typeof urlData === 'string' ? urlData : urlData.url;
        const type = typeof urlData === 'object' ? (urlData.scrapeType || scrapeType) : scrapeType;

        try {
          // Hacer scraping (sin guardar log individual)
          const result = await ScraperService.scrapeUrl(url, false, type);

          const detail = {
            processId,
            url,
            domainId: result.metadata.domain,
            scraperProvider: result.metadata.provider,
            scrapeType: type,
            success: true,
            responseTime: result.metadata.responseTime,
            data: result.data
          };

          details.push(detail);
          successCount++;
        } catch (error) {
          const detail = {
            processId,
            url,
            scrapeType: type,
            success: false,
            error: error.message
          };

          details.push(detail);
          failedCount++;
        }
      }

      // Guardar todos los detalles en batch
      await ProcessDetailRepository.createBatch(details);

      // Actualizar contadores en proceso padre
      await ProcessRepository.updateBatchCounters(
        processId,
        successCount,
        failedCount,
        'completed'
      );

      return {
        processId,
        totalUrls: urls.length,
        successCount,
        failedCount,
        status: 'completed'
      };
    } catch (error) {
      console.error('Error processing batch:', error);
      
      // Marcar proceso como fallido
      await ProcessRepository.updateStatus(processId, 'failed');
      
      throw error;
    }
  }

  /**
   * Obtener detalles de un batch
   */
  static async getBatchDetails(processId, page = 1, pageSize = 20) {
    try {
      // Calcular lastKey para paginación
      let lastKey = null;
      if (page > 1) {
        // Para páginas > 1, necesitamos obtener el lastKey de la página anterior
        // Esto es una simplificación; en producción deberías cachear los lastKeys
        const skipItems = (page - 1) * pageSize;
        const prevResult = await ProcessDetailRepository.getByProcessId(processId, skipItems);
        if (prevResult.length === skipItems) {
          lastKey = {
            logId: prevResult[prevResult.length - 1].logId,
            processId: processId
          };
        }
      }

      const result = await ProcessDetailRepository.getPaginated(processId, lastKey, pageSize);

      return {
        items: result.items,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          hasNextPage: result.hasMore,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting batch details:', error);
      throw error;
    }
  }

  /**
   * Obtener procesos por usuario
   */
  static async getUserProcesses(userId, limit = 50) {
    return await ProcessRepository.getByUser(userId, limit);
  }

  /**
   * Obtener logs de un dominio específico
   */
  static async getLogsByDomain(domainId, limit = 50) {
    return await ProcessRepository.getByDomain(domainId, limit);
  }

  /**
   * Obtener estadísticas generales
   */
  static async getStats() {
    const logs = await ProcessRepository.getRecent(1000);
    
    const stats = {
      total: logs.length,
      successful: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success).length,
      avgResponseTime: 0,
      byProvider: {},
      byDomain: {},
      recentErrors: []
    };

    // Calcular promedio de tiempo de respuesta
    const responseTimes = logs
      .filter(l => l.responseTime)
      .map(l => l.responseTime);
    
    if (responseTimes.length > 0) {
      stats.avgResponseTime = Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      );
    }

    // Agrupar por provider
    logs.forEach(log => {
      const provider = log.scraperProvider || 'unknown';
      if (!stats.byProvider[provider]) {
        stats.byProvider[provider] = { total: 0, successful: 0, failed: 0 };
      }
      stats.byProvider[provider].total++;
      if (log.success) {
        stats.byProvider[provider].successful++;
      } else {
        stats.byProvider[provider].failed++;
      }
    });

    // Agrupar por dominio
    logs.forEach(log => {
      const domain = log.domainId || 'unknown';
      if (!stats.byDomain[domain]) {
        stats.byDomain[domain] = { total: 0, successful: 0, failed: 0 };
      }
      stats.byDomain[domain].total++;
      if (log.success) {
        stats.byDomain[domain].successful++;
      } else {
        stats.byDomain[domain].failed++;
      }
    });

    // Últimos errores
    stats.recentErrors = logs
      .filter(l => !l.success)
      .slice(0, 10)
      .map(l => ({
        logId: l.logId,
        url: l.url,
        error: l.error,
        timestamp: l.timestamp,
        provider: l.scraperProvider
      }));

    return stats;
  }

  /**
   * Obtener estadísticas de un dominio específico
   */
  static async getDomainStats(domainId) {
    const logs = await ProcessRepository.getByDomain(domainId, 500);
    
    const stats = {
      domainId,
      total: logs.length,
      successful: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success).length,
      avgResponseTime: 0,
      successRate: 0,
      lastScrape: null,
      recentErrors: []
    };

    // Calcular promedio de tiempo de respuesta
    const responseTimes = logs
      .filter(l => l.responseTime)
      .map(l => l.responseTime);
    
    if (responseTimes.length > 0) {
      stats.avgResponseTime = Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      );
    }

    // Success rate
    if (stats.total > 0) {
      stats.successRate = Math.round((stats.successful / stats.total) * 100);
    }

    // Último scrape
    if (logs.length > 0) {
      stats.lastScrape = logs[0].timestamp;
    }

    // Errores recientes
    stats.recentErrors = logs
      .filter(l => !l.success)
      .slice(0, 5)
      .map(l => ({
        url: l.url,
        error: l.error,
        timestamp: l.timestamp
      }));

    return stats;
  }

  /**
   * Eliminar un log
   */
  static async deleteLog(logId) {
    return await ProcessRepository.delete(logId);
  }
}

module.exports = ProcessService;
