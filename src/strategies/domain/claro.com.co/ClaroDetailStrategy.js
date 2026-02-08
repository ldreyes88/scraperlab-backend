// scraperlab-backend/src/strategies/domain/claro.com.co/ClaroDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class ClaroDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'CSS-Selectors';
    const maxAttempts = 2;
    let currentAttempt = 1;

    while (currentAttempt <= maxAttempts) {
      try {
        console.log(`[Claro] Intento ${currentAttempt} para ${url}`);

        // Configuración de provider viene exclusivamente de la BD (providerConfig)
        const providerOpts = {
          ...domainConfig.providerConfig,
          wait_for_selector: '.priceNowFP'
        };
        const html = await this.fetchHtml(url, providerOpts);

        const $ = cheerio.load(html);

        console.log(`[Claro] HTML recibido: ${html.length} caracteres`);

        // Si el HTML es muy pequeño, ScraperAPI devolvió solo el esqueleto
        if (html.length < 100000 && currentAttempt < maxAttempts) {
          console.warn(`[Claro] HTML recibido muy pequeño (${html.length} bytes). Reintentando...`);
          currentAttempt++;
          continue;
        }

        let currentPriceStr = $('.priceNowFP').first().text();
        let originalPriceStr = $('.priceBeforeCrossed').first().text() || $('.priceBeforeFP').first().text();

        // FALLBACK: Extraer de __NEXT_DATA__
        if (!currentPriceStr || currentPriceStr === '') {
          method = 'NextData-Recursive';
          const nextData = $('#__NEXT_DATA__').html();
          if (nextData) {
            const json = JSON.parse(nextData);
            const find = (obj) => {
              if (!obj || typeof obj !== 'object') return;
              if (obj.priceNowFP || obj.priceNow) {
                currentPriceStr = obj.priceNowFP || obj.priceNow;
                originalPriceStr = obj.priceBeforeFP || obj.priceBefore || originalPriceStr;
                return;
              }
              for (const k in obj) {
                if (currentPriceStr) break;
                find(obj[k]);
              }
            };
            find(json);
          }
        }

        const currentPrice = this.cleanPrice(currentPriceStr);
        const originalPrice = this.cleanPrice(originalPriceStr) || currentPrice;

        if (currentPrice === 0) {
          if (currentAttempt < maxAttempts) {
            currentAttempt++;
            continue;
          }
          throw new Error(`Precio no encontrado (HTML Size: ${html.length} bytes)`);
        }

        return this.formatResponse({
          success: true,
          marketplace: 'Claro',
          currentPrice,
          originalPrice,
          method,
          url
        });

      } catch (error) {
        if (currentAttempt >= maxAttempts) {
          console.error('Error en ClaroDetailStrategy:', error.message);
          return this.formatResponse({
            success: false,
            marketplace: 'Claro',
            error: error.message,
            method,
            url
          });
        }
        currentAttempt++;
      }
    }
  }
}

module.exports = ClaroDetailStrategy;
