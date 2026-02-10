const ScraperService = require('../services/ScraperService');
const ProcessService = require('../services/ProcessService');
const ProcessRepository = require('../repositories/ProcessRepository');
const { isValidUrl } = require('../utils/helpers');

const DEMO_MAX_QUERIES = parseInt(process.env.DEMO_MAX_QUERIES || '3', 10);

const buildDemoPayload = (serviceResult) => {
  const raw = serviceResult?.data || {};
  const prices = raw?.prices || {};
  const currentPrice = raw?.currentPrice ?? prices?.current ?? 0;
  const originalPrice = raw?.originalPrice ?? prices?.original ?? currentPrice;
  const discount = raw?.discount ?? prices?.discount_percentage ?? 0;
  const availability = raw?.availability;
  const inStock =
    typeof raw?.inStock === 'boolean'
      ? raw.inStock
      : (typeof availability === 'string'
        ? !/(sin stock|agotado|out of stock|no disponible)/i.test(availability)
        : undefined);

  return {
    success: true,
    marketplace: raw?.marketplace || serviceResult?.marketplace || 'N/A',
    data: {
      currentPrice,
      originalPrice,
      discount,
      ...(typeof inStock === 'boolean' ? { inStock } : {})
    },
    durationMs: serviceResult?.metadata?.responseTime || 0,
    metadata: {
      scrapeType: 'detail',
      domain: serviceResult?.metadata?.domain,
      provider: serviceResult?.metadata?.provider,
      timestamp: serviceResult?.metadata?.timestamp
    }
  };
};

exports.scrapeUrl = async (req, res, next) => {
  try {
    const { url, scrapeType, saveLog } = req.body;
    const userId = req.body.userId || req.user?.userId;
    const userEmail = req.body.userEmail || req.user?.email;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: url'
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }

    // Validar scrapeType si se proporciona
    const validTypes = ['detail', 'search', 'searchSpecific'];
    const type = scrapeType || 'detail'; // Default: 'detail' para retrocompatibilidad
    
    if (scrapeType && !validTypes.includes(scrapeType)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de scraping inválido: '${scrapeType}'. Tipos válidos: ${validTypes.join(', ')}`
      });
    }

    // saveLog: por defecto true. Clientes externos (ej: oferty) pueden enviar false
    // cuando manejan su propio logging (ProcessDetail vinculado a un proceso padre)
    const shouldSaveLog = saveLog !== false;

    const result = await ScraperService.scrapeUrl(url, shouldSaveLog, type, userId, userEmail);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.scrapeDemo = async (req, res, next) => {
  try {
    const { url } = req.body;
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: url'
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No se pudo identificar el usuario autenticado'
      });
    }

    const demoQueries = await ProcessRepository.countByUserAndProcessType(userId, 'demo');
    if (demoQueries >= DEMO_MAX_QUERIES) {
      return res.status(429).json({
        success: false,
        error: `Límite alcanzado: máximo ${DEMO_MAX_QUERIES} consultas en demo por usuario`,
        metadata: {
          limit: DEMO_MAX_QUERIES,
          used: demoQueries,
          remaining: 0
        }
      });
    }

    const result = await ScraperService.scrapeUrl(
      url,
      true,
      'detail',
      userId,
      userEmail,
      'demo'
    );

    const payload = buildDemoPayload(result);
    const used = demoQueries + 1;
    res.json({
      ...payload,
      metadata: {
        ...payload.metadata,
        demoLimit: DEMO_MAX_QUERIES,
        demoUsed: used,
        demoRemaining: Math.max(DEMO_MAX_QUERIES - used, 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.scrapeBatch = async (req, res, next) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: urls (array)'
      });
    }

    // Validar todas las URLs
    const invalidUrls = urls.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs inválidas encontradas',
        invalidUrls
      });
    }

    // Limitar cantidad
    if (urls.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 50 URLs por batch'
      });
    }

    const results = await ScraperService.scrapeMultiple(urls, true);

    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.testScrape = async (req, res, next) => {
  try {
    const { url, providerId, providerConfig } = req.body;

    if (!url || !providerId) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: url, providerId'
      });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }

    const result = await ScraperService.testScrape(url, providerId, providerConfig || {});

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.createBatch = async (req, res, next) => {
  try {
    const { urls, scrapeType } = req.body;
    const userId = req.body.userId || req.user?.userId;
    const userEmail = req.body.userEmail || req.user?.email;

    // Validaciones
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: urls (array)'
      });
    }

    if (urls.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 1000 URLs por batch'
      });
    }

    // Validar que todas las URLs son válidas o son objetos con url
    const invalidUrls = urls.filter(item => {
      const url = typeof item === 'string' ? item : item.url;
      return !url || !isValidUrl(url);
    });

    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Se encontraron URLs inválidas',
        invalidCount: invalidUrls.length
      });
    }

    // Crear proceso batch
    const process = await ProcessService.createBatchProcess(
      userId,
      userEmail,
      urls,
      scrapeType || 'detail'
    );

    // Procesar batch (await necesario en Lambda, fire-and-forget no funciona
    // porque Lambda congela/termina el contexto al enviar la respuesta HTTP)
    const result = await ProcessService.processBatch(process.processId, urls, scrapeType || 'detail');

    res.json({
      success: true,
      data: {
        ...process,
        ...result
      },
      message: 'Batch procesado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};