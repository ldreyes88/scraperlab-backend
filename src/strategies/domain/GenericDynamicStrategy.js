// scraperlab-backend/src/strategies/domain/GenericDynamicStrategy.js

const BaseDomainStrategy = require('./BaseDomainStrategy');
const cheerio = require('cheerio');

/**
 * Estrategia Genérica que depende 100% de la configuración en Base de Datos.
 * Se usa para dominios que no requieren lógica compleja de parsing (scripts, dlayers, etc)
 * o como fallback universal.
 */
class GenericDynamicStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    const scrapeType = domainConfig.scrapeType || 'detail';
    let method = `DB-Dynamic-${scrapeType}`;
    
    try {
      // 1. Obtener HTML respetando providerConfig de la BD
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      const $ = cheerio.load(html);

      // 2. Determinar qué grupo de selectores usar
      // Soporta estructura plana (legacy detail) o anidada por tipo
      let selectors = domainConfig.selectors || {};
      if (selectors[scrapeType]) {
        selectors = selectors[scrapeType];
      }

      // 3. Ejecutar extracción según el tipo
      if (scrapeType === 'search') {
        return this.handleSearchExtraction($, selectors, url, domainConfig.domainId);
      }

      // Caso 'detail' o 'searchSpecific' (ambos retornan un solo objeto)
      const extractedData = this.applySelectors($, selectors, url);

      // Fallback universal para Detail si falla por selectores
      if (!extractedData.currentPrice || this.cleanPrice(extractedData.currentPrice) === 0) {
        extractedData.currentPrice = extractedData.currentPrice || 
          $('meta[property="product:price:amount"]').attr('content') ||
          $('[itemprop="price"]').attr('content');
          
        extractedData.title = extractedData.title || 
          $('meta[property="og:title"]').attr('content') || 
          $('title').text().trim();
      }

      if (scrapeType === 'searchSpecific') {
        return this.formatSearchSpecificResponse({
          success: true,
          marketplace: domainConfig.domainId,
          currentPrice: extractedData.currentPrice,
          originalPrice: extractedData.originalPrice,
          title: extractedData.title,
          image: extractedData.image,
          productUrl: extractedData.url,
          method,
          url
        });
      }

      return this.formatResponse({
        success: true,
        marketplace: domainConfig.domainId,
        method,
        url,
        data: extractedData
      });

    } catch (error) {
      console.error(`Error en GenericDynamicStrategy (${scrapeType}) para ${url}:`, error.message);
      return (scrapeType === 'search') 
        ? this.formatSearchResponse({ success: false, error: error.message, url })
        : this.formatResponse({ success: false, error: error.message, url });
    }
  }

  /**
   * Maneja la extracción de múltiples productos para el tipo 'search'
   */
  handleSearchExtraction($, selectors, url, marketplace) {
    const results = [];
    const container = selectors.containerSelector;

    if (!container) {
      throw new Error('containerSelector no definido para tipo search en la base de datos');
    }

    $(container).each((i, el) => {
      const item = $(el);
      const row = {
        title: selectors.titleSelector ? item.find(selectors.titleSelector).first().text().trim() : '',
        currentPrice: selectors.priceSelector ? item.find(selectors.priceSelector).first().text().trim() : '',
        originalPrice: selectors.originalPriceSelector ? item.find(selectors.originalPriceSelector).first().text().trim() : '',
        image: selectors.imageSelector ? (item.find(selectors.imageSelector).attr('src') || item.find(selectors.imageSelector).attr('data-src')) : '',
        url: selectors.urlSelector ? item.find(selectors.urlSelector).attr('href') : ''
      };

      // Limpieza de URL si es relativa
      if (row.url && !row.url.startsWith('http')) {
        try {
          const baseUrl = new URL(url);
          row.url = `${baseUrl.protocol}//${baseUrl.hostname}${row.url.startsWith('/') ? '' : '/'}${row.url}`;
        } catch (e) {}
      }

      if (row.title || row.currentPrice) {
        results.push(row);
      }
    });

    return this.formatSearchResponse({
      success: true,
      marketplace,
      results,
      method: 'DB-Dynamic-Search',
      url
    });
  }
}

module.exports = GenericDynamicStrategy;
