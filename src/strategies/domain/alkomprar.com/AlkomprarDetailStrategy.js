// scraperlab-backend/src/strategies/domain/alkomprar.com/AlkomprarDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class AlkomprarDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'GAProductData-Extract';
    try {
      // Alkomprar requiere renderizado para cargar los precios dinámicamente
      const html = await this.fetchHtml(url, {
        render: true,
        ...domainConfig.providerConfig
      });
      const $ = cheerio.load(html);

      console.log(`[Alkomprar] HTML recibido: ${html.length} caracteres`);

      let currentPrice = null;
      let originalPrice = null;

      // 1. INTENTO: Buscar en scripts el objeto GAProductData (DataLayer)
      // Es idéntico a Alkosto y Ktronix (misma plataforma)
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
        currentPrice = $('meta[itemprop="price"]').attr('content') || $('[itemprop="price"]').attr('content');
      }

      if (!currentPrice || this.cleanPrice(currentPrice) === 0) {
        throw new Error('No se pudo extraer el precio de Alkomprar');
      }

      return this.formatResponse({
        success: true,
        marketplace: 'Alkomprar',
        currentPrice,
        originalPrice,
        method,
        url
      });

    } catch (error) {
      console.error('Error en AlkomprarDetailStrategy:', error.message);
      return this.formatResponse({
        success: false,
        marketplace: 'Alkomprar',
        error: error.message,
        method,
        url
      });
    }
  }
}

module.exports = AlkomprarDetailStrategy;
