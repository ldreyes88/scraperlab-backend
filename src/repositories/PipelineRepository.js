const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

class PipelineRepository {
  static async getById(pipelineId) {
    try {
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.PIPELINES,
          Key: { pipelineId }
        })
      );
      return result.Item || null;
    } catch (error) {
      console.error('Error getting pipeline:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.PIPELINES
        })
      );
      return result.Items || [];
    } catch (error) {
      console.error('Error getting all pipelines:', error);
      throw error;
    }
  }

  static async create(pipelineData) {
    try {
      const item = {
        ...pipelineData,
        createdAt: nowColombiaISO(),
        updatedAt: nowColombiaISO()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PIPELINES,
          Item: item
        })
      );

      return item;
    } catch (error) {
      console.error('Error creating pipeline:', error);
      throw error;
    }
  }

  static async update(pipelineId, updates) {
    try {
      const existing = await this.getById(pipelineId);
      if (!existing) {
        throw new Error(`Pipeline ${pipelineId} not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        pipelineId,
        updatedAt: nowColombiaISO()
      };

      await dynamoDB.send(
        new PutCommand({
          TableName: TABLES.PIPELINES,
          Item: updated
        })
      );

      return updated;
    } catch (error) {
      console.error('Error updating pipeline:', error);
      throw error;
    }
  }

  static async delete(pipelineId) {
    try {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: TABLES.PIPELINES,
          Key: { pipelineId }
        })
      );
      return true;
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      throw error;
    }
  }
}

module.exports = PipelineRepository;
