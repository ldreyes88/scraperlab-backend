// scraperlab-backend/src/strategies/domain/ktronix.com/KtronixDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class KtronixDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'GAProductData-Extract';
    try {
      // Configuración de provider viene exclusivamente de la BD (providerConfig)
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      const $ = cheerio.load(html);

      console.log(`[Ktronix] HTML recibido: ${html.length} caracteres`);

      // 1. EXTRAER USANDO SELECTORES DE LA BD (DINÁMICO)
      const selectorData = this.applySelectors($, domainConfig.selectors, url);
      if (Object.keys(selectorData).length > 1) { // más que solo la URL
        method = 'DB-Selectors-Applied';
      }

      let currentPrice = null;
      let originalPrice = null;

      // 2. EXTRAER USANDO LÓGICA ESPECÍFICA (DATA LAYER)
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent && scriptContent.includes('GAProductData')) {
          const priceMatch = scriptContent.match(/price:"(\d+)"/);
          const prevPriceMatch = scriptContent.match(/previousPrice:"(\d+)"/);

          if (priceMatch) currentPrice = priceMatch[1];
          if (prevPriceMatch) originalPrice = prevPriceMatch[1];
        }
      });

      // Fusionar ambos resultados
      const finalData = this.mergeExternalData({ currentPrice, originalPrice }, selectorData);

      if (!finalData.currentPrice || this.cleanPrice(finalData.currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de Ktronix');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Ktronix',
        method: currentPrice ? method : 'DB-Selectors-Only',
        url,
        data: finalData
      });

    } catch (error) {
      console.error('Error en KtronixDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Ktronix',
        error: error.message,
        method: 'Error-Generic',
        url
      });
    }
  }
}

module.exports = KtronixDetailStrategy;
