const ProcessService = require('../services/ProcessService');

exports.getLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    // SOLO filtrar por userId si viene explícitamente en la query
    // Los datos antiguos no tienen userId, así que no filtrar por defecto
    const userId = req.query.userId; 
    const processType = req.query.processType; // 'simple' o 'batch'
    const from = req.query.from;
    const to = req.query.to;
    const search = req.query.search; // Búsqueda por dominio/URL
    const status = req.query.status; // 'success', 'error', o 'all'

    // Log para debugging de filtros de fecha
    if (from || to) {
      console.log('[Process Handler] Filtros de fecha:', { from, to });
    }

    // Si no hay paginación, usar método antiguo para retrocompatibilidad
    if (!req.query.page) {
      const logs = await ProcessService.getRecentLogs(limit);
      return res.json({
        success: true,
        data: logs,
        total: logs.length
      });
    }

    const result = await ProcessService.getPaginatedLogs(page, limit, {
      userId,
      processType,
      from,
      to,
      search,
      status
    });

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

exports.getLogsByDomain = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const logs = await ProcessService.getLogsByDomain(domainId, limit);
    
    res.json({
      success: true,
      data: logs,
      total: logs.length,
      domainId
    });
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await ProcessService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

exports.getDomainStats = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const stats = await ProcessService.getDomainStats(domainId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteLog = async (req, res, next) => {
  try {
    const { logId } = req.params;
    await ProcessService.deleteLog(logId);
    
    res.json({
      success: true,
      message: `Log ${logId} eliminado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.getBatchDetails = async (req, res, next) => {
  try {
    const { processId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!processId) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: processId'
      });
    }

    const result = await ProcessService.getBatchDetails(processId, page, limit);

    res.json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};
