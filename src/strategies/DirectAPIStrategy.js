const BaseStrategy = require('./BaseStrategy');
const cheerio = require('cheerio');
const https = require('https');

/**
 * DirectAPIStrategy - Estrategia para realizar peticiones HTTP directas (sin proxy).
 * Útil para APIs públicas o sitios sin protecciones agresivas (Captcha/Bot Detection).
 * Costo: $0.
 */
class DirectAPIStrategy extends BaseStrategy {
  constructor() {
    super('DirectAPI');
  }

  /**
   * Realiza el scraping directo de la URL
   * @param {string} url - URL a consultar
   * @param {Object} domainConfig - Configuración del dominio (selectores, headers, etc)
   * @returns {Promise<Object|string>} Datos extraídos o contenido crudo
   */
  async scrape(url, domainConfig = {}) {
    const { providerConfig = {}, selectors } = domainConfig;

    // Configuración para axios
    const config = {
      method: providerConfig.method || 'GET',
      headers: providerConfig.headers || {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      },
      timeout: parseInt(process.env.HTTP_TIMEOUT) || 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    };

    console.log(`[DirectAPI] Consultando URL: ${url}`);

    // Realizar la petición directa
    const responseData = await this.makeRequest(url, config);

    // Si no hay selectores definidos, retornar el contenido crudo (HTML o JSON)
    // Esto permite que GenericDynamicStrategy o estrategias específicas manejen el parseo
    if (!selectors || Object.keys(selectors).length === 0) {
      return responseData;
    }

    // Si hay selectores y la respuesta es un string (asumimos HTML), parsear con Cheerio
    if (typeof responseData === 'string') {
      return this.parseHtml(responseData, selectors, url);
    }

    // Si es un objeto (JSON) y hay selectores, retornamos la respuesta tal cual
    // (En el futuro se podría implementar un JSON extractor aquí si fuera necesario)
    return responseData;
  }

  /**
   * Parsea el HTML usando selectores CSS
   * @param {string} html 
   * @param {Object} selectors 
   * @param {string} url 
   */
  parseHtml(html, selectors, url) {
    const $ = cheerio.load(html);
    const data = { url };

    // Mapeo básico de selectores (similar a ScraperAPIStrategy para mantener consistencia)
    const mapping = {
      price: selectors.priceSelector,
      originalPrice: selectors.originalPriceSelector,
      title: selectors.titleSelector,
      image: selectors.imageSelector,
      availability: selectors.availabilitySelector,
      description: selectors.descriptionSelector
    };

    for (const [key, selector] of Object.entries(mapping)) {
      if (selector) {
        if (key === 'image') {
          data[key] = $(selector).first().attr('src') || $(selector).first().attr('data-src');
        } else {
          data[key] = $(selector).first().text().trim();
        }
      }
    }

    return this.formatResponse(data);
  }
}

module.exports = DirectAPIStrategy;
