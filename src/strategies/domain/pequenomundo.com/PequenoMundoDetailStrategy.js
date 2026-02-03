// scraperlab-backend/src/strategies/domain/pequenomundo.com/PequenoMundoDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class PequenoMundoDetailStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url);
  }

  async getPriceData(url) {
    let method = 'N/A';
    try {
      // PequenoMundo: usar render con configuración básica
      const html = await this.fetchHtml(url, {
        render: true,
        premium: false,
        device_type: 'desktop',
        wait: 1000 // Esperar 1 segundo para que cargue el contenido
      });
      
      const $ = cheerio.load(html);

      console.log(`[PequenoMundo] Título de página: "${$('title').text().trim()}"`);

      let currentPrice = null;
      let originalPrice = null;
      let title = null;
      let image = null;

      // 1. INTENTO: Buscar en JSON-LD (schema.org Product)
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const jsonData = JSON.parse($(el).html());
          
          // Función recursiva para buscar productos
          const searchProduct = (obj) => {
            if (!obj) return;

            // Si encontramos un objeto con @type Product
            if (obj['@type'] === 'Product' || obj['@type'] === 'http://schema.org/Product') {
              if (obj.name && !title) title = obj.name;
              if (obj.image && !image) {
                image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
                if (typeof image === 'object') image = image.url || image['@id'];
              }
              
              if (obj.offers) {
                const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
                if (offers.price && !currentPrice) currentPrice = offers.price;
                if (offers.lowPrice && !currentPrice) currentPrice = offers.lowPrice;
                if (offers.highPrice && !originalPrice) originalPrice = offers.highPrice;
              }
            }

            // Buscar recursivamente en arrays y objetos
            if (Array.isArray(obj)) {
              obj.forEach(searchProduct);
            } else if (typeof obj === 'object') {
              Object.values(obj).forEach(val => {
                if (typeof val === 'object') searchProduct(val);
              });
            }
          };

          searchProduct(jsonData);
          if (currentPrice) method = 'JSON-LD';
        } catch (e) {
          // JSON inválido, continuar
        }
      });

      // 2. FALLBACK: Meta tags OpenGraph y Twitter
      if (!currentPrice) {
        const ogPrice = $('meta[property="product:price:amount"]').attr('content') ||
                       $('meta[property="og:price:amount"]').attr('content');
        const twitterPrice = $('meta[name="twitter:data1"]').attr('content');
        
        if (ogPrice) {
          currentPrice = ogPrice;
          method = 'OpenGraph-Meta';
        } else if (twitterPrice) {
          currentPrice = twitterPrice;
          method = 'Twitter-Meta';
        }
      }

      if (!title) {
        title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('h1').first().text().trim();
      }

      if (!image) {
        image = $('meta[property="og:image"]').attr('content') ||
                $('meta[name="twitter:image"]').attr('content');
      }

      // 3. FALLBACK FINAL: Selectores CSS comunes en tiendas online
      if (!currentPrice) {
        // Intentar selectores comunes de Shopify, WooCommerce, etc.
        const priceSelectors = [
          '.product-price .price',
          '.product__price',
          '.price--main',
          '.current-price',
          '[class*="price"] [class*="current"]',
          '.money',
          '[data-price]'
        ];

        for (const selector of priceSelectors) {
          const priceEl = $(selector).first();
          if (priceEl.length > 0) {
            const priceText = priceEl.text().trim() || priceEl.attr('data-price');
            if (priceText) {
              currentPrice = priceText;
              method = 'CSS-Selectors';
              break;
            }
          }
        }

        // Buscar precio original/tachado
        const originalSelectors = [
          '.product-price .compare-at-price',
          '.was-price',
          '.old-price',
          '[class*="price"] [class*="compare"]',
          's.price',
          'del.price'
        ];

        for (const selector of originalSelectors) {
          const priceEl = $(selector).first();
          if (priceEl.length > 0) {
            const priceText = priceEl.text().trim();
            if (priceText) {
              originalPrice = priceText;
              break;
            }
          }
        }
      }

      // 4. FALLBACK: Buscar en scripts de datos estructurados
      if (!currentPrice) {
        $('script').each((i, el) => {
          const content = $(el).html();
          if (!content) return;

          // Buscar patrones comunes de precio en JavaScript
          const patterns = [
            /"price":\s*["]?(\d+(?:\.\d+)?)/,
            /"currentPrice":\s*["]?(\d+(?:\.\d+)?)/,
            /"salePrice":\s*["]?(\d+(?:\.\d+)?)/,
            /price:\s*["]?(\d+(?:\.\d+)?)/
          ];

          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && !currentPrice) {
              currentPrice = match[1];
              method = 'Script-Data';
              break;
            }
          }
        });
      }

      // Validar que se extrajo un precio
      const finalCurrent = this.cleanPrice(currentPrice);
      const finalOriginal = this.cleanPrice(originalPrice || currentPrice);

      if (finalCurrent === 0) {
        // Verificar si es un problema de detección de bot
        if (html.includes('captcha') || html.includes('challenge') || html.includes('blocked')) {
          throw new Error("PequenoMundo detectó el bot (Captcha/Challenge)");
        }
        throw new Error("No se pudo extraer el precio de PequenoMundo");
      }

      console.log(`[PequenoMundo] Precio encontrado: ${finalCurrent} (método: ${method})`);

      return this.formatResponse({
        success: true,
        marketplace: 'PequenoMundo',
        currentPrice: finalCurrent,
        originalPrice: finalOriginal,
        method,
        url
      });

    } catch (error) {
      console.error('[PequenoMundo] Error en extracción:', error.message);
      return this.formatResponse({
        success: false,
        error: error.message,
        marketplace: 'PequenoMundo',
        method,
        url
      });
    }
  }
}

module.exports = PequenoMundoDetailStrategy;
