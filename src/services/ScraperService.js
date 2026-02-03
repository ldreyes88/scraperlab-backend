// scraperlab-backend/src/services/ScraperService.js
const DomainConfigService = require('./DomainConfigService');
const StrategyFactory = require('../strategies/StrategyFactory');
const ProcessRepository = require('../repositories/ProcessRepository');
const { extractDomain } = require('../utils/helpers');

class ScraperService {
  static async scrapeUrl(url, saveLog = true, scrapeType = 'detail') {
    const startTime = Date.now();
    const domain = extractDomain(url);
    
    // Validar que el tipo de scraping es válido
    const validTypes = ['detail', 'search', 'searchSpecific'];
    if (!validTypes.includes(scrapeType)) {
      throw new Error(
        `Tipo de scraping inválido: '${scrapeType}'. ` +
        `Tipos válidos: ${validTypes.join(', ')}`
      );
    }
    
    try {
      // 1. Obtener configuración del dominio
      const domainConfig = await DomainConfigService.getConfigForUrl(url);
      
      // 2. Obtener estrategia específica para el dominio y tipo
      const strategy = StrategyFactory.getDomainStrategy(
        domain, 
        domainConfig.providerId,
        scrapeType
      );

      // 3. Ejecutar extracción con la estrategia del dominio
      const result = await strategy.scrape(url, domainConfig);

      const responseTime = Date.now() - startTime;

      // 4. Guardar log con información del tipo de scraping
      if (saveLog) {
        await ProcessRepository.create({
          url,
          domainId: domain,
          scraperProvider: domainConfig.providerId,
          scrapeType, // Guardar el tipo de scraping
          success: true,
          responseTime,
          data: result,
          timestamp: new Date().toISOString()
        });
      }

      return {
        success: true,
        data: result,
        metadata: {
          domain,
          provider: domainConfig.providerId,
          scrapeType,
          responseTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (saveLog) {
        await ProcessRepository.create({
          url,
          domainId: domain,
          scrapeType,
          success: false,
          responseTime,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  }
}

module.exports = ScraperService;