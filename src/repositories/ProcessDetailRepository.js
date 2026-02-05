const { dynamoDB, TABLES } = require('../config/database');
const { PutCommand, QueryCommand, BatchWriteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

class ProcessDetailRepository {
  /**
   * Crear un detalle individual
   */
  static async create(detailData) {
    try {
      const item = {
        detailId: uuidv4(),
        ...detailData,
        timestamp: detailData.timestamp || new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 días
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PROCESS_DETAIL,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creating process detail:', error);
      throw error;
    }
  }

  /**
   * Crear múltiples detalles en batch (hasta 25 items por llamada)
   */
  static async createBatch(detailsArray) {
    try {
      if (!detailsArray || detailsArray.length === 0) {
        return [];
      }

      const results = [];
      const timestamp = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);

      // DynamoDB BatchWrite solo permite 25 items por batch
      const batchSize = 25;
      for (let i = 0; i < detailsArray.length; i += batchSize) {
        const batch = detailsArray.slice(i, i + batchSize);
        
        const items = batch.map(detail => ({
          detailId: uuidv4(),
          ...detail,
          timestamp: detail.timestamp || timestamp,
          ttl: detail.ttl || ttl
        }));

        const putRequests = items.map(item => ({
          PutRequest: { Item: item }
        }));

        await dynamoDB.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLES.PROCESS_DETAIL]: putRequests
            }
          })
        );

        results.push(...items);
      }

      return results;
    } catch (error) {
      console.error('Error creating batch details:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los detalles de un proceso
   */
  static async getByProcessId(processId, limit = 100) {
    try {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLES.PROCESS_DETAIL,
          IndexName: 'processId-timestamp-index',
          KeyConditionExpression: 'processId = :processId',
          ExpressionAttributeValues: {
            ':processId': processId
          },
          ScanIndexForward: false, // Orden descendente por timestamp
          Limit: limit
        })
      );

      return result.Items || [];
    } catch (error) {
      console.error('Error getting details by processId:', error);
      throw error;
    }
  }

  /**
   * Obtener detalles con paginación
   */
  static async getPaginated(processId, lastKey = null, limit = 20) {
    try {
      const params = {
        TableName: TABLES.PROCESS_DETAIL,
        IndexName: 'processId-timestamp-index',
        KeyConditionExpression: 'processId = :processId',
        ExpressionAttributeValues: {
          ':processId': processId
        },
        ScanIndexForward: false,
        Limit: limit
      };

      if (lastKey) {
        params.ExclusiveStartKey = lastKey;
      }

      const result = await dynamoDB.send(new QueryCommand(params));

      return {
        items: result.Items || [],
        lastKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey
      };
    } catch (error) {
      console.error('Error getting paginated details:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de un detalle
   */
  static async updateStatus(detailId, success, result = {}) {
    try {
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      updateExpression.push('#success = :success');
      expressionAttributeNames['#success'] = 'success';
      expressionAttributeValues[':success'] = success;

      if (result.responseTime !== undefined) {
        updateExpression.push('responseTime = :responseTime');
        expressionAttributeValues[':responseTime'] = result.responseTime;
      }

      if (result.error) {
        updateExpression.push('#error = :error');
        expressionAttributeNames['#error'] = 'error';
        expressionAttributeValues[':error'] = result.error;
      }

      if (result.data) {
        updateExpression.push('#data = :data');
        expressionAttributeNames['#data'] = 'data';
        expressionAttributeValues[':data'] = result.data;
      }

      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.PROCESS_DETAIL,
          Key: { detailId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues
        })
      );

      return true;
    } catch (error) {
      console.error('Error updating detail status:', error);
      throw error;
    }
  }

  /**
   * Contar detalles por processId
   */
  static async countByProcessId(processId) {
    try {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLES.PROCESS_DETAIL,
          IndexName: 'processId-timestamp-index',
          KeyConditionExpression: 'processId = :processId',
          ExpressionAttributeValues: {
            ':processId': processId
          },
          Select: 'COUNT'
        })
      );

      return result.Count || 0;
    } catch (error) {
      console.error('Error counting details:', error);
      throw error;
    }
  }
}

module.exports = ProcessDetailRepository;
