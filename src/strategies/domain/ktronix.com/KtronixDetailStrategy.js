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

      let currentPrice = null;
      let originalPrice = null;

      // 1. INTENTO: Buscar en el objeto GAProductData (DataLayer)
      // Es la forma más fiable en la plataforma de Alkosto/Ktronix
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent && scriptContent.includes('GAProductData')) {
          const priceMatch = scriptContent.match(/price:"(\d+)"/);
          const prevPriceMatch = scriptContent.match(/previousPrice:"(\d+)"/);

          if (priceMatch) currentPrice = priceMatch[1];
          if (prevPriceMatch) originalPrice = prevPriceMatch[1];
        }
      });

      // 2. FALLBACK: Atributos itemprop (SEO estándar)
      if (!currentPrice) {
        method = 'Itemprop-Meta';
        currentPrice = $('[itemprop="price"]').attr('content');
      }

      if (!currentPrice || this.cleanPrice(currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de Ktronix');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Ktronix',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en KtronixDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Ktronix',
        error: error.message,
        method,
        url
      });
    }
  }
}

module.exports = KtronixDetailStrategy;
