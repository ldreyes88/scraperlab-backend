const ProviderRepository = require('../repositories/ProviderRepository');

class ProviderService {
  /**
   * Obtener todos los providers disponibles
   */
  static async getAllProviders() {
    return await ProviderRepository.getAll();
  }

  /**
   * Obtener un provider por ID
   */
  static async getProvider(providerId) {
    const provider = await ProviderRepository.getById(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} no encontrado`);
    }
    return provider;
  }

  /**
   * Obtener schema de configuración de un provider
   */
  static async getProviderSchema(providerId) {
    const provider = await this.getProvider(providerId);
    return provider.configSchema;
  }

  /**
   * Obtener campos formateados para UI
   */
  static async getProviderFields(providerId) {
    const schema = await this.getProviderSchema(providerId);
    
    return Object.entries(schema).map(([field, rules]) => ({
      name: field,
      type: rules.type,
      required: rules.required || false,
      default: rules.default,
      description: rules.description || '',
      options: rules.values, // Para enums
      min: rules.min,
      max: rules.max,
      pattern: rules.pattern
    }));
  }

  /**
   * Validar configuración contra el schema del provider
   */
  static async validateConfig(providerId, config) {
    const schema = await this.getProviderSchema(providerId);
    const errors = [];
    const warnings = [];

    // Validar campos requeridos
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && (config[field] === undefined || config[field] === null)) {
        errors.push(`Campo requerido: ${field}`);
      }

      if (config[field] !== undefined && config[field] !== null) {
        // Validar tipo
        const typeValid = this.validateFieldType(config[field], rules);
        if (!typeValid) {
          errors.push(`${field}: tipo inválido (esperado ${rules.type}, recibido ${typeof config[field]})`);
        }

        // Validar enum
        if (rules.type === 'enum' && !rules.values.includes(config[field])) {
          errors.push(`${field}: valor debe ser uno de [${rules.values.join(', ')}]`);
        }

        // Validar rangos numéricos
        if (rules.type === 'number' && typeValid) {
          if (rules.min !== undefined && config[field] < rules.min) {
            errors.push(`${field}: debe ser >= ${rules.min}`);
          }
          if (rules.max !== undefined && config[field] > rules.max) {
            errors.push(`${field}: debe ser <= ${rules.max}`);
          }
        }

        // Validar patterns
        if (rules.pattern && typeof config[field] === 'string') {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(config[field])) {
            errors.push(`${field}: no cumple el patrón ${rules.pattern}`);
          }
        }
      }
    }

    // Validar campos extra (que no están en el schema)
    const extraFields = Object.keys(config).filter(
      field => !schema[field]
    );
    if (extraFields.length > 0) {
      warnings.push(`Campos no soportados por ${providerId}: ${extraFields.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateFieldType(value, rules) {
    const typeValidators = {
      'boolean': v => typeof v === 'boolean',
      'string': v => typeof v === 'string',
      'number': v => typeof v === 'number' && !isNaN(v),
      'enum': v => typeof v === 'string',
      'object': v => typeof v === 'object' && v !== null && !Array.isArray(v),
      'array': v => Array.isArray(v)
    };

    return typeValidators[rules.type]?.(value) ?? true;
  }

  /**
   * Obtener configuración con defaults aplicados
   */
  static async getConfigWithDefaults(providerId, userConfig = {}) {
    
    const schema = await this.getProviderSchema(providerId);
    
    const configWithDefaults = {};

    // SOLO incluir campos que están explícitamente configurados
    // NO aplicar defaults automáticamente
    for (const [field, rules] of Object.entries(schema)) {
      if (userConfig[field] !== undefined) {
        configWithDefaults[field] = userConfig[field];
      }
      // Comentado: No aplicar defaults automáticamente
      // Los parámetros deben ser opcionales y solo enviarse si están configurados
      // else if (rules.default !== undefined) {
      //   configWithDefaults[field] = rules.default;
      // }
    }

    return configWithDefaults;
  }

  /**
   * Crear un nuevo provider
   */
  static async createProvider(providerData) {
    const { providerId, name, baseUrl, authType, configSchema } = providerData;

    if (!providerId || !name || !configSchema) {
      throw new Error('Campos requeridos: providerId, name, configSchema');
    }

    // Verificar que no existe
    const existing = await ProviderRepository.getById(providerId);
    if (existing) {
      throw new Error(`Provider ${providerId} ya existe`);
    }

    return await ProviderRepository.create({
      providerId,
      name,
      baseUrl: baseUrl || '',
      authType: authType || 'api_key',
      configSchema,
      pricing: providerData.pricing || {},
      rateLimit: providerData.rateLimit || {},
      enabled: true
    });
  }

  /**
   * Actualizar un provider existente
   */
  static async updateProvider(providerId, updates) {
    // No permitir cambiar el providerId
    delete updates.providerId;
    
    return await ProviderRepository.update(providerId, updates);
  }
}

module.exports = ProviderService;