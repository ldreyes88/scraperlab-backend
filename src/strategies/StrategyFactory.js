const ScraperAPIStrategy = require('./ScraperAPIStrategy');
const OxylabsStrategy = require('./OxylabsStrategy');

// Domain strategies by type
const ClaroDetailStrategy = require('./domain/claro.com.co/ClaroDetailStrategy');
const GenericDynamicStrategy = require('./domain/GenericDynamicStrategy');

class StrategyFactory {
  static providerStrategies = {
    'scraperapi': ScraperAPIStrategy,
    'oxylabs': OxylabsStrategy
  };

  static domainStrategiesByType = {
    'tienda.claro.com.co': {
      detail: ClaroDetailStrategy,
      default: ClaroDetailStrategy
    }
  };

  static getStrategy(providerId) {
    // Para providers genéricos (ScraperAPI, Oxylabs)
    const StrategyClass = this.providerStrategies[providerId.toLowerCase()];
    if (StrategyClass) {
      return new StrategyClass();
    }
    throw new Error(`Proveedor no soportado: ${providerId}`);
  }

  static getDomainStrategy(domain, providerId = 'scraperapi', scrapeType = 'detail') {
    // Normalizar dominio
    const normalizedDomain = domain.toLowerCase();
    
    // Verificar si el dominio está soportado con lógica específica
    let domainTypes = this.domainStrategiesByType[normalizedDomain];
    
    // Si no tiene lógica específica, usar la estrategia genérica dinámica
    if (!domainTypes) {
      console.log(`[StrategyFactory] Usando GenericDynamicStrategy para: ${domain}`);
      const providerStrategy = this.getStrategy(providerId);
      return new GenericDynamicStrategy(providerStrategy);
    }
    
    // Buscar la estrategia específica para el tipo solicitado (logic hardcoded)
    let StrategyClass = domainTypes[scrapeType];
    
    // Si no existe el tipo específico, verificar si podemos usar default
    if (!StrategyClass) {
      // Solo usar default si el tipo no existe explícitamente
      if (domainTypes.default) {
        // Verificar si el dominio realmente no soporta el tipo solicitado
        const supportedTypes = Object.keys(domainTypes).filter(key => key !== 'default');
        throw new Error(
          `El dominio '${domain}' no soporta el tipo de scraping '${scrapeType}'. ` +
          `Tipos soportados: ${supportedTypes.join(', ')}`
        );
      }
      
      throw new Error(
        `El dominio '${domain}' no tiene estrategias configuradas para el tipo '${scrapeType}'`
      );
    }
    
    const providerStrategy = this.getStrategy(providerId);
    return new StrategyClass(providerStrategy);
  }

  static getSupportedDomains() {
    return Object.keys(this.domainStrategiesByType);
  }
}

module.exports = StrategyFactory;