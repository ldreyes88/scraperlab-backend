const { dynamoDB, TABLES } = require('../config/database');
const { PutCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { nowColombiaISO, toColombiaDateKey } = require('../utils/time');

class ProcessRepository {
  static async create(logData) {
    try {
      const processId = uuidv4();
      const item = {
        logId: processId,
        processId: processId, // Alias para mejor semántica
        processType: logData.processType || 'simple',
        userId: logData.userId || null,
        userEmail: logData.userEmail || null,
        ...logData,
        timestamp: logData.timestamp || nowColombiaISO(),
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 días
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PROCESS,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creating log:', error);
      throw error;
    }
  }

  static async createBatchProcess(processData) {
    try {
      const processId = uuidv4();
      const item = {
        logId: processId,
        processId: processId,
        processType: 'batch',
        status: processData.status || 'pending',
        totalUrls: processData.totalUrls || 0,
        successCount: 0,
        failedCount: 0,
        userId: processData.userId,
        userEmail: processData.userEmail,
        timestamp: nowColombiaISO(),
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PROCESS,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creating batch process:', error);
      throw error;
    }
  }

  static async updateBatchCounters(processId, successCount, failedCount, status = 'completed') {
    try {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROCESS,
          Key: { logId: processId },
          UpdateExpression: 'SET successCount = :successCount, failedCount = :failedCount, #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':successCount': successCount,
            ':failedCount': failedCount,
            ':status': status
          }
        })
      );

      return true;
    } catch (error) {
      console.error('Error updating batch counters:', error);
      throw error;
    }
  }

  static async updateStatus(processId, status) {
    try {
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROCESS,
          Key: { logId: processId },
          UpdateExpression: 'SET #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': status
          }
        })
      );

      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  }

  static async getByDomain(domainId, limit = 50) {
    try {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLES.PROCESS,
          IndexName: 'domainId-timestamp-index',
          KeyConditionExpression: 'domainId = :domainId',
          ExpressionAttributeValues: {
            ':domainId': domainId
          },
          ScanIndexForward: false, // Orden descendente
          Limit: limit
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error getting logs by domain:', error);
      throw error;
    }
  }

  static async getRecent(limit = 100) {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.PROCESS,
          Limit: limit
        })
      );
      
      // Ordenar por timestamp
      const items = result.Items || [];
      return items.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error('Error getting recent logs:', error);
      throw error;
    }
  }

  static async getPaginated(page = 1, pageSize = 20, filters = {}) {
    try {
      // Estrategia simplificada: Scan TODO sin filtros complejos de DynamoDB, filtrar en memoria
      // Esto es más confiable que usar FilterExpression que puede causar scans vacíos
      const params = {
        TableName: TABLES.PROCESS
      };

      // Hacer scan completo (puede hacer múltiples llamadas automáticamente)
      let allItems = [];
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

        // Continuar hasta que no haya más datos
        if (!lastEvaluatedKey) {
          break;
        }

        // Límite de seguridad: máximo 10 iteraciones
        if (scanIterations >= 10) {
          break;
        }

      } while (true);

      // FILTRAR EN MEMORIA (más confiable)
      let filteredItems = [...allItems];

      // Filtro por userId (si se solicita explícitamente)
      if (filters.userId) {
        filteredItems = filteredItems.filter(item => item.userId === filters.userId);
      }

      // Filtro por tipo de proceso
      if (filters.processType) {
        filteredItems = filteredItems.filter(item => item.processType === filters.processType);
      }

      // Filtro por fecha (en memoria) - usa zona horaria de Colombia via time.js
      if (filters.from || filters.to) {
        const beforeFilter = filteredItems.length;
        
        filteredItems = filteredItems.filter(item => {
          if (!item.timestamp) return false;
          
          const itemDate = toColombiaDateKey(item.timestamp);
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
        
        const afterFilter = filteredItems.length;
        console.log(`[ProcessRepository] Filtro de fecha (Colombia): ${beforeFilter} -> ${afterFilter} items (from: ${filters.from}, to: ${filters.to})`);
      }

      // Filtro por estado
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'success') {
          filteredItems = filteredItems.filter(item => item.success === true);
        } else if (filters.status === 'error') {
          filteredItems = filteredItems.filter(item => item.success === false);
        }
      }

      // Filtro de búsqueda
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredItems = filteredItems.filter(item => 
          item.domain?.toLowerCase().includes(searchLower) ||
          item.url?.toLowerCase().includes(searchLower) ||
          item.domainId?.toLowerCase().includes(searchLower)
        );
      }

      // Ordenar por timestamp (descendente - más reciente primero)
      filteredItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Calcular paginación
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const items = filteredItems.slice(startIndex, endIndex);
      const hasNextPage = filteredItems.length > endIndex;

      return {
        items,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalItems: filteredItems.length,
          hasNextPage,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting paginated logs:', error);
      throw error;
    }
  }

  static async getByUser(userId, limit = 50) {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.PROCESS,
          FilterExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          },
          Limit: limit
        })
      );

      // Ordenar por timestamp
      const items = result.Items || [];
      return items.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error('Error getting logs by user:', error);
      throw error;
    }
  }

  static async delete(logId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.PROCESS,
          Key: { logId }
        })
      );
      return true;
    } catch (error) {
      console.error('Error deleting log:', error);
      throw error;
    }
  }
}

module.exports = ProcessRepository;
