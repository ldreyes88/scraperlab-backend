// scraperlab-backend/src/strategies/domain/movistar.com.co/MovistarDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class MovistarDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'CSS-StickyBar';
    try {
      // Movistar suele cargar bien con renderizado básico
      // Configuración de provider viene exclusivamente de la BD (providerConfig)
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      const $ = cheerio.load(html);

      console.log(`[Movistar] HTML recibido: ${html.length} caracteres`);

      let currentPrice = null;
      let originalPrice = null;

      // 1. INTENTO: Selectores del Sticky Bar
      currentPrice = $('.regularPrice-sticky').first().text();
      originalPrice = $('.previusPrice-sticky').first().text();

      // 2. FALLBACK: Selectores principales de la página (Detalle del producto)
      if (!currentPrice || currentPrice === '') {
        method = 'CSS-DetailCard';
        currentPrice = $('.c-card-detail__number').first().text();
      }
      if (!originalPrice || originalPrice === '') {
        originalPrice = $('.c-card__price-previous').first().text();
      }

      // 3. FALLBACK: Metadatos SEO (Itemprop - Muy fiable en Movistar/Magento)
      if (!currentPrice || currentPrice === '') {
        method = 'Itemprop-Meta';
        currentPrice = $('meta[itemprop="price"]').attr('content');
      }

      if (!currentPrice || this.cleanPrice(currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de Movistar');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Movistar',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en MovistarDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Movistar',
        error: error.message,
        method,
        url
      });
    }
  }
}

module.exports = MovistarDetailStrategy;
