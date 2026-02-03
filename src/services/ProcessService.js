const ProcessRepository = require('../repositories/ProcessRepository');

class ProcessService {
  /**
   * Obtener logs recientes
   */
  static async getRecentLogs(limit = 100) {
    return await ProcessRepository.getRecent(limit);
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
