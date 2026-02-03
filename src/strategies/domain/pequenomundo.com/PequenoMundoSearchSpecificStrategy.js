// scraperlab-backend/src/strategies/domain/pequenomundo.com/PequenoMundoSearchSpecificStrategy.js

const PequenoMundoSearchStrategy = require('./PequenoMundoSearchStrategy');

class PequenoMundoSearchSpecificStrategy extends PequenoMundoSearchStrategy {
  async scrape(url, domainConfig = {}) {
    return this.getFirstResult(url);
  }

  async getFirstResult(url) {
    try {
      // Reutilizar la lógica de búsqueda para obtener todos los resultados
      const searchResponse = await this.getSearchResults(url);

      if (!searchResponse.success || !searchResponse.results || searchResponse.results.length === 0) {
        throw new Error('No se encontraron resultados en la búsqueda');
      }

      // Tomar solo el primer resultado
      const firstResult = searchResponse.results[0];

      console.log(`[PequenoMundo SearchSpecific] Primer resultado: "${firstResult.title}"`);

      // Formatear como búsqueda específica
      return this.formatSearchSpecificResponse({
        success: true,
        marketplace: 'PequenoMundo',
        currentPrice: firstResult.currentPrice,
        originalPrice: firstResult.originalPrice,
        title: firstResult.title,
        image: firstResult.image,
        productUrl: firstResult.url,
        method: 'Search-First-Result',
        url
      });

    } catch (error) {
      console.error('[PequenoMundo SearchSpecific] Error en extracción:', error.message);
      return this.formatSearchSpecificResponse({
        success: false,
        marketplace: 'PequenoMundo',
        currentPrice: 0,
        originalPrice: 0,
        title: '',
        image: '',
        productUrl: '',
        method: 'Error',
        error: error.message,
        url
      });
    }
  }
}

module.exports = PequenoMundoSearchSpecificStrategy;
