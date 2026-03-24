const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

class NodeRepository {
  static async getById(nodeId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.NODES,
          Key: { nodeId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error('Error getting node:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.NODES
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error getting all nodes:', error);
      throw error;
    }
  }

  static async create(nodeData) {
    try {
      const item = {
        ...nodeData,
        createdAt: nowColombiaISO(),
        updatedAt: nowColombiaISO()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.NODES,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creating node:', error);
      throw error;
    }
  }

  static async update(nodeId, updates) {
    try {
      const existing = await this.getById(nodeId);
      if (!existing) {
        throw new Error(`Node ${nodeId} not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        nodeId,
        updatedAt: nowColombiaISO()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.NODES,
          Item: updated
        })
      );

      return updated;
    } catch (error) {
      console.error('Error updating node:', error);
      throw error;
    }
  }

  static async delete(nodeId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.NODES,
          Key: { nodeId }
        })
      );
      return true;
    } catch (error) {
      console.error('Error deleting node:', error);
      throw error;
    }
  }
}

module.exports = NodeRepository;
