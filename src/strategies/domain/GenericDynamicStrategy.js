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
    try {
      // 1. Obtener HTML respetando providerConfig de la BD
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      const $ = cheerio.load(html);

      // 2. Aplicar selectores dinámicos de la BD
      // Los selectores vienen de domainConfig.selectors
      const extractedData = this.applySelectors($, domainConfig.selectors, url);

      // 3. Validar que al menos se obtuvo el precio
      if (!extractedData.currentPrice || this.cleanPrice(extractedData.currentPrice) === 0) {
        // Si falla por selectores, intentamos buscar meta tags estándar de SEO (Plan C)
        extractedData.currentPrice = extractedData.currentPrice || 
          $('meta[property="product:price:amount"]').attr('content') ||
          $('[itemprop="price"]').attr('content') ||
          $('[itemprop="price"]').text().trim();
          
        extractedData.title = extractedData.title || 
          $('meta[property="og:title"]').attr('content') || 
          $('title').text().trim();
      }

      if (!extractedData.currentPrice) {
        throw new Error(`No se pudo extraer información del dominio usando selectores dinámicos.`);
      }

      return this.formatResponse({
        success: true,
        marketplace: domainConfig.domainId,
        method: 'DB-Dynamic-Selectors (Generic)',
        url,
        data: extractedData
      });

    } catch (error) {
      console.error(`Error en GenericDynamicStrategy para ${url}:`, error.message);
      return this.formatResponse({
        success: false,
        marketplace: domainConfig.domainId || 'Generic',
        error: error.message,
        method: 'Generic-Failure',
        url
      });
    }
  }
}

module.exports = GenericDynamicStrategy;
