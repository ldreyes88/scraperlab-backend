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
    
    if (!config) {
      console.log(`No existe config para ${domain}, usando default`);
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
      //console.log('🔍 [DEBUG] Usando providerConfig de BD sin aplicar defaults');
    }

    // Resolver configuración basada en el tipo de scraping (detail, search, searchSpecific)
    const resolvedProviderConfig = this.resolveProviderConfig(
        providerConfig, 
        scrapeType
    );

    return {
      ...config,
      providerConfig: resolvedProviderConfig
    };
  }

  /**
   * Resuelve la configuración final mezclando la raíz (global) con los overrides por tipo
   * @param {object} config - providerConfig completo
   * @param {string} scrapeType - Tipo de scraping (detail, search, searchSpecific)
   */
  static resolveProviderConfig(config, scrapeType = 'detail') {
    if (!config) config = {};

    // 1. Extraer configuración base (raíz)
    const specialKeys = ['detail', 'search', 'searchSpecific'];
    const baseConfig = {};
    
    Object.keys(config).forEach(key => {
      if (!specialKeys.includes(key)) {
        baseConfig[key] = config[key];
      }
    });

    // 2. Mezclar con el override del tipo solicitado si existe
    const override = config[scrapeType] || {};
    
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
      selectors: {},
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
    const { providerId, providerConfig, selectors, supportedTypes, customRateLimit, enabled, countryCode } = configData;

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
      selectors: selectors || {},
      // Nuevas opciones de extracción modular
      useJsonLd: configData.useJsonLd !== undefined ? configData.useJsonLd : true,
      useMeta: configData.useMeta !== undefined ? configData.useMeta : true,
      useNextData: configData.useNextData || false,
      useScripts: configData.useScripts || false,
      scriptPatterns: configData.scriptPatterns || [],
      useCss: configData.useCss !== undefined ? configData.useCss : true,
      
      supportedTypes: supportedTypes || ['detail'], // Default a 'detail' si no se especifica
      strategyOrder: configData.strategyOrder || ['jsonLd', 'nextData', 'scripts', 'meta', 'css'],
      customRateLimit: customRateLimit || null,
      countryCode: countryCode || configData.country || 'CO',
      enabled: enabled !== undefined ? enabled : true
    };

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