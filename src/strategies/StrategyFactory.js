const ScraperAPIStrategy = require('./ScraperAPIStrategy');
const OxylabsStrategy = require('./OxylabsStrategy');

// Domain strategies by type
const MercadoLibreDetailStrategy = require('./domain/mercadolibre.com.co/MercadoLibreDetailStrategy');
const ExitoDetailStrategy = require('./domain/exito.com/ExitoDetailStrategy');
const FalabellaDetailStrategy = require('./domain/falabella.com.co/FalabellaDetailStrategy');
const AlkostoDetailStrategy = require('./domain/alkosto.com/AlkostoDetailStrategy');
const AlkomprarDetailStrategy = require('./domain/alkomprar.com/AlkomprarDetailStrategy');
const KtronixDetailStrategy = require('./domain/ktronix.com/KtronixDetailStrategy');
const IShopDetailStrategy = require('./domain/ishop.com.co/IShopDetailStrategy');
const ClaroDetailStrategy = require('./domain/claro.com.co/ClaroDetailStrategy');
const MacCenterDetailStrategy = require('./domain/maccenter.com.co/MacCenterDetailStrategy');
const MovistarDetailStrategy = require('./domain/movistar.com.co/MovistarDetailStrategy');
const PequenoMundoDetailStrategy = require('./domain/pequenomundo.com/PequenoMundoDetailStrategy');
const PequenoMundoSearchStrategy = require('./domain/pequenomundo.com/PequenoMundoSearchStrategy');
const PequenoMundoSearchSpecificStrategy = require('./domain/pequenomundo.com/PequenoMundoSearchSpecificStrategy');
const AutoMercadoSearchSpecificStrategy = require('./domain/automercado.cr/AutoMercadoSearchSpecificStrategy');

class StrategyFactory {
  static providerStrategies = {
    'scraperapi': ScraperAPIStrategy,
    'oxylabs': OxylabsStrategy
  };

  static domainStrategiesByType = {
    'mercadolibre.com.co': {
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
    'alkosto.com': {
      detail: AlkostoDetailStrategy,
      default: AlkostoDetailStrategy
    },
    'alkomprar.com': {
      detail: AlkomprarDetailStrategy,
      default: AlkomprarDetailStrategy
    },
    'ktronix.com': {
      detail: KtronixDetailStrategy,
      default: KtronixDetailStrategy
    },
    'ishop.com.co': {
      detail: IShopDetailStrategy,
      default: IShopDetailStrategy
    },
    'mac-center.com': {
      detail: MacCenterDetailStrategy,
      default: MacCenterDetailStrategy
    },
    'tienda.claro.com.co': {
      detail: ClaroDetailStrategy,
      default: ClaroDetailStrategy
    },
    'tienda.movistar.com.co': {
      detail: MovistarDetailStrategy,
      default: MovistarDetailStrategy
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
    return Object.keys(this.domainStrategiesByType);
  }
}

module.exports = StrategyFactory;