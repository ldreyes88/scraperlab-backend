const ScraperService = require('../services/ScraperService');
const { isValidUrl } = require('../utils/helpers');

exports.scrapeUrl = async (req, res, next) => {
  try {
    const { url, scrapeType } = req.body;

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

    const result = await ScraperService.scrapeUrl(url, true, type);

    res.json(result);
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