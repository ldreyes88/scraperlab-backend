const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

/**
 * DomainRepository - Gestiona la configuración de dominios en DynamoDB
 * 
 * Estructura del modelo Domain:
 * {
 *   domainId: string,              // PK - identificador del dominio (ej: "pequenomundo.com")
 *   providerId: string,            // ID del proveedor de scraping (ej: "scraperapi")
 *   providerConfig: object,        // Configuración específica del proveedor
 *   selectors: object,             // Selectores CSS personalizados (opcional)
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
      
      const item = {
        ...configData,
        domainId,
        // Si no se especifica supportedTypes, usar ['detail'] por defecto (retrocompatibilidad)
        supportedTypes: configData.supportedTypes || existing?.supportedTypes || ['detail'],
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
}

module.exports = DomainRepository;
