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
    
    const validateObject = (obj, isRoot = true) => {
      const errors = [];
      const warnings = [];

      // Validar campos requeridos y tipos basados en el schema
      for (const [field, rules] of Object.entries(schema)) {
        // Los campos requeridos solo se validan en la raíz (global)
        if (isRoot && rules.required && (obj[field] === undefined || obj[field] === null)) {
          errors.push(`Campo requerido: ${field}`);
        }

        if (obj[field] !== undefined && obj[field] !== null) {
          // Validar tipo
          const typeValid = this.validateFieldType(obj[field], rules);
          if (!typeValid) {
            errors.push(`${field}: tipo inválido (esperado ${rules.type}, recibido ${typeof obj[field]})`);
          }

          // Validar enum
          if (rules.type === 'enum' && !rules.values.includes(obj[field])) {
            errors.push(`${field}: valor debe ser uno de [${rules.values.join(', ')}]`);
          }

          // Validar rangos numéricos
          if (rules.type === 'number' && typeValid) {
            if (rules.min !== undefined && obj[field] < rules.min) {
              errors.push(`${field}: debe ser >= ${rules.min}`);
            }
            if (rules.max !== undefined && obj[field] > rules.max) {
              errors.push(`${field}: debe ser <= ${rules.max}`);
            }
          }

          // Validar patterns
          if (rules.pattern && typeof obj[field] === 'string') {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(obj[field])) {
              errors.push(`${field}: no cumple el patrón ${rules.pattern}`);
            }
          }
        }
      }

      // Validar campos extra (que no están en el schema y no son claves de override)
      const specialKeys = ['detail', 'search', 'searchSpecific'];
      const extraFields = Object.keys(obj).filter(
        field => !schema[field] && !specialKeys.includes(field)
      );
      
      if (extraFields.length > 0) {
        warnings.push(`Campos no soportados por ${providerId}: ${extraFields.join(', ')}`);
      }

      // Validar recursivamente las claves de override
      if (isRoot) {
        specialKeys.forEach(key => {
          if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            const nested = validateObject(obj[key], false);
            errors.push(...nested.errors.map(err => `${key}.${err}`));
            warnings.push(...nested.warnings.map(warn => `${key}.${warn}`));
          }
        });
      }

      return { errors, warnings };
    };

    const { errors, warnings } = validateObject(config);

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
    
    const applyFilter = (config, isRoot = true) => {
      const filtered = {};
      
      // Aplicar campos del schema
      for (const [field, rules] of Object.entries(schema)) {
        if (config[field] !== undefined) {
          filtered[field] = config[field];
        }
      }

      // Procesar recursivamente claves de override si existen en este nivel (solo raíz debería tenerlas)
      const specialKeys = ['detail', 'search', 'searchSpecific'];
      specialKeys.forEach(key => {
        if (config[key] && typeof config[key] === 'object' && !Array.isArray(config[key])) {
          const nested = applyFilter(config[key], false); // No aplicar defaults en overrides
          if (Object.keys(nested).length > 0) {
            filtered[key] = nested;
          }
        }
      });

      return filtered;
    };

    return applyFilter(userConfig, true);
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