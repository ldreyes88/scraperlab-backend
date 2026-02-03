const ScraperAPIStrategy = require('./ScraperAPIStrategy');
const OxylabsStrategy = require('./OxylabsStrategy');

// Domain strategies (legacy - mantener para retrocompatibilidad temporal)
const MercadoLibreStrategy = require('./domain/MercadoLibreStrategy');
const ExitoStrategy = require('./domain/ExitoStrategy');
const FalabellaStrategy = require('./domain/FalabellaStrategy');

// Domain strategies by type (new architecture)
const MercadoLibreDetailStrategy = require('./domain/mercadolibre.com.co/MercadoLibreDetailStrategy');
const ExitoDetailStrategy = require('./domain/exito.com/ExitoDetailStrategy');
const FalabellaDetailStrategy = require('./domain/falabella.com.co/FalabellaDetailStrategy');
const PequenoMundoDetailStrategy = require('./domain/pequenomundo.com/PequenoMundoDetailStrategy');
const PequenoMundoSearchStrategy = require('./domain/pequenomundo.com/PequenoMundoSearchStrategy');
const PequenoMundoSearchSpecificStrategy = require('./domain/pequenomundo.com/PequenoMundoSearchSpecificStrategy');
const AutoMercadoSearchSpecificStrategy = require('./domain/automercado.cr/AutoMercadoSearchSpecificStrategy');

class StrategyFactory {
  static providerStrategies = {
    'scraperapi': ScraperAPIStrategy,
    'oxylabs': OxylabsStrategy
  };

  static domainStrategies = {
    // Mantener formato legacy para retrocompatibilidad
    'mercadolibre.com.co': MercadoLibreStrategy,
    'mercadolibre.com': MercadoLibreStrategy,
    'exito.com': ExitoStrategy,
    'falabella.com.co': FalabellaStrategy,
  };

  // Nuevo mapeo por dominio y tipo
  static domainStrategiesByType = {
    'mercadolibre.com.co': {
      detail: MercadoLibreDetailStrategy,
      default: MercadoLibreDetailStrategy // Alias para retrocompatibilidad
    },
    'mercadolibre.com': {
      detail: MercadoLibreDetailStrategy,
      default: MercadoLibreDetailStrategy
    },
    'exito.com': {
      detail: ExitoDetailStrategy,
      default: ExitoDetailStrategy
    },
    'falabella.com.co': {
      detail: FalabellaDetailStrategy,
      default: FalabellaDetailStrategy
    },
    'pequenomundo.com': {
      detail: PequenoMundoDetailStrategy,
      search: PequenoMundoSearchStrategy,
      searchSpecific: PequenoMundoSearchSpecificStrategy,
      default: PequenoMundoDetailStrategy
    },
    'tienda.pequenomundo.com': {
      detail: PequenoMundoDetailStrategy,
      search: PequenoMundoSearchStrategy,
      searchSpecific: PequenoMundoSearchSpecificStrategy,
      default: PequenoMundoDetailStrategy
    },
    'automercado.cr': {
      searchSpecific: AutoMercadoSearchSpecificStrategy,
      default: AutoMercadoSearchSpecificStrategy
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
    
    // Verificar si el dominio está soportado
    const domainTypes = this.domainStrategiesByType[normalizedDomain];
    
    if (!domainTypes) {
      // Fallback a formato legacy para retrocompatibilidad
      const LegacyStrategyClass = this.domainStrategies[normalizedDomain];
      if (LegacyStrategyClass) {
        const providerStrategy = this.getStrategy(providerId);
        return new LegacyStrategyClass(providerStrategy);
      }
      throw new Error(`Dominio no soportado: ${domain}`);
    }
    
    // Buscar la estrategia específica para el tipo solicitado
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
    return Object.keys(this.domainStrategies);
  }
}

module.exports = StrategyFactory;