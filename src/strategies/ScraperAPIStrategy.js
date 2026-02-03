const BaseStrategy = require('./BaseStrategy');
const cheerio = require('cheerio');

class ScraperAPIStrategy extends BaseStrategy {
  constructor() {
    super('ScraperAPI');
    this.apiKey = process.env.SCRAPER_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('SCRAPER_API_KEY no configurado');
    }
  }

  async scrape(url, domainConfig) {
    const { providerConfig, selectors } = domainConfig;
    // Normalizar y validar la URL
    const normalizedUrl = this.normalizeUrl(url);
    // Construir parámetros de ScraperAPI - Solo parámetros requeridos
    const params = {
      api_key: this.apiKey,
      url: normalizedUrl
    };

    // Agregar parámetros opcionales SOLO si están explícitamente definidos
    if (providerConfig.render !== undefined) {
      params.render = providerConfig.render;
    }

    if (providerConfig.premium !== undefined) {
      params.premium = providerConfig.premium;
    }

    if (providerConfig.device_type !== undefined) {
      params.device_type = providerConfig.device_type;
    }

    if (providerConfig.country_code !== undefined) {
      params.country_code = providerConfig.country_code;
    }

    if (providerConfig.wait !== undefined && providerConfig.wait > 0) {
      params.wait = providerConfig.wait;
    }
    
    if (providerConfig.wait_for_selector !== undefined && providerConfig.wait_for_selector !== '') {
      params.wait_for_selector = providerConfig.wait_for_selector;
    }

    // Headers personalizados
    const config = {
      params,
      timeout: 60000
    };

    if (providerConfig.headers) {
      config.headers = providerConfig.headers;
      params.keep_headers = true;
    }

    // Log de parámetros finales y URL completa
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (key !== 'api_key') acc[key] = value; // Ocultar API key en logs
        return acc;
      }, {})
    ).toString();
    console.log(`[ScraperAPI] URL: https://api.scraperapi.com/?api_key=***&${queryString}`);

    // Hacer request a ScraperAPI
    const html = await this.makeRequest('https://api.scraperapi.com/', config);

    // Si no hay selectores definidos, retornar HTML crudo (para estrategias de dominio)
    if (!selectors || Object.keys(selectors).length === 0) {
      //console.log(`[ScraperAPI] Retornando HTML crudo (${html.length} caracteres)`);
      return html;
    }

    // Si hay selectores, parsear y retornar datos estructurados
    return this.parseHtml(html, selectors, url);
  }

  parseHtml(html, selectors, url) {
    const $ = cheerio.load(html);
    const data = {
      url
    };

    // Extraer datos usando selectores
    if (selectors.priceSelector) {
      data.price = $(selectors.priceSelector).first().text().trim();
    }

    if (selectors.originalPriceSelector) {
      data.originalPrice = $(selectors.originalPriceSelector).first().text().trim();
    }

    if (selectors.titleSelector) {
      data.title = $(selectors.titleSelector).first().text().trim();
    }

    if (selectors.imageSelector) {
      data.image = $(selectors.imageSelector).first().attr('src') || 
                   $(selectors.imageSelector).first().attr('data-src');
    }

    if (selectors.availabilitySelector) {
      data.availability = $(selectors.availabilitySelector).first().text().trim();
    }

    if (selectors.descriptionSelector) {
      data.description = $(selectors.descriptionSelector).first().text().trim();
    }

    // Fallback: buscar en JSON-LD
    if (!data.price) {
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($(el).html());
          if (json['@type'] === 'Product' && json.offers) {
            data.price = json.offers.price || json.offers.lowPrice;
            data.originalPrice = json.offers.highPrice || data.price;
            data.title = data.title || json.name;
            data.image = data.image || json.image;
          }
        } catch (e) {
          // Ignorar errores de parsing
        }
      });
    }

    // Validar que se extrajo al menos el precio
    if (!data.price && !data.title) {
      throw new Error('No se pudo extraer información del producto. Verifica los selectores.');
    }

    return this.formatResponse(data);
  }

  /**
   * Normaliza y valida la URL para asegurar que esté correctamente codificada
   */
  normalizeUrl(url) {
    try {
      // Parsear la URL
      const urlObj = new URL(url);
      
      // Reconstruir los parámetros de búsqueda correctamente codificados
      const params = new URLSearchParams();
      
      for (const [key, value] of urlObj.searchParams.entries()) {
        // Limpiar espacios extras y normalizar el valor
        const cleanValue = value.trim().replace(/\s+/g, ' ');
        params.append(key, cleanValue);
      }
      
      // Reconstruir la URL con parámetros correctamente codificados
      urlObj.search = params.toString();
      
      return urlObj.toString();
    } catch (error) {
      console.warn(`[ScraperAPI] Error normalizando URL, usando original: ${error.message}`);
      return url;
    }
  }
}

module.exports = ScraperAPIStrategy;