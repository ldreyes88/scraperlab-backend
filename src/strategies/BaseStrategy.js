const axios = require('axios');

class BaseStrategy {
  constructor(providerName) {
    this.providerName = providerName;
  }

  /**
   * Método principal que deben implementar todas las estrategias
   */
  async scrape(url, domainConfig) {
    throw new Error('El método scrape() debe ser implementado por la estrategia');
  }

  /**
   * Helper para hacer requests HTTP
   */
  async makeRequest(url, config = {}) {
    try {
      const response = await axios({
        url,
        method: config.method || 'GET',
        headers: config.headers || {},
        params: config.params || {},
        data: config.data || null,
        timeout: config.timeout || parseInt(process.env.HTTP_TIMEOUT) || 150000,
        auth: config.auth || null
      });

      return response.data;
    } catch (error) {
      const status = error.response?.status || 'N/A';
      const message = error.response?.data?.message || error.message;
      
      console.error(`[${this.providerName}] Error en request [Status ${status}]: ${message}`);
      
      const err = new Error(`${this.providerName} error: ${message}`);
      err.statusCode = status !== 'N/A' ? status : 500;
      throw err;
    }
  }

  /**
   * Limpiar precio (remover caracteres no numéricos)
   */
  cleanPrice(val) {
    if (!val) return 0;
    const cleaned = val.toString().replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  }

  /**
   * Formatear respuesta estándar
   */
  formatResponse(data) {
    return {
      title: data.title || '',
      price: this.cleanPrice(data.price),
      originalPrice: this.cleanPrice(data.originalPrice || data.price),
      currency: data.currency || 'COP',
      availability: data.availability || null,
      image: data.image || null,
      description: data.description || null,
      ...data.extra
    };
  }
}

module.exports = BaseStrategy;