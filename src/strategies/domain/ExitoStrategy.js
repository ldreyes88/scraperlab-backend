// scraperlab-backend/src/strategies/domain/ExitoStrategy.js
// DEPRECATED: Este archivo se mantiene por retrocompatibilidad.
// Nueva ubicación: src/strategies/domain/exito.com/ExitoDetailStrategy.js

const BaseDomainStrategy = require('./BaseDomainStrategy');
const cheerio = require('cheerio');

class ExitoStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url);
  }

  async getPriceData(url) {
    let method = 'JSON-LD-Recursive';
    try {
      const html = await this.fetchHtml(url, {
        render: true
      });
      
      const $ = cheerio.load(html);

      let currentPrice = null;
      let originalPrice = null;

      // Buscamos en todos los scripts de tipo JSON-LD
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonData = JSON.parse($(el).html());

          const searchOffers = (obj) => {
            if (!obj) return;

            if (obj.offers) {
              if (obj.offers.price) currentPrice = obj.offers.price;
              if (obj.offers.listPrice) originalPrice = obj.offers.listPrice;
              if (obj.offers.lowPrice) currentPrice = obj.offers.lowPrice;
              if (obj.offers.highPrice && !originalPrice) originalPrice = obj.offers.highPrice;
            }

            if (Array.isArray(obj)) {
              obj.forEach(searchOffers);
            } else if (typeof obj === 'object') {
              Object.values(obj).forEach(val => {
                if (typeof val === 'object') searchOffers(val);
              });
            }
          };

          searchOffers(jsonData);
        } catch (e) {}
      });

      // Fallback VTEX meta tags
      if (!originalPrice && currentPrice) {
        const listPriceTag = $('meta[property="product:price:listPrice"]').attr('content');
        if (listPriceTag) {
          originalPrice = listPriceTag;
          method = 'VTEX-Meta-Tags';
        }
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Exito',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en ExitoStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Exito',
        error: error.message,
        method: 'Error-Request',
        url
      });
    }
  }
}

module.exports = ExitoStrategy;