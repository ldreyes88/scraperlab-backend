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
   * Retorna la estrategia de dominio (ahora siempre GenericDynamicStrategy).
   * La lógica de parseo se determina en tiempo de ejecución basada en domainConfig de la BD.
   * 
   * @param {string} domain - Dominio normalizado (ej: tiendaclaro.com.co)
   * @param {string} providerId - ID del proveedor de scraping
   * @param {string} scrapeType - Tipo de scraping solicitado (detail, search, searchSpecific)
   */
  static getDomainStrategy(domain, providerId = 'scraperapi', scrapeType = 'detail') {
    // 1. Instanciar el proveedor de scraping
    const providerStrategy = this.getStrategy(providerId);

    // 2. Retornar la estrategia dinámica universal
    // Esta estrategia delegará la extracción a los selectores y flags definidos en la BD
    console.log(`[StrategyFactory] Iniciando GenericDynamicStrategy para: ${domain} (Tipo: ${scrapeType})`);
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