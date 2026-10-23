// src/repositories/BotKnowledgeRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { nowColombiaISO } = require('../utils/time');

class BotKnowledgeRepository {
  /**
   * Crear o actualizar un registro de conocimiento
   */
  static async create(knowledgeData) {
    try {
      const now = nowColombiaISO();
      const item = {
        knowledgeId: knowledgeData.knowledgeId || uuidv4(),
        ...knowledgeData,
        createdAt: knowledgeData.createdAt || now,
        updatedAt: now
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.BOT_KNOWLEDGE,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error guardando conocimiento de bot:', error);
      throw error;
    }
  }

  /**
   * Obtener todo el conocimiento asociado a un bot
   */
  static async getByBotId(botId) {
    try {
      try {
        const result = await dynamoDB.send(
          new QueryCommand({
            TableName: TABLES.BOT_KNOWLEDGE,
            IndexName: 'botId-index',
            KeyConditionExpression: 'botId = :botId',
            ExpressionAttributeValues: {
              ':botId': botId
            }
          })
        );
        return result.Items || [];
      } catch (gsiError) {
        // Fallback por Scan si el índice GSI está en proceso de creación
        const scanResult = await dynamoDB.send(
          new ScanCommand({
            TableName: TABLES.BOT_KNOWLEDGE,
            FilterExpression: 'botId = :botId',
            ExpressionAttributeValues: {
              ':botId': botId
            }
          })
        );
        return scanResult.Items || [];
      }
    } catch (error) {
      console.error(`Error obteniendo conocimiento para bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener un ítem específico por ID
   */
  static async getById(knowledgeId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.BOT_KNOWLEDGE,
          Key: { knowledgeId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error(`Error obteniendo conocimiento ${knowledgeId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar todo el conocimiento de un bot (útil antes de re-entrenar)
   */
  static async deleteByBotId(botId) {
    try {
      const items = await this.getByBotId(botId);
      for (const item of items) {
        await this.delete(item.knowledgeId);
      }
      return items.length;
    } catch (error) {
      console.error(`Error eliminando conocimiento del bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar un ítem individual
   */
  static async delete(knowledgeId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.BOT_KNOWLEDGE,
          Key: { knowledgeId }
        })
      );
      return true;
    } catch (error) {
      console.error(`Error eliminando conocimiento ${knowledgeId}:`, error);
      throw error;
    }
  }
}

module.exports = BotKnowledgeRepository;
