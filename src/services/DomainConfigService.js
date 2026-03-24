const DomainRepository = require('../repositories/DomainRepository');
const ProviderService = require('./ProviderService');
const { extractDomain } = require('../utils/helpers');

class DomainConfigService {
  /**
   * Obtener configuración para una URL resuelta por tipo de scraping
   */
  static async getConfigForUrl(url, scrapeType = 'detail') {
    const domain = extractDomain(url);
    
    let config = await DomainRepository.getByDomain(domain);
    
    // Fallback de subdominios: si no existe config exacta, buscar si el dominio base lo soporta
    // Ejemplo: listado.mercadolibre.com.co -> buscar mercadolibre.com.co y verificar config.subdomains
    if (!config && domain.includes('.')) {
      const parts = domain.split('.');
      
      // Intentar encontrar el dominio base (quitando el primer segmento)
      if (parts.length > 2) {
        const subdomainPrefix = parts[0];
        const baseDomain = parts.slice(1).join('.');
        
        const baseConfig = await DomainRepository.getByDomain(baseDomain);
        
        // Solo aplicar si el subdominio está en la lista de soportados
        if (baseConfig && baseConfig.subdomains && baseConfig.subdomains.includes(subdomainPrefix)) {
          console.log(`[DomainConfig] Usando config base ${baseDomain} para subdominio soportado: ${subdomainPrefix}`);
          config = baseConfig;
        }
      }
    }
    
    if (!config) {
      console.log(`[DomainConfig] No existe config para ${domain}, usando default`);
      config = await this.getDefaultConfig(domain);
    }
    
    if (!config.enabled) {
      throw new Error(`Scraping deshabilitado para ${domain}`);
    }

    // Si hay providerConfig en BD, usarlo tal cual (sin defaults)
    // Solo aplicar defaults si providerConfig está vacío o undefined
    let providerConfig = config.providerConfig;
        
    if (!providerConfig || Object.keys(providerConfig).length === 0) {
      providerConfig = await ProviderService.getConfigWithDefaults(
        config.providerId,
        {}
      );
    } else {

    }

    // Resolver configuraciones basadas en el tipo de scraping (detail, search, searchSpecific)
    const resolvedProviderConfig = this.resolveProviderConfig(
        providerConfig, 
        scrapeType
    );

    // También resolver scraperConfig/selectors específicos del tipo
    const resolvedScraperConfig = this.resolveProviderConfig(
        config.scraperConfig || config.selectors || {}, 
        scrapeType
    );

    return {
      ...config,
      providerConfig: resolvedProviderConfig,
      selectors: resolvedScraperConfig,       // Inyectamos esto para compatibilidad con estrategias
      scraperConfig: resolvedScraperConfig    // Normalizado por tipo
    };
  }

  /**
   * Resuelve la configuración final mezclando la raíz (global) con los overrides por tipo
   * @param {object} config - providerConfig completo
   * @param {string} scrapeType - Tipo de scraping (detail, search, searchSpecific)
   */
  static resolveProviderConfig(config, scrapeType = 'detail') {
    if (!config) config = {};
    const specialKeys = ['detail', 'search', 'searchSpecific'];
    
    // 1. Obtener base (Global/Root) - Todavía permitimos campos raíz para compatibilidad
    const baseConfig = {};
    Object.keys(config).forEach(key => {
      if (!specialKeys.includes(key)) {
        baseConfig[key] = config[key];
      }
    });

    // 2. Obtener el override específico del tipo solicitado
    const override = config[scrapeType] || {};
    
    // 3. Mezclar base (root) con el override (específico)
    // Ya NO mezclamos Detail con otros tipos. Cada uno es independiente.
    return {
      ...baseConfig,
      ...override
    };
  }

  /**
   * Configuración por defecto
   */
  static async getDefaultConfig(domain) {
    return {
      domainId: domain,
      providerId: 'scraperapi',
      providerConfig: {
        render: false,
        premium: false,
        device_type: 'desktop',
        country_code: 'us'
      },
      scraperConfig: {},
      customRateLimit: null,
      enabled: true,
      isDefault: true
    };
  }

  /**
   * Obtener todas las configuraciones
   */
  static async getAllConfigs() {
    return await DomainRepository.getAll();
  }

  /**
   * Obtener configuración de un dominio específico
   */
  static async getConfig(domainId) {
    const config = await DomainRepository.getByDomain(domainId);
    if (!config) {
      throw new Error(`No existe configuración para ${domainId}`);
    }
    return config;
  }

  /**
   * Crear o actualizar configuración
   */
  static async createOrUpdateConfig(domainId, configData) {

    const { 
      providerId, 
      providerConfig, 
      scraperConfig, 
      selectors,
      supportedTypes, 
      customRateLimit, 
      enabled, 
      countryCode,
      subdomains,
      strategyOrder
    } = configData;



    // Renombrar selectors a scraperConfig si es necesario (migración transparente)
    const finalScraperConfig = scraperConfig || selectors || {};

    // Validar que el provider existe
    await ProviderService.getProvider(providerId);

    // Validar configuración contra el schema
    const validation = await ProviderService.validateConfig(
      providerId,
      providerConfig || {}
    );

    if (!validation.valid) {
      throw new Error(
        `Configuración inválida: ${validation.errors.join(', ')}`
      );
    }

    // Aplicar defaults
    const finalConfig = await ProviderService.getConfigWithDefaults(
      providerId,
      providerConfig || {}
    );

    const configToSave = {
      domainId,
      providerId,
      providerConfig: finalConfig,
      scraperConfig: finalScraperConfig,
      // Nuevas opciones de extracción modular
      useJsonLd: configData.useJsonLd !== undefined ? configData.useJsonLd : true,
      useMeta: configData.useMeta !== undefined ? configData.useMeta : true,
      useNextData: configData.useNextData || false,
      useScripts: configData.useScripts || false,
      useCss: configData.useCss !== undefined ? configData.useCss : true,
      
      supportedTypes: supportedTypes || ['detail'], 
      subdomains: subdomains || [],
      strategyOrder: strategyOrder || ['jsonLd', 'nextData', 'scripts', 'meta', 'css'],
      customRateLimit: customRateLimit || null,
      countryCode: countryCode || configData.countryCode || configData.country || 'CO',
      typeService: configData.typeService || ['scraping'],
      enabled: enabled !== undefined ? enabled : true
    };

    // Asegurar que scriptPatterns migre de la raíz a scraperConfig.detail si es necesario
    if (configData.scriptPatterns && (!configToSave.scraperConfig.detail || !configToSave.scraperConfig.detail.scripts)) {
      if (!configToSave.scraperConfig.detail) configToSave.scraperConfig.detail = {};
      configToSave.scraperConfig.detail.scripts = configData.scriptPatterns;
    }

    return await DomainRepository.upsert(domainId, configToSave);
  }

  /**
   * Cambiar el provider de un dominio
   */
  static async switchProvider(domainId, newProviderId, newConfig = {}) {
    // Validar que el nuevo provider existe
    await ProviderService.getProvider(newProviderId);

    const currentConfig = await DomainRepository.getByDomain(domainId);
    if (!currentConfig) {
      throw new Error(`No existe configuración para ${domainId}`);
    }

    // Validar nueva configuración
    const validation = await ProviderService.validateConfig(
      newProviderId,
      newConfig
    );

    if (!validation.valid) {
      throw new Error(
        `Configuración inválida para ${newProviderId}: ${validation.errors.join(', ')}`
      );
    }

    // Aplicar defaults
    const providerConfig = await ProviderService.getConfigWithDefaults(
      newProviderId,
      newConfig
    );

    // Actualizar config
    currentConfig.providerId = newProviderId;
    currentConfig.providerConfig = providerConfig;
    
    return await DomainRepository.upsert(domainId, currentConfig);
  }

  /**
   * Eliminar configuración
   */
  static async deleteConfig(domainId) {
    const config = await DomainRepository.getByDomain(domainId);
    if (!config) {
      throw new Error(`No existe configuración para ${domainId}`);
    }
    
    return await DomainRepository.delete(domainId);
  }

  /**
   * Habilitar/deshabilitar scraping para un dominio
   */
  static async toggleEnabled(domainId, enabled) {
    const config = await DomainRepository.getByDomain(domainId);
    if (!config) {
      throw new Error(`No existe configuración para ${domainId}`);
    }

    config.enabled = enabled;
    return await DomainRepository.upsert(domainId, config);
  }

  /**
   * Obtener dominios por provider
   */
  static async getDomainsByProvider(providerId) {
    return await DomainRepository.getByProvider(providerId);
  }
}

module.exports = DomainConfigService;