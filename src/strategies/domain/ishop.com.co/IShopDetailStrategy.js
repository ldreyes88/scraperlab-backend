// scraperlab-backend/src/strategies/domain/ishop.com.co/IShopDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class IShopDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'AdobeAnalytics-Extract';
    try {
      // iShop no necesita render, es menos detectable sin él
      // Configuración de provider viene exclusivamente de la BD (providerConfig)
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      const $ = cheerio.load(html);

      console.log(`[iShop] HTML recibido: ${html.length} caracteres`);

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
          console.warn('[iShop] Error al parsear el bloque de Adobe Analytics');
        }
      }

      // 2. FALLBACK: JSON-LD (SEO estándar de Shopify)
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

      // 3. FALLBACK: Selectores CSS de Shopify
      if (!currentPrice) {
        method = 'CSS-Selectors';
        currentPrice = $('.price-item--sale').first().text() || $('.price-item').first().text();
        originalPrice = $('.price-item--regular').first().text();
      }

      if (!currentPrice || this.cleanPrice(currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de iShop');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'iShop',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en IShopDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'iShop',
        error: error.message,
        method,
        url
      });
    }
  }
}

module.exports = IShopDetailStrategy;
