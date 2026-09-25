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

      // Obtener contenido (HTML o JSON)
      const content = await this.fetchHtml(url, options);
      
      // 2. Obtener configuración de extracción según el tipo (detail/searchSpecific/search)
      // Nota: DomainConfigService ya resuelve scraperConfig por tipo (aplana detail/search),
      // así que fullConfig ya contiene directamente { jsonPath, css, ... } sin el wrapper de tipo.
      // Fallback a fullConfig[scrapeType] para compatibilidad con configs crudas (ej: tests, seeds).
      const fullConfig = domainConfig.scraperConfig || domainConfig.selectors || {};
      const selectors = fullConfig.jsonPath || fullConfig.css || fullConfig.containerSelector
        ? fullConfig
        : (fullConfig[scrapeType] || {});

      // Si el contenido ya es un objeto (API), usamos extracción directa por JSON Path
      if (content && typeof content === 'object') {
        method += '+JSON-Direct';

        // Si es búsqueda (o tipo no especificado con array), procesar como lista de búsqueda
        if (scrapeType === 'search' || (scrapeType !== 'detail' && (Array.isArray(content) || (content && (Array.isArray(content.results) || Array.isArray(content.data) || Array.isArray(content.items)))))) {
          return this.handleSearchJsonExtraction(content, selectors, url, domainConfig.domainId, domainConfig);
        }

        // Si es detalle y vino un arreglo (ej: consulta SODA con filtro de 1 elemento), tomar el primer elemento
        const targetObj = Array.isArray(content) ? (content[0] || {}) : content;
        const jsonMapping = selectors.jsonPath || selectors.apiFields || selectors || {};
        const extractedData = this.extractFromJson(targetObj, jsonMapping);

        // Fallbacks inteligentes para APIs conocidas (ej: datos.gov.co / SECOP)
        extractedData.title = extractedData.title || 
                              targetObj.nombre_del_procedimiento || 
                              targetObj.descripci_n_del_procedimiento || 
                              targetObj.descripcion_del_procedimiento || 
                              targetObj.title || '';
        extractedData.currentPrice = extractedData.currentPrice || 
                                     targetObj.precio_base || 
                                     targetObj.valor_total_adjudicacion || 
                                     targetObj.price || 0;
        extractedData.url = extractedData.url || 
                            targetObj.urlproceso?.url || 
                            targetObj.url || url;
        
        return this.formatResponse({
          success: true,
          marketplace: domainConfig.domainId,
          method,
          url,
          details: { ...targetObj, ...extractedData, countryCode: domainConfig.countryCode }
        });
      }

      const $ = cheerio.load(content);

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
            const patterns = (selectors.scripts && selectors.scripts.length > 0) 
              ? selectors.scripts 
              : options.scriptPatterns;
            const data = this.extractFromScripts($, patterns);
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

  /**
   * Maneja la extracción de múltiples registros cuando la respuesta es un JSON (API)
   */
  handleSearchJsonExtraction(content, selectors, url, marketplace, domainConfig = {}) {
    const searchConfig = selectors.jsonPath || selectors.apiFields || selectors || {};
    
    let items = content;
    if (!Array.isArray(items)) {
      if (Array.isArray(items.results)) items = items.results;
      else if (Array.isArray(items.data)) items = items.data;
      else if (Array.isArray(items.items)) items = items.items;
      else items = [items];
    }

    const results = items.map(item => {
      if (!item || typeof item !== 'object') return null;

      const title = this.getValueByPath(item, searchConfig.title) || 
                    item.nombre_del_procedimiento || 
                    item.descripci_n_del_procedimiento || 
                    item.descripcion_del_procedimiento || 
                    item.title || 
                    item.name || '';

      const currentPrice = this.getValueByPath(item, searchConfig.currentPrice || searchConfig.price || searchConfig.budget) || 
                           item.precio_base || 
                           item.valor_total_adjudicacion || 
                           item.price || 0;

      const originalPrice = this.getValueByPath(item, searchConfig.originalPrice) || currentPrice;

      const itemUrl = this.getValueByPath(item, searchConfig.url || searchConfig.detailUrl) || 
                      item.urlproceso?.url || 
                      item.url || '';

      const image = this.getValueByPath(item, searchConfig.image) || item.image || '';

      const reference = this.getValueByPath(item, searchConfig.reference) || item.referencia_del_proceso || '';
      const entity = this.getValueByPath(item, searchConfig.entity) || item.entidad || '';
      const nit = this.getValueByPath(item, searchConfig.nit) || item.nit_entidad || '';
      const status = this.getValueByPath(item, searchConfig.status) || item.estado_del_procedimiento || '';
      const publishDate = this.getValueByPath(item, searchConfig.publishDate) || item.fecha_de_publicacion_del || '';
      const unspsc = this.getValueByPath(item, searchConfig.unspsc) || item.codigo_principal_de_categoria || '';
      const phase = this.getValueByPath(item, searchConfig.phase) || item.fase || '';

      return {
        ...item,
        title,
        currentPrice,
        originalPrice,
        url: itemUrl,
        image,
        reference,
        entity,
        nit,
        status,
        publishDate,
        unspsc,
        phase,
        country: domainConfig.countryCode || 'CO'
      };
    }).filter(Boolean);

    return this.formatSearchResponse({
      success: true,
      marketplace,
      results,
      method: 'DB-Dynamic-Search+JSON-Direct',
      url
    });
  }
}

module.exports = GenericDynamicStrategy;
