// scraperlab-backend/src/strategies/domain/pequenomundo.com/PequenoMundoSearchStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class PequenoMundoSearchStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getSearchResults(url);
  }

  async getSearchResults(url) {
    let method = 'CSS-Selectors';
    try {
      // Obtener HTML de la página de búsqueda
      const html = await this.fetchHtml(url, {
        render: true,
        premium: false,
        device_type: 'desktop',
        wait: 1500 // Esperar más tiempo para que carguen los resultados
      });
      
      const $ = cheerio.load(html);

      console.log(`[PequenoMundo Search] Título de página: "${$('title').text().trim()}"`);

      let results = [];

      // 1. INTENTO: Buscar contenedor de resultados comunes
      const containerSelectors = [
        '.search-results',
        '.product-grid',
        '.products-grid',
        '.collection-grid',
        '[class*="search"] [class*="grid"]',
        '[class*="product-list"]',
        '.grid--uniform',
        '#product-grid'
      ];

      let container = null;
      for (const selector of containerSelectors) {
        const el = $(selector).first();
        if (el.length > 0) {
          container = el;
          console.log(`[PequenoMundo Search] Contenedor encontrado: ${selector}`);
          break;
        }
      }

      // Si no se encontró contenedor, usar todo el body
      if (!container) {
        container = $('body');
      }

      // 2. Buscar items de producto dentro del contenedor
      const itemSelectors = [
        '.product-item',
        '.product-card',
        '.grid-item',
        '.collection-item',
        '[class*="product-"]',
        '[data-product-id]',
        '.item',
        'article[itemtype*="Product"]'
      ];

      let items = null;
      for (const selector of itemSelectors) {
        const found = container.find(selector);
        if (found.length > 0) {
          items = found;
          console.log(`[PequenoMundo Search] Items encontrados (${found.length}): ${selector}`);
          break;
        }
      }

      if (!items || items.length === 0) {
        console.log('[PequenoMundo Search] No se encontraron items con selectores predefinidos');
        // Fallback: buscar por enlace a productos
        items = container.find('a[href*="/product"], a[href*="/productos/"], a[href*="/p/"]').parent();
      }

      // 3. Extraer datos de cada item
      items.each((index, item) => {
        const $item = $(item);

        // Extraer título
        let title = $item.find('h2, h3, h4, .product-title, [class*="title"], [class*="name"]')
          .first()
          .text()
          .trim();

        if (!title) {
          title = $item.find('a').first().attr('title') || 
                  $item.find('img').first().attr('alt') || '';
        }

        // Extraer URL del producto
        let productUrl = $item.find('a').first().attr('href');
        if (productUrl && !productUrl.startsWith('http')) {
          // Convertir URL relativa a absoluta
          const baseUrl = new URL(url).origin;
          productUrl = new URL(productUrl, baseUrl).href;
        }

        // Extraer precio actual
        let currentPrice = null;
        const priceSelectors = [
          '.price',
          '.current-price',
          '[class*="price-current"]',
          '[class*="sale-price"]',
          '.money',
          '[data-price]'
        ];

        for (const selector of priceSelectors) {
          const priceEl = $item.find(selector).first();
          if (priceEl.length > 0) {
            currentPrice = priceEl.text().trim() || priceEl.attr('data-price');
            if (currentPrice) break;
          }
        }

        // Extraer precio original (tachado)
        let originalPrice = null;
        const originalSelectors = [
          '.compare-at-price',
          '.was-price',
          '.old-price',
          '[class*="price-regular"]',
          's.price',
          'del.price'
        ];

        for (const selector of originalSelectors) {
          const priceEl = $item.find(selector).first();
          if (priceEl.length > 0) {
            originalPrice = priceEl.text().trim();
            if (originalPrice) break;
          }
        }

        // Extraer imagen
        let image = $item.find('img').first().attr('src') || 
                   $item.find('img').first().attr('data-src');
        
        if (image && !image.startsWith('http')) {
          const baseUrl = new URL(url).origin;
          image = new URL(image, baseUrl).href;
        }

        // Verificar disponibilidad
        const outOfStockClasses = ['sold-out', 'out-of-stock', 'unavailable'];
        let availability = true;
        for (const cls of outOfStockClasses) {
          if ($item.find(`[class*="${cls}"]`).length > 0 || 
              $item.hasClass(cls)) {
            availability = false;
            break;
          }
        }

        // Solo agregar si tiene datos mínimos (título y precio)
        if (title && (currentPrice || productUrl)) {
          results.push({
            title,
            currentPrice: currentPrice || 0,
            originalPrice: originalPrice || currentPrice || 0,
            url: productUrl || '',
            image: image || '',
            availability
          });
        }
      });

      console.log(`[PequenoMundo Search] Productos extraídos: ${results.length}`);

      if (results.length === 0) {
        throw new Error('No se pudieron extraer productos de la búsqueda');
      }

      return this.formatSearchResponse({
        success: true,
        marketplace: 'PequenoMundo',
        results,
        method,
        url
      });

    } catch (error) {
      console.error('[PequenoMundo Search] Error en extracción:', error.message);
      return this.formatSearchResponse({
        success: false,
        marketplace: 'PequenoMundo',
        results: [],
        method: 'Error',
        error: error.message,
        url
      });
    }
  }
}

module.exports = PequenoMundoSearchStrategy;
