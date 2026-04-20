// scraperlab-backend/src/services/ScraperService.js
const DomainConfigService = require('./DomainConfigService');
const StrategyFactory = require('../strategies/StrategyFactory');
const ProcessRepository = require('../repositories/ProcessRepository');
const { extractDomain } = require('../utils/helpers');
const { nowColombiaISO } = require('../utils/time');

class ScraperService {
  static async scrapeUrl(url, saveLog = true, scrapeType = 'detail', userId = null, userEmail = null, processType = 'simple') {
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
      const domainConfig = await DomainConfigService.getConfigForUrl(url, scrapeType);
      
      // 2. Obtener estrategia específica para el dominio y tipo
      const strategy = StrategyFactory.getDomainStrategy(
        domain, 
        domainConfig.providerId,
        scrapeType
      );

      // 3. Ejecutar extracción con la estrategia del dominio
      domainConfig.scrapeType = scrapeType;
      const result = await strategy.scrape(url, domainConfig);

      const responseTime = Date.now() - startTime;

      // 3b. Determinar el estado de salud del servicio (status_service) INTELLIGENT CLEANING
      // Marcamos como fallido si la estrategia retorna success: false O si es un detail y no extrajo título
      let finalStatus = 'active';
      let scrapeError = null;

      if (!result.success) {
        finalStatus = 'failed';
        scrapeError = result.error || 'Unknown extraction error';
      } else if (scrapeType === 'detail' && (!result.details?.title || result.details?.title === '')) {
        // Si es una página de detalle y no pudimos extraer el título, es un fallo de scraping
        // aunque el provider haya respondido 200 OK.
        finalStatus = 'failed';
        scrapeError = 'Extraction failed: Title not found (Possible selector issue or blocked content)';
      }

      // Actualizar el estado del dominio en segundo plano
      DomainConfigService.updateScrapeStatus(domain, finalStatus, scrapeError).catch(err => 
        console.error(`[ScraperService] Error updating status for ${domain}:`, err)
      );

      // 4. Guardar log con información del tipo de scraping y usuario
      if (saveLog) {
        await ProcessRepository.create({
          url,
          domainId: domain,
          scraperProvider: domainConfig.providerId,
          scrapeType,
          processType,
          userId,
          userEmail,
          success: true,
          responseTime,
          data: result,
          timestamp: nowColombiaISO()
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
          timestamp: nowColombiaISO()
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Actualizar a fallido si hubo un error de red o de provider
      DomainConfigService.updateScrapeStatus(domain, 'failed', error.message).catch(err => 
        console.error(`[ScraperService] Error updating status for ${domain}:`, err)
      );

      if (saveLog) {
        await ProcessRepository.create({
          url,
          domainId: domain,
          scrapeType,
          processType,
          userId,
          userEmail,
          success: false,
          responseTime,
          error: error.message,
          timestamp: nowColombiaISO()
        });
      }

      throw error;
    }
  }
}

module.exports = ScraperService;