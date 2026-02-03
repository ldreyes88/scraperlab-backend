// scraperlab-backend/src/strategies/domain/BaseDomainStrategy.js

const cheerio = require('cheerio');

class BaseDomainStrategy {
  constructor(providerStrategy) {
    if (this.constructor === BaseDomainStrategy) {
      throw new Error('BaseDomainStrategy es abstracta y no puede ser instanciada');
    }
    
    this.provider = providerStrategy;
    this.providerName = providerStrategy.providerName;
  }

  /**
   * Método principal que deben implementar las estrategias de dominio
   */
  async scrape(url, domainConfig = {}) {
    throw new Error('El método scrape() debe ser implementado por la estrategia de dominio');
  }

  /**
   * Helper para obtener HTML usando el provider configurado
   * Este método adapta la interfaz de oferty-scraper a scraperlab-backend
   * SOLO incluye en providerConfig los parámetros que se pasan explícitamente
   */
  async fetchHtml(url, options = {}) {

    // SOLO incluir parámetros que están explícitamente definidos en options
    const providerConfig = {};
    
    if (options.render !== undefined) providerConfig.render = options.render;
    if (options.premium !== undefined) providerConfig.premium = options.premium;
    if (options.device_type !== undefined) providerConfig.device_type = options.device_type;
    if (options.wait !== undefined && options.wait > 0) providerConfig.wait = options.wait;
    if (options.wait_for_selector !== undefined && options.wait_for_selector !== null) {
      providerConfig.wait_for_selector = options.wait_for_selector;
    }
    if (options.headers !== undefined && options.headers !== null) providerConfig.headers = options.headers;
    if (options.country_code !== undefined) providerConfig.country_code = options.country_code;

    const domainConfig = {
      providerConfig,
      selectors: {} // No necesitamos selectores para estrategias custom
    };

    // Usar el provider para hacer scraping genérico y obtener el HTML
    const response = await this.provider.scrape(url, domainConfig);
    
    // El provider retorna HTML cuando no hay selectores definidos
    // Necesitamos acceder al HTML crudo
    return response.rawHtml || response;
  }

  /**
   * Formatea la respuesta según el formato de oferty
   * Mantiene compatibilidad con el formato original
   * Usado para tipo: detail (página de producto individual)
   */
  formatResponse({
    success,
    marketplace,
    currentPrice = 0,
    originalPrice = 0,
    method = 'N/A',
    error = null,
    url = ''
  }) {
    const finalCurrent = this.cleanPrice(currentPrice);
    const finalOriginal = this.cleanPrice(originalPrice || currentPrice);

    return {
      success,
      marketplace,
      prices: {
        current: finalCurrent,
        original: finalOriginal,
        discount_percentage: finalOriginal > finalCurrent
          ? Math.round((1 - (finalCurrent / finalOriginal)) * 100)
          : 0,
        currency: 'COP'
      },
      metadata: {
        method,
        timestamp: new Date().toISOString(),
        url
      },
      error
    };
  }

  /**
   * Formatea la respuesta para búsquedas generales (lista de productos)
   * Usado para tipo: search
   */
  formatSearchResponse({
    success,
    marketplace,
    results = [],
    method = 'CSS-Selectors',
    error = null,
    url = ''
  }) {
    return {
      success,
      scrapeType: 'search',
      marketplace,
      results: results.map(item => ({
        title: item.title || '',
        currentPrice: this.cleanPrice(item.currentPrice || 0),
        originalPrice: this.cleanPrice(item.originalPrice || item.currentPrice || 0),
        url: item.url || '',
        image: item.image || '',
        availability: item.availability !== false
      })),
      metadata: {
        totalResults: results.length,
        resultsExtracted: results.length,
        method,
        timestamp: new Date().toISOString(),
        url
      },
      error
    };
  }

  /**
   * Formatea la respuesta para búsqueda específica (primer resultado con datos completos)
   * Usado para tipo: searchSpecific
   */
  formatSearchSpecificResponse({
    success,
    marketplace,
    currentPrice = 0,
    originalPrice = 0,
    title = '',
    image = '',
    productUrl = '',
    method = 'Search-First-Result',
    error = null,
    url = ''
  }) {
    const finalCurrent = this.cleanPrice(currentPrice);
    const finalOriginal = this.cleanPrice(originalPrice || currentPrice);

    return {
      success,
      scrapeType: 'searchSpecific',
      marketplace,
      product: {
        title,
        image,
        url: productUrl
      },
      prices: {
        current: finalCurrent,
        original: finalOriginal,
        discount_percentage: finalOriginal > finalCurrent
          ? Math.round((1 - (finalCurrent / finalOriginal)) * 100)
          : 0,
        currency: 'COP'
      },
      metadata: {
        method,
        timestamp: new Date().toISOString(),
        searchUrl: url
      },
      error
    };
  }

  /**
   * Limpia precios (mantiene compatibilidad con oferty-scraper)
   */
  cleanPrice(val) {
    if (!val) return 0;
    return parseInt(val.toString().replace(/[^\d]/g, '')) || 0;
  }
}

module.exports = BaseDomainStrategy;