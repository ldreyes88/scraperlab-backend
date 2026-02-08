// scraperlab-backend/src/strategies/domain/maccenter.com.co/MacCenterDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class MacCenterDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'AdobeAnalytics-Extract';
    try {
      // Mac Center no necesita render, es menos detectable sin él
      const html = await this.fetchHtml(url, {
        render: false,
        premium: false,
        country_code: 'co',
        ...domainConfig.providerConfig
      });
      const $ = cheerio.load(html);

      console.log(`[MacCenter] HTML recibido: ${html.length} caracteres`);

      let currentPrice = null;
      let originalPrice = null;

      // 1. INTENTO: Bloque de Adobe Analytics (fuente más precisa)
      const adobeData = $('#adobeAnalyticsProductData').html();
      if (adobeData) {
        try {
          const data = JSON.parse(adobeData);
          if (data.product_price) {
            currentPrice = data.product_price.sellingPrice;
            originalPrice = data.product_price.basePrice;
          }
        } catch (e) {
          console.warn('[MacCenter] Error al parsear el bloque de Adobe Analytics');
        }
      }

      // 2. FALLBACK: JSON-LD estándar (SEO)
      if (!currentPrice) {
        method = 'JSON-LD';
        $('script[type="application/ld+json"]').each((i, el) => {
          try {
            const json = JSON.parse($(el).html());
            const product = Array.isArray(json) ? json.find(item => item['@type'] === 'Product') : json;
            if (product && product.offers) {
              currentPrice = product.offers.price || product.offers.lowPrice;
            }
          } catch (e) {}
        });
      }

      // 3. FALLBACK: Selectores CSS Visuales (Tema Shopify)
      if (!currentPrice) {
        method = 'CSS-Selectors';
        currentPrice = $('.price-item--sale').first().text() ||
          $('.price__regular .price-item').first().text();
        originalPrice = $('.price-item--regular').first().text();
      }

      if (!currentPrice || this.cleanPrice(currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de Mac Center');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Mac Center',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en MacCenterDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Mac Center',
        error: error.message,
        method,
        url
      });
    }
  }
}

module.exports = MacCenterDetailStrategy;
