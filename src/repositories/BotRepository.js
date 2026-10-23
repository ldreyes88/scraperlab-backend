// src/repositories/BotRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

class BotRepository {
  /**
   * Obtener bot por botId
   */
  static async getById(botId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.BOTS,
          Key: { botId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error(`Error obteniendo bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener todos los bots de un cliente (usando GSI o Scan fallback)
   */
  static async getByClientId(clientId) {
    try {
      try {
        const result = await dynamoDB.send(
          new QueryCommand({
            TableName: TABLES.BOTS,
            IndexName: 'clientId-index',
            KeyConditionExpression: 'clientId = :clientId',
            ExpressionAttributeValues: {
              ':clientId': clientId
            }
          })
        );
        return result.Items || [];
      } catch (gsiError) {
        // Fallback por Scan si el índice GSI está en proceso de creación
        const scanResult = await dynamoDB.send(
          new ScanCommand({
            TableName: TABLES.BOTS,
            FilterExpression: 'clientId = :clientId',
            ExpressionAttributeValues: {
              ':clientId': clientId
            }
          })
        );
        return scanResult.Items || [];
      }
    } catch (error) {
      console.error(`Error obteniendo bots para cliente ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener todos los bots
   */
  static async getAll() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.BOTS
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error listando todos los bots:', error);
      throw error;
    }
  }

  /**
   * Crear un nuevo bot
   */
  static async create(botData) {
    try {
      const now = nowColombiaISO();
      const item = {
        enabled: true,
        status: 'draft', // draft | training | active | paused
        channels: {
          web: { enabled: true, allowedDomains: ['*'] },
          whatsapp: { enabled: false, phoneNumber: '' }
        },
        stats: {
          totalConversations: 0,
          totalMessages: 0,
          totalLeads: 0
        },
        ...botData,
        createdAt: now,
        updatedAt: now
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.BOTS,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creando bot:', error);
      throw error;
    }
  }

  /**
   * Actualizar bot
   */
  static async update(botId, updateData) {
    try {
      const existing = await this.getById(botId);
      if (!existing) {
        throw new Error(`Bot ${botId} no encontrado`);
      }

      const updated = {
        ...existing,
        ...updateData,
        botId, // Inmutable
        updatedAt: nowColombiaISO()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.BOTS,
          Item: updated
        })
      );

      return updated;
    } catch (error) {
      console.error(`Error actualizando bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar bot
   */
  static async delete(botId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.BOTS,
          Key: { botId }
        })
      );
      return true;
    } catch (error) {
      console.error(`Error eliminando bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Incrementar métricas de forma atómica
   */
  static async incrementMetric(botId, metricField) {
    try {
      const fieldPath = `stats.${metricField}`;
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.BOTS,
          Key: { botId },
          UpdateExpression: `SET ${fieldPath} = if_not_exists(${fieldPath}, :zero) + :inc, updatedAt = :now`,
          ExpressionAttributeValues: {
            ':zero': 0,
            ':inc': 1,
            ':now': nowColombiaISO()
          }
        })
      );
    } catch (error) {
      console.warn(`No se pudo actualizar métrica ${metricField} para bot ${botId}:`, error.message);
    }
  }
}

module.exports = BotRepository;
