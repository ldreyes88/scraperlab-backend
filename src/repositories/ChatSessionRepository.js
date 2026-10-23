// src/repositories/ChatSessionRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

class ChatSessionRepository {
  /**
   * Obtener sesión por ID
   */
  static async getById(sessionId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Key: { sessionId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error(`Error obteniendo sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Crear nueva sesión de chat
   */
  static async create(sessionData) {
    try {
      const now = nowColombiaISO();
      const item = {
        sessionId: sessionData.sessionId,
        botId: sessionData.botId,
        clientId: sessionData.clientId || 'default',
        channel: sessionData.channel || 'web',
        messages: sessionData.messages || [],
        leadData: sessionData.leadData || null,
        metadata: sessionData.metadata || {},
        createdAt: now,
        updatedAt: now
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creando sesión de chat:', error);
      throw error;
    }
  }

  /**
   * Añadir mensaje a una sesión
   */
  static async addMessage(sessionId, message) {
    try {
      const now = nowColombiaISO();
      const formattedMessage = {
        role: message.role, // 'user' | 'assistant' | 'system'
        content: message.content,
        timestamp: message.timestamp || now,
        action: message.action || null,
        metadata: message.metadata || null
      };

      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Key: { sessionId },
          UpdateExpression: 'SET messages = list_append(if_not_exists(messages, :emptyList), :newMsg), updatedAt = :now',
          ExpressionAttributeValues: {
            ':emptyList': [],
            ':newMsg': [formattedMessage],
            ':now': now
          }
        })
      );

      return formattedMessage;
    } catch (error) {
      console.error(`Error agregando mensaje a sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Guardar o actualizar datos de lead capturados en la sesión
   */
  static async updateLead(sessionId, leadData) {
    try {
      const now = nowColombiaISO();
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Key: { sessionId },
          UpdateExpression: 'SET leadData = :lead, updatedAt = :now',
          ExpressionAttributeValues: {
            ':lead': {
              ...leadData,
              capturedAt: now
            },
            ':now': now
          }
        })
      );

      return leadData;
    } catch (error) {
      console.error(`Error actualizando lead en sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener todas las sesiones con filtros opcionales (botId, hasLead)
   */
  static async getAllSessions({ botId = null, hasLead = false, limit = 100 } = {}) {
    try {
      if (botId && !hasLead) {
        return await this.getByBotId(botId, limit);
      }

      const scanResult = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Limit: limit
        })
      );

      let items = scanResult.Items || [];

      if (botId) {
        items = items.filter(s => s.botId === botId);
      }

      if (hasLead) {
        items = items.filter(s => s.leadData && Object.keys(s.leadData).some(k => !!s.leadData[k]));
      }

      // Ordenar por fecha de actualización descendente
      items.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

      return items;
    } catch (error) {
      console.error('Error obteniendo todas las sesiones:', error);
      throw error;
    }
  }

  /**
   * Obtener sesiones de un bot
   */
  static async getByBotId(botId, limit = 50) {
    try {
      try {
        const result = await dynamoDB.send(
          new QueryCommand({
            TableName: TABLES.CHAT_SESSIONS,
            IndexName: 'botId-index',
            KeyConditionExpression: 'botId = :botId',
            ExpressionAttributeValues: {
              ':botId': botId
            },
            ScanIndexForward: false, // Más recientes primero
            Limit: limit
          })
        );
        return result.Items || [];
      } catch (gsiError) {
        const scanResult = await dynamoDB.send(
          new ScanCommand({
            TableName: TABLES.CHAT_SESSIONS,
            FilterExpression: 'botId = :botId',
            ExpressionAttributeValues: {
              ':botId': botId
            },
            Limit: limit
          })
        );
        return scanResult.Items || [];
      }
    } catch (error) {
      console.error(`Error listando sesiones para bot ${botId}:`, error);
      throw error;
    }
  }
}

module.exports = ChatSessionRepository;
