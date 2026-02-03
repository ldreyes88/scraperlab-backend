// scraperlab-backend/src/strategies/domain/MercadoLibreStrategy.js
// DEPRECATED: Este archivo se mantiene por retrocompatibilidad.
// Nueva ubicación: src/strategies/domain/mercadolibre.com.co/MercadoLibreDetailStrategy.js

const BaseDomainStrategy = require('./BaseDomainStrategy');
const cheerio = require('cheerio');

class MercadoLibreStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url);
  }

  async getPriceData(url) {
    let method = 'scraperapi-method';
    try {
      // MercadoLibre no requiere render (es SSR, no SPA)
      // Solo se envían los parámetros configurados en el dominio
      const html = await this.fetchHtml(url, {});
      
      const $ = cheerio.load(html);

      console.log(`[MercadoLibre] Título: "${$('title').text().trim()}"`);

      let currentPrice = null;
      let originalPrice = null;

      // 1. INTENTO: Buscar en SCRIPTS (Melidata / Preloaded State / Component State)
      $('script').each((i, el) => {
        const content = $(el).html();
        if (!content || (!content.includes('melidata') && !content.includes('original_value'))) return;

        const originalMatch = content.match(/"original_(?:price|value)":\s*(\d+)/);
        if (originalMatch && !originalPrice) {
          originalPrice = originalMatch[1];
        }

        const currentMatch = content.match(/"(?:price|value)":\s*(\d+)/);
        if (currentMatch && !currentPrice) {
          currentPrice = currentMatch[1];
        }
      });

      // 2. FALLBACK: EXTRAER DE METADATOS (JSON-LD)
      if (!currentPrice) {
        const jsonLd = $('script[type="application/ld+json"]');
        jsonLd.each((i, el) => {
          try {
            const data = JSON.parse($(el).html());
            if (data.offers) {
              currentPrice = data.offers.lowPrice || data.offers.price;
            }
          } catch (e) {}
        });
      }

      // 3. FALLBACK FINAL: SELECTORES CSS
      if (!currentPrice || !originalPrice) {
        const selCurrent = $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text() ||
          $('.price-tag-fraction').first().text();

        const selOriginal = $('.ui-pdp-price__original-value .andes-money-amount__fraction').first().text() ||
          $('.price-tag-line-through .andes-money-amount__fraction').first().text();

        if (!currentPrice) currentPrice = selCurrent;
        if (!originalPrice) originalPrice = selOriginal;
      }

      const finalize = (val) => {
        if (!val) return 0;
        return parseInt(val.toString().replace(/\D/g, '')) || 0;
      };

      const finalCurrent = finalize(currentPrice);
      const finalOriginal = finalize(originalPrice || currentPrice);

      if (finalCurrent === 0) {
        if (html.includes('nav-header-captcha') || html.includes('challenge')) {
          throw new Error("MercadoLibre detectó el bot (Captcha).");
        }
        throw new Error("No se pudo extraer el precio de MercadoLibre.");
      }

      return this.formatResponse({
        success: true,
        marketplace: 'MercadoLibre',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en MercadoLibreStrategy:', error.message);
      return this.formatResponse({
        success: false,
        error: error.message,
        marketplace: 'MercadoLibre',
        method,
        url
      });
    }
  }
}

module.exports = MercadoLibreStrategy;