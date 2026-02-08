// scraperlab-backend/src/strategies/domain/alkosto.com/AlkostoDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class AlkostoDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'GAProductData-Extract';
    try {
      // Alkosto funciona bien con renderizado básico
      const html = await this.fetchHtml(url, {
        render: true,
        ...domainConfig.providerConfig
      });
      const $ = cheerio.load(html);

      console.log(`[Alkosto] HTML recibido: ${html.length} caracteres`);

      let currentPrice = null;
      let originalPrice = null;

      // 1. INTENTO: Buscar en scripts el objeto GAProductData (DataLayer)
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent && scriptContent.includes('GAProductData')) {
          const priceMatch = scriptContent.match(/price:"(\d+)"/);
          const prevPriceMatch = scriptContent.match(/previousPrice:"(\d+)"/);

          if (priceMatch) currentPrice = priceMatch[1];
          if (prevPriceMatch) originalPrice = prevPriceMatch[1];
        }
      });

      // 2. FALLBACK: JSON-LD (SEO estándar)
      if (!currentPrice) {
        method = 'JSON-LD';
        $('script[type="application/ld+json"]').each((i, el) => {
          try {
            const json = JSON.parse($(el).html());
            if (json.offers && json.offers.price) currentPrice = json.offers.price;
            if (json.offers && json.offers.highPrice) originalPrice = json.offers.highPrice;
          } catch (e) {}
        });
      }

      // 3. FALLBACK FINAL: Selectores CSS comunes en Alkosto
      if (!currentPrice) {
        method = 'CSS-Selectors';
        currentPrice = $('.price').first().text() || $('.alk-main-price').first().text();
      }

      if (!currentPrice || this.cleanPrice(currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de Alkosto (DataLayer no encontrado)');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Alkosto',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en AlkostoDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Alkosto',
        error: error.message,
        method,
        url
      });
    }
  }
}

module.exports = AlkostoDetailStrategy;
