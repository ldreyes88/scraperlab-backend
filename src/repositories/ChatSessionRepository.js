// src/repositories/ChatSessionRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO, toColombiaDateKey } = require('../utils/time');

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
   * Añadir mensaje a una sesión (con control de ventana de retención para evitar superar 400KB)
   */
  static async addMessage(sessionId, message, maxRetention = 100) {
    try {
      const now = nowColombiaISO();
      const formattedMessage = {
        role: message.role, // 'user' | 'assistant' | 'system'
        content: message.content,
        timestamp: message.timestamp || now,
        action: message.action || null,
        metadata: message.metadata || null
      };

      // Si se especifica un límite de retención y la sesión supera el umbral,
      // recortamos los mensajes más antiguos manteniendo los últimos maxRetention.
      if (maxRetention && maxRetention > 0) {
        const current = await this.getById(sessionId);
        if (current && Array.isArray(current.messages) && current.messages.length >= maxRetention) {
          const trimmedMessages = [...current.messages.slice(-(maxRetention - 1)), formattedMessage];
          await dynamoDB.send(
            new UpdateCommand({
              TableName: TABLES.CHAT_SESSIONS,
              Key: { sessionId },
              UpdateExpression: 'SET messages = :messages, updatedAt = :now',
              ExpressionAttributeValues: {
                ':messages': trimmedMessages,
                ':now': now
              }
            })
          );
          return formattedMessage;
        }
      }

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
      // Obtenemos los datos actuales de la sesión para no sobreescribir campos existentes (ej: phone o nombre)
      const current = await this.getById(sessionId);
      const mergedLead = {
        ...(current?.leadData || {}),
        ...leadData,
        capturedAt: now
      };

      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Key: { sessionId },
          UpdateExpression: 'SET leadData = :lead, updatedAt = :now',
          ExpressionAttributeValues: {
            ':lead': mergedLead,
            ':now': now
          }
        })
      );

      return mergedLead;
    } catch (error) {
      console.error(`Error actualizando lead en sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Actualizar estado de control humano de la sesión (takeover)
   */
  static async updateTakeover(sessionId, { humanTakeover = true, agentName = 'Asesor Humano' }) {
    try {
      const now = nowColombiaISO();
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.CHAT_SESSIONS,
          Key: { sessionId },
          UpdateExpression: 'SET humanTakeover = :ht, takeoverBy = :agent, updatedAt = :now',
          ExpressionAttributeValues: {
            ':ht': Boolean(humanTakeover),
            ':agent': humanTakeover ? agentName : null,
            ':now': now
          }
        })
      );

      return { sessionId, humanTakeover, takeoverBy: humanTakeover ? agentName : null };
    } catch (error) {
      console.error(`Error actualizando takeover en sesión ${sessionId}:`, error);
      throw error;
    }
  }
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
   * Obtener sesiones paginadas con filtros de fecha, búsqueda y tipo
   * Utiliza GSI clientId-updatedAt-index cuando se consulta por un clientId específico
   */
  static async getPaginated(page = 1, pageSize = 20, filters = {}) {
    try {
      let allItems = [];

      // 1. Intentar optimización por GSI si viene un único clientId y sin búsqueda global compleja
      const hasSingleClient = filters.clientIds && filters.clientIds.length === 1 && !filters.enterpriseBotIds?.length;
      let usedGsi = false;

      if (hasSingleClient) {
        const targetClientId = filters.clientIds[0];
        try {
          const queryParams = {
            TableName: TABLES.CHAT_SESSIONS,
            IndexName: 'clientId-updatedAt-index',
            KeyConditionExpression: 'clientId = :c',
            ExpressionAttributeValues: {
              ':c': targetClientId
            },
            ScanIndexForward: false // Más recientes primero
          };

          const queryResult = await dynamoDB.send(new QueryCommand(queryParams));
          allItems = queryResult.Items || [];
          usedGsi = true;
        } catch (gsiErr) {
          // Si el índice aún está en backfilling o falla, fallback silencioso a Scan
          usedGsi = false;
        }
      }

      // 2. Si no se pudo usar GSI (multi-cliente, admin global o GSI en creación), usar ScanCommand
      if (!usedGsi) {
        const params = {
          TableName: TABLES.CHAT_SESSIONS
        };

        let lastEvaluatedKey = null;
        let scanIterations = 0;

        do {
          if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
          }

          const result = await dynamoDB.send(new ScanCommand(params));
          const items = result.Items || [];

          allItems = allItems.concat(items);
          lastEvaluatedKey = result.LastEvaluatedKey;
          scanIterations++;

          if (!lastEvaluatedKey || scanIterations >= 10) {
            break;
          }
        } while (true);
      }

      let filteredItems = [...allItems];

      // Filtro multi-tenant / clientIds (si no se usó GSI)
      if (!usedGsi && filters.clientIds && filters.clientIds.length > 0) {
        filteredItems = filteredItems.filter(
          item => filters.clientIds.includes(item.clientId) || (filters.enterpriseBotIds && filters.enterpriseBotIds.includes(item.botId))
        );
      }

      // Filtro por botId
      if (filters.botId) {
        filteredItems = filteredItems.filter(item => item.botId === filters.botId);
      }

      // Filtro por hasLead
      if (filters.hasLead) {
        filteredItems = filteredItems.filter(
          item => item.leadData && Object.keys(item.leadData).some(k => !!item.leadData[k])
        );
      }

      // Filtro por fecha (en base a updatedAt o createdAt) usando zona horaria Colombia
      if (filters.from || filters.to) {
        filteredItems = filteredItems.filter(item => {
          const itemTime = item.updatedAt || item.createdAt;
          if (!itemTime) return false;

          const itemDate = toColombiaDateKey(itemTime);
          if (!itemDate) return false;

          if (filters.from && filters.to) {
            return itemDate >= filters.from && itemDate <= filters.to;
          } else if (filters.from) {
            return itemDate >= filters.from;
          } else if (filters.to) {
            return itemDate <= filters.to;
          }
          return true;
        });
      }

      // Filtro de búsqueda textual
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredItems = filteredItems.filter(item => {
          const botId = (item.botId || '').toLowerCase();
          const name = (item.leadData?.name || item.metadata?.name || item.metadata?.username || '').toLowerCase();
          const email = (item.leadData?.email || '').toLowerCase();
          const phone = (item.leadData?.phone || item.metadata?.phone || '').toLowerCase();
          const site = (item.leadData?.targetUrl || '').toLowerCase();
          const sessionId = (item.sessionId || '').toLowerCase();

          return (
            botId.includes(searchLower) ||
            name.includes(searchLower) ||
            email.includes(searchLower) ||
            phone.includes(searchLower) ||
            site.includes(searchLower) ||
            sessionId.includes(searchLower)
          );
        });
      }

      // Ordenar por timestamp descendente (más reciente primero)
      filteredItems.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

      // Paginación
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const items = filteredItems.slice(startIndex, endIndex);
      const hasNextPage = filteredItems.length > endIndex;

      return {
        items,
        pagination: {
          currentPage: page,
          pageSize,
          totalItems: filteredItems.length,
          hasNextPage,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error obteniendo sesiones paginadas:', error);
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
