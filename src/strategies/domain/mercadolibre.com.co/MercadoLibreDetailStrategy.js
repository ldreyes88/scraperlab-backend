// scraperlab-backend/src/strategies/domain/mercadolibre.com.co/MercadoLibreDetailStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

class MercadoLibreStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getPriceData(url, domainConfig);
  }

  async getPriceData(url, domainConfig = {}) {
    let method = 'scraperapi-method';
    try {
      // MercadoLibre no requiere render (es SSR, no SPA)
      // Usar solo la configuración que viene en domainConfig
      const html = await this.fetchHtml(url, domainConfig.providerConfig || {});
      
      const $ = cheerio.load(html);

      // Debug mejorado
      console.log(`[MercadoLibre] HTML recibido: ${html.length} caracteres`);
      console.log(`[MercadoLibre] Título: "${$('title').text().trim()}"`);
      
      // Verificar si hay captcha o bloqueo antes de intentar extraer precios
      if (html.includes('nav-header-captcha') || html.includes('challenge') || html.includes('robot_check')) {
        throw new Error("MercadoLibre detectó el bot (Captcha/Challenge).");
      }
      
      // Si el HTML es muy pequeño, probablemente hay un problema
      if (html.length < 5000) {
        console.log('[MercadoLibre] ⚠️ HTML muy pequeño, posible bloqueo');
      }

      let currentPrice = null;
      let originalPrice = null;

      // Debug: contar scripts disponibles
      const totalScripts = $('script').length;

      // 1. INTENTO: Buscar en SCRIPTS (Melidata / Preloaded State / Component State)
      let scriptsChecked = 0;
      $('script').each((i, el) => {
        const content = $(el).html();
        if (!content) return;
        
        // Buscar diferentes patrones en los scripts
        if (content.includes('melidata') || content.includes('original_value') || 
            content.includes('price') || content.includes('__PRELOADED_STATE__')) {
          scriptsChecked++;
          
          // Intentar extraer precio original
          const originalMatch = content.match(/"original_(?:price|value)":\s*(\d+(?:\.\d+)?)/);
          if (originalMatch && !originalPrice) {
            originalPrice = originalMatch[1];
          }

          // Intentar extraer precio actual - buscar "price" pero no "original_price"
          const currentMatch = content.match(/"price":\s*(\d+(?:\.\d+)?)/);
          if (currentMatch && !currentPrice) {
            currentPrice = currentMatch[1];
          }
          
          // También buscar pattern "value" que no sea "original_value"
          if (!currentPrice) {
            const valueMatch = content.match(/(?<!"original_)"value":\s*(\d+(?:\.\d+)?)/);
            if (valueMatch) {
              currentPrice = valueMatch[1];
            }
          }
        }
      });
      
      //console.log(`[MercadoLibre] Scripts revisados: ${scriptsChecked}/${totalScripts}`);

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
          $('.price-tag-fraction').first().text() ||
          $('[class*="price"] [class*="fraction"]').first().text();

        const selOriginal = $('.ui-pdp-price__original-value .andes-money-amount__fraction').first().text() ||
          $('.price-tag-line-through .andes-money-amount__fraction').first().text() ||
          $('[class*="original"] [class*="fraction"]').first().text();

        //if (selCurrent) console.log(`[MercadoLibre] Precio actual (CSS): ${selCurrent}`);
        //if (selOriginal) console.log(`[MercadoLibre] Precio original (CSS): ${selOriginal}`);
        
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
        throw new Error("No se pudo extraer el precio de MercadoLibre. Verifica los selectores o el HTML recibido.");
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