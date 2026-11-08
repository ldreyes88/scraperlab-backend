// Estrategias de dominio
const GenericDynamicStrategy = require('./domain/GenericDynamicStrategy');

/**
 * StrategyFactory - Fábrica centralizada para estrategias de scraping.
 * Actualmente simplificada para operar 100% bajo configuración de Base de Datos.
 */
class StrategyFactory {
  /**
   * Obtiene la estrategia cruda para el proveedor (ScraperAPI, Oxylabs, ScraperLabsApi)
   * Usa carga bajo demanda (lazy-loading) para máxima velocidad de arranque e inmunidad a fallos de inicialización.
   */
  static getStrategy(providerId) {
    if (!providerId) throw new Error('Se requiere providerId para obtener la estrategia del proveedor');

    const pid = providerId.toLowerCase();
    switch (pid) {
      case 'scraperapi': {
        const ScraperAPIStrategy = require('./ScraperAPIStrategy');
        return new ScraperAPIStrategy();
      }
      case 'oxylabs': {
        const OxylabsStrategy = require('./OxylabsStrategy');
        return new OxylabsStrategy();
      }
      case 'api':
      case 'direct': {
        const DirectAPIStrategy = require('./DirectAPIStrategy');
        return new DirectAPIStrategy();
      }
      case 'scraperlabsapi':
      case 'scraperlabs':
      case 'lambda-chromium': {
        const ScraperLabsApiStrategy = require('./ScraperLabsApiStrategy');
        return new ScraperLabsApiStrategy();
      }
      default:
        throw new Error(`Proveedor no soportado: ${providerId}`);
    }
  }

  /**
   * Retorna la estrategia de dominio según la tipología (profile vs product).
   * Para perfiles de redes sociales retorna SocialProfileStrategy.
   * Para productos de e-commerce retorna GenericDynamicStrategy.
   * 
   * @param {string} domain - Dominio normalizado (ej: tiendaclaro.com.co o tiktok.com)
   * @param {string} providerId - ID del proveedor de scraping
   * @param {string} scrapeType - Tipo de scraping solicitado (detail, search, searchSpecific, profile)
   * @param {Object} domainConfig - Configuración del dominio obtenida de BD
   */
  static getDomainStrategy(domain, providerId = 'scraperapi', scrapeType = 'detail', domainConfig = {}) {
    // 1. Instanciar el proveedor de scraping
    const providerStrategy = this.getStrategy(providerId);

    // 2. Si la tipología es 'profile' o es un dominio social reconocido, delegar a SocialProfileStrategy
    const isSocialDomain = ['tiktok.com', 'instagram.com', 'x.com', 'twitter.com', 'facebook.com', 'youtube.com'].includes(domain);
    if (domainConfig?.domainType === 'profile' || scrapeType === 'profile' || isSocialDomain) {
      const SocialProfileStrategy = require('./domain/SocialProfileStrategy');
      console.log(`[StrategyFactory] Iniciando SocialProfileStrategy para tipología profile: ${domain} (Tipo: ${scrapeType})`);
      return new SocialProfileStrategy(providerStrategy);
    }

    // 3. Retornar la estrategia dinámica universal de e-commerce / productos
    console.log(`[StrategyFactory] Iniciando GenericDynamicStrategy para producto: ${domain} (Tipo: ${scrapeType})`);
    return new GenericDynamicStrategy(providerStrategy);
  }

  /**
   * Retorna lista de dominios con lógica específica hardcoded.
   * Ahora retorna vacío ya que la migración a BD ha finalizado.
   */
  static getSupportedDomains() {
    return [];
  }
}

module.exports = StrategyFactory;