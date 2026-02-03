const DomainRepository = require('../repositories/DomainRepository');
const ProviderService = require('./ProviderService');
const { extractDomain } = require('../utils/helpers');

class DomainConfigService {
  /**
   * Obtener configuración para una URL
   */
  static async getConfigForUrl(url) {
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

    return {
      ...config,
      providerConfig
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
        render: true,
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
    const { providerId, providerConfig, selectors, supportedTypes, customRateLimit, enabled } = configData;

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
      supportedTypes: supportedTypes || ['detail'], // Default a 'detail' si no se especifica
      customRateLimit: customRateLimit || null,
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