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
      // 1. Preparar configuración de extracción (los flags ya vienen del dominio)
      // Nota: El providerConfig ya viene resuelto (mezclado con overrides) desde el servicio
      let options = { 
        ...(domainConfig.providerConfig || {}),
        // Propagar flags de extracción modular
        useJsonLd: domainConfig.useJsonLd !== false, 
        useMeta: domainConfig.useMeta !== false,
        useNextData: domainConfig.useNextData || false,
        useScripts: domainConfig.useScripts || false,
        useCss: domainConfig.useCss !== false,
        scriptPatterns: domainConfig.scriptPatterns || []
      };

      // Obtener HTML
      const html = await this.fetchHtml(url, options);
      const $ = cheerio.load(html);

      // 2. Obtener configuración de extracción según el tipo (detail/searchSpecific/search)
      // Nota: Soportamos tanto 'scraperConfig' (nuevo) como 'selectors' (legacy)
      const fullConfig = domainConfig.scraperConfig || domainConfig.selectors || {};
      const selectors = fullConfig[scrapeType] || {};

      if (scrapeType === 'search') {
        return this.handleSearchExtraction($, selectors, url, domainConfig.domainId);
      }

      // 3. Pipeline de extracción para Detail / SearchSpecific
      let extractedData = {};
      
      // Orden de prioridad dinámico o por defecto
      const defaultOrder = ['jsonLd', 'nextData', 'scripts', 'meta', 'css'];
      const strategyOrder = domainConfig.strategyOrder || defaultOrder;
      
      // Mapeo de estrategias a funciones y flags
      const strategies = {
        jsonLd: {
          flag: 'useJsonLd',
          execute: () => {
            const jsonLdConfig = selectors.jsonLd || {};
            const data = this.extractJSONLD($, jsonLdConfig);
            if (data.currentPrice) method += '+JSON-LD';
            return data;
          }
        },
        nextData: {
          flag: 'useNextData',
          execute: () => {
            const nextDataConfig = selectors.nextData || {};
            const data = this.extractNextData($, nextDataConfig);
            if (data.currentPrice) method += '+NextData';
            return data;
          }
        },
        scripts: {
          flag: 'useScripts',
          execute: () => {
            const data = this.extractFromScripts($, options.scriptPatterns);
            if (data.currentPrice) method += '+Scripts';
            return data;
          }
        },
        meta: {
          flag: 'useMeta',
          execute: () => {
            const data = this.extractMeta($);
            if (data.currentPrice) method += '+Meta';
            return data;
          }
        },
        css: {
          flag: 'useCss',
          execute: () => {
            const data = this.applySelectors($, selectors, url);
            if (data.currentPrice) method += '+Selectors';
            return data;
          }
        }
      };

      // Ejecutar estrategias según el orden
      for (const strategyKey of strategyOrder) {
        const strategy = strategies[strategyKey];
        if (!strategy) continue;

        // Verificar si la estrategia está habilitada (flag true o no existe flag)
        const isEnabled = strategy.flag === 'always_true' || options[strategy.flag];
        
        if (isEnabled) {
          const result = strategy.execute();
          if (result && Object.keys(result).length > 0) {
            extractedData = this.mergeExternalData(extractedData, result);
          }
        }
      }

      // Fallback universal final para precio si todo falla
      if (!extractedData.currentPrice || this.cleanPrice(extractedData.currentPrice) === 0) {
        extractedData.currentPrice = extractedData.currentPrice || 
          $('meta[property="product:price:amount"]').attr('content') ||
          $('[itemprop="price"]').attr('content');
      }

      // Fallback universal para título siempre que falte
      extractedData.title = extractedData.title || 
        $('meta[property="og:title"]').attr('content') || 
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text().trim();

      // Formatear respuesta según tipo
      if (scrapeType === 'searchSpecific') {
        return this.formatSearchSpecificResponse({
          success: true,
          marketplace: domainConfig.domainId,
          currentPrice: extractedData.currentPrice,
          originalPrice: extractedData.originalPrice,
          title: extractedData.title,
          image: extractedData.image,
          productUrl: extractedData.url || url,
          method,
          url,
          details: { ...extractedData, countryCode: domainConfig.countryCode }
        });
      }

      return this.formatResponse({
        success: true,
        marketplace: domainConfig.domainId,
        method,
        url,
        details: { ...extractedData, countryCode: domainConfig.countryCode }
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
