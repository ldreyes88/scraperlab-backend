const BaseStrategy = require('./BaseStrategy');
const cheerio = require('cheerio');

class OxylabsStrategy extends BaseStrategy {
  constructor() {
    super('Oxylabs');
    this.username = process.env.OXYLABS_USERNAME;
    this.password = process.env.OXYLABS_PASSWORD;
    
    if (!this.username || !this.password) {
      throw new Error('OXYLABS_USERNAME y OXYLABS_PASSWORD no configurados');
    }
  }

  async scrape(url, domainConfig) {
    const { providerConfig, selectors } = domainConfig;

    console.log(`[Oxylabs] Scraping ${url} con config:`, providerConfig);

    // Construir payload de Oxylabs
    const payload = {
      source: providerConfig.source || 'universal',
      url: url,
      render: providerConfig.render || 'html',
      geo_location: providerConfig.geo_location || 'US',
      user_agent_type: providerConfig.user_agent_type || 'desktop',
      parse: providerConfig.parse || false
    };

    // Context adicional
    if (providerConfig.context) {
      payload.context = providerConfig.context;
    }

    // Hacer request a Oxylabs
    const response = await this.makeRequest(
      'https://realtime.oxylabs.io/v1/queries',
      {
        method: 'POST',
        auth: {
          username: this.username,
          password: this.password
        },
        data: payload,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Verificar respuesta
    if (!response.results || response.results.length === 0) {
      throw new Error('Oxylabs no retornó resultados');
    }

    const result = response.results[0];
    
    // Si parse está habilitado, Oxylabs retorna datos estructurados
    if (providerConfig.parse && result.content) {
      return this.formatResponse({
        title: result.content.title,
        price: result.content.price,
        originalPrice: result.content.price_old,
        currency: result.content.currency,
        availability: result.content.availability,
        image: result.content.images?.[0],
        url
      });
    }

    // Si no, parsear HTML manualmente
    const html = result.content;
    
    // Si no hay selectores definidos, retornar HTML crudo (para estrategias de dominio)
    if (!selectors || Object.keys(selectors).length === 0) {
      console.log(`[Oxylabs] Retornando HTML crudo (${html.length} caracteres)`);
      return html;
    }
    
    return this.parseHtml(html, selectors, url);
  }

  parseHtml(html, selectors, url) {
    const $ = cheerio.load(html);
    const data = { url };

    // Similar a ScraperAPIStrategy
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
      data.image = $(selectors.imageSelector).first().attr('src');
    }

    if (!data.price && !data.title) {
      throw new Error('No se pudo extraer información del producto');
    }

    return this.formatResponse(data);
  }
}

module.exports = OxylabsStrategy;