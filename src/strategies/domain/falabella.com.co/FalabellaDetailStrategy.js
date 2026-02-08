// scraperlab-backend/src/strategies/domain/falabella.com.co/FalabellaDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class FalabellaStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'Selectors-NextData';
    try {
      // Configuración de provider viene exclusivamente de la BD (providerConfig)
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      
      const $ = cheerio.load(html);

      let currentPrice = null;
      let originalPrice = null;

      // 1. Intentar extraer del atributo data-event-price (Precio Actual)
      const eventPriceAttr = $('li[data-event-price]').attr('data-event-price');
      if (eventPriceAttr) {
        currentPrice = eventPriceAttr;
      }

      // 2. Intentar extraer del atributo data-normal-price (Precio Original)
      const normalPriceAttr = $('li[data-normal-price]').attr('data-normal-price');
      if (normalPriceAttr) {
        originalPrice = normalPriceAttr;
      }

      // 3. FALLBACK: Selectores CSS comunes
      if (!currentPrice) {
        currentPrice = $('.prices-0 .primary').first().text() ||
          $('#testId-pod-prices-current').text() ||
          $('.copy12.primary.high').first().text();
      }

      if (!originalPrice) {
        originalPrice = $('.prices-1 .primary').first().text() ||
          $('.copy10.primary.normal').first().text();
      }

      // 4. FALLBACK: Extraer del objeto __NEXT_DATA__
      if (!currentPrice) {
        const nextData = $('#__NEXT_DATA__').html();
        if (nextData) {
          try {
            const json = JSON.parse(nextData);
            const product = json.props.pageProps.productData;
            if (product && product.prices && product.prices.length > 0) {
              currentPrice = product.prices[0].eventPrice || product.prices[0].price[0];
              originalPrice = product.prices[0].normalPrice || originalPrice;
            }
          } catch (e) {
            // Ignorar error de parseo
          }
        }
      }

      // Si no hay precio actual tras todos los intentos, lanzamos error
      if (!currentPrice) {
        throw new Error("No se pudo extraer el precio de Falabella (selectores no encontrados)");
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Falabella',
        currentPrice,
        originalPrice: originalPrice || currentPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en FalabellaStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Falabella',
        error: error.message,
        method: 'Error-Extraction',
        url
      });
    }
  }
}

module.exports = FalabellaStrategy;