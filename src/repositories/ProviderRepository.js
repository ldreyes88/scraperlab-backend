const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class ProviderRepository {
  static async getById(providerId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.PROVIDERS,
          Key: { providerId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error('Error getting provider:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.PROVIDERS
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error getting all providers:', error);
      throw error;
    }
  }

  static async create(providerData) {
    try {
      const item = {
        ...providerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PROVIDERS,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creating provider:', error);
      throw error;
    }
  }

  static async update(providerId, updates) {
    try {
      const existing = await this.getById(providerId);
      if (!existing) {
        throw new Error(`Provider ${providerId} not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        providerId, // No permitir cambiar el ID
        updatedAt: new Date().toISOString()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PROVIDERS,
          Item: updated
        })
      );

      return updated;
    } catch (error) {
      console.error('Error updating provider:', error);
      throw error;
    }
  }
}

module.exports = ProviderRepository;