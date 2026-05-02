const ProcessRepository = require('../repositories/ProcessRepository');
const ProcessDetailRepository = require('../repositories/ProcessDetailRepository');
const DomainConfigService = require('./DomainConfigService');
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
   * Obtener un proceso por ID
   */
  static async getById(processId) {
    return await ProcessRepository.getById(processId);
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
          // Categorizar error del batch
          let errorType = 'scraping_error';
          const msg = error.message.toLowerCase();
          if (msg.includes('status code') || msg.includes('api')) {
            errorType = 'api_error';
          } else if (msg.includes('extraction') || msg.includes('title not found')) {
            errorType = 'extraction_error';
          }

          const detail = {
            processId,
            url,
            scrapeType: type,
            success: false,
            error: error.message,
            errorType
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
            detailId: prevResult[prevResult.length - 1].detailId,
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
    // Obtenemos una muestra más grande para las estadísticas diarias
    const logs = await ProcessRepository.getRecent(2000);
    const allDomains = await DomainConfigService.getAllConfigs();
    
    const stats = {
      total: logs.length,
      successful: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success).length,
      avgResponseTime: 0,
      errorTypes: {
        api_error: logs.filter(l => l.errorType === 'api_error').length,
        scraping_error: logs.filter(l => l.errorType === 'scraping_error').length,
        extraction_error: logs.filter(l => l.errorType === 'extraction_error').length,
        unknown: logs.filter(l => !l.success && !l.errorType).length
      },
      byProvider: {},
      byDomain: {},
      domainHealth: {
        total: allDomains.length,
        active: allDomains.filter(d => d.status_service === 'active').length,
        failed: allDomains.filter(d => d.status_service === 'failed').length
      },
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

    // Agrupar por dominio e integrar salud actual
    logs.forEach(log => {
      const domainId = log.domainId || 'unknown';
      if (!stats.byDomain[domainId]) {
        const domainConfig = allDomains.find(d => d.domainId === domainId);
        stats.byDomain[domainId] = { 
          total: 0, 
          successful: 0, 
          failed: 0, 
          failureRate: 0,
          currentStatus: domainConfig?.status_service || 'unknown',
          lastError: domainConfig?.last_scrape_error || null
        };
      }
      stats.byDomain[domainId].total++;
      if (log.success) {
        stats.byDomain[domainId].successful++;
      } else {
        stats.byDomain[domainId].failed++;
      }
      
      // Calcular tasa de fallo porcentual
      if (stats.byDomain[domainId].total > 0) {
        stats.byDomain[domainId].failureRate = Math.round(
          (stats.byDomain[domainId].failed / stats.byDomain[domainId].total) * 100
        );
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
        errorType: l.errorType,
        timestamp: l.timestamp,
        provider: l.scraperProvider
      }));

    return stats;
  }

  /**
   * Genera un reporte detallado de salud combinando dominios y procesos
   */
  static async getHealthReport() {
    const allDomains = await DomainConfigService.getAllConfigs();
    const recentLogs = await ProcessRepository.getRecent(500);
    
    const report = {
      summary: {
        totalDomains: allDomains.length,
        healthyDomains: allDomains.filter(d => d.status_service === 'active').length,
        failedDomains: allDomains.filter(d => d.status_service === 'failed').length,
        globalSuccessRate: 0
      },
      domains: allDomains.map(domain => {
        const domainLogs = recentLogs.filter(l => l.domainId === domain.domainId);
        const failedLogs = domainLogs.filter(l => !l.success);
        
        return {
          domainId: domain.domainId,
          status: domain.status_service || 'active',
          lastError: domain.last_scrape_error,
          lastErrorType: domain.last_error_type,
          enabled: domain.enabled,
          stats: {
            totalRecent: domainLogs.length,
            failedRecent: failedLogs.length,
            successRate: domainLogs.length > 0 
              ? Math.round(((domainLogs.length - failedLogs.length) / domainLogs.length) * 100) 
              : 100
          },
          errorsByCategory: {
            api: failedLogs.filter(l => l.errorType === 'api_error').length,
            scraping: failedLogs.filter(l => l.errorType === 'scraping_error').length,
            extraction: failedLogs.filter(l => l.errorType === 'extraction_error').length
          }
        };
      })
    };

    if (recentLogs.length > 0) {
      const globalSuccess = recentLogs.filter(l => l.success).length;
      report.summary.globalSuccessRate = Math.round((globalSuccess / recentLogs.length) * 100);
    }

    return report;
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
