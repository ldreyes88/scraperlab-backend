const ProcessService = require('../services/ProcessService');

exports.getLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await ProcessService.getRecentLogs(limit);
    
    res.json({
      success: true,
      data: logs,
      total: logs.length
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
