const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

/**
 * DomainRepository - Gestiona la configuración de dominios en DynamoDB
 * 
 * Estructura del modelo Domain:
 * {
 *   domainId: string,              // PK - identificador del dominio (ej: "pequenomundo.com")
 *   providerId: string,            // ID del proveedor de scraping (ej: "scraperapi")
 *   providerConfig: object,        // Configuración específica del proveedor
 *   scraperConfig: object,          // Configuraciones de extracción (selectores CSS, etc) (opcional)
 *   supportedTypes: string[],      // Tipos de scraping soportados: ["detail", "search", "searchSpecific"]
 *   enabled: boolean,              // Si el dominio está habilitado
 *   createdAt: string,             // ISO timestamp
 *   updatedAt: string              // ISO timestamp
 * }
 */
class DomainRepository {
  static async getByDomain(domainId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.DOMAINS,
          Key: { domainId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error('Error getting config:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.DOMAINS
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error getting all configs:', error);
      throw error;
    }
  }

  static async getByProvider(providerId) {
    try {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLES.DOMAINS,
          IndexName: 'providerId-index',
          KeyConditionExpression: 'providerId = :providerId',
          ExpressionAttributeValues: {
            ':providerId': providerId
          }
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error getting configs by provider:', error);
      throw error;
    }
  }

  static async upsert(domainId, configData) {
    try {


      const existing = await this.getByDomain(domainId);
      
      // Asegurar que usamos scraperConfig (migración de selectors si configData es viejo)
      const finalScraperConfig = configData.scraperConfig || configData.selectors || existing?.scraperConfig || {};
      
      // Construir el objeto Item final con campos específicos (Whitelist)
      // Esto elimina automáticamente campos legacy como 'selectors' o 'scriptPatterns'
      const item = {
        domainId,
        providerId: configData.providerId || existing?.providerId,
        providerConfig: configData.providerConfig || existing?.providerConfig || {},
        scraperConfig: finalScraperConfig,
        
        // Flags de extracción modular
        useJsonLd: configData.useJsonLd !== undefined ? configData.useJsonLd : (existing?.useJsonLd !== undefined ? existing.useJsonLd : true),
        useMeta: configData.useMeta !== undefined ? configData.useMeta : (existing?.useMeta !== undefined ? existing.useMeta : true),
        useNextData: configData.useNextData !== undefined ? configData.useNextData : (existing?.useNextData !== undefined ? existing.useNextData : false),
        useScripts: configData.useScripts !== undefined ? configData.useScripts : (existing?.useScripts !== undefined ? existing.useScripts : true),
        useCss: configData.useCss !== undefined ? configData.useCss : (existing?.useCss !== undefined ? existing.useCss : true),
        
        strategyOrder: configData.strategyOrder || existing?.strategyOrder || ['scripts', 'jsonLd', 'css', 'meta', 'nextData'],
        supportedTypes: configData.supportedTypes || existing?.supportedTypes || ['detail'],
        subdomains: configData.subdomains || existing?.subdomains || [],
        customRateLimit: configData.customRateLimit !== undefined ? configData.customRateLimit : (existing?.customRateLimit || null),
        countryCode: configData.countryCode || configData.country || existing?.countryCode || 'CO',
        typeService: configData.typeService || existing?.typeService || ['scraping'],
        enabled: configData.enabled !== undefined ? configData.enabled : (existing?.enabled !== undefined ? existing.enabled : true),
        
        status_service: configData.status_service || existing?.status_service || 'active',
        last_scrape_error: configData.last_scrape_error || existing?.last_scrape_error || null,
        
        createdAt: existing?.createdAt || nowColombiaISO(),
        updatedAt: nowColombiaISO()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.DOMAINS,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error upserting config:', error);
      throw error;
    }
  }

  static async delete(domainId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.DOMAINS,
          Key: { domainId }
        })
      );
      return true;
    } catch (error) {
      console.error('Error deleting config:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de salud del scraping del dominio
   * @param {string} domainId 
   * @param {string} status - 'active' | 'failed'
   * @param {string} error - Mensaje de error (opcional)
   */
  static async updateScrapeStatus(domainId, status, error = null) {
    try {
      const updateParams = {
        TableName: TABLES.DOMAINS,
        Key: { domainId },
        UpdateExpression: 'SET status_service = :status, last_scrape_error = :error, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':status': status,
          ':error': error,
          ':updatedAt': nowColombiaISO()
        }
      };

      await dynamoDB.send(new UpdateCommand(updateParams));
      return true;
    } catch (err) {
      console.error(`[DomainRepository] Error updating status for ${domainId}:`, err);
      return false; // No arrojamos para no bloquear el proceso principal
    }
  }
}

module.exports = DomainRepository;
