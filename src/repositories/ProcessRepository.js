const { dynamoDB, TABLES } = require('../config/database');
const { PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

class ProcessRepository {
  static async create(logData) {
    try {
      const item = {
        logId: uuidv4(),
        ...logData,
        timestamp: logData.timestamp || new Date().toISOString(),
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
