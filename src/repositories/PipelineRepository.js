const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

// Caché en memoria para evitar Scan continuo a DynamoDB
let cachedPipelines = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos

const invalidateCache = () => {
  cachedPipelines = null;
  cacheExpiry = 0;
};

class PipelineRepository {
  static async getById(pipelineId) {
    try {
      if (cachedPipelines && Date.now() < cacheExpiry) {
        const found = cachedPipelines.find(p => p.pipelineId === pipelineId);
        if (found) return found;
      }

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
      const now = Date.now();
      if (cachedPipelines && now < cacheExpiry) {
        return cachedPipelines;
      }

      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.PIPELINES
        })
      );
      const items = result.Items || [];
      cachedPipelines = items;
      cacheExpiry = now + CACHE_TTL_MS;
      return items;
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

      invalidateCache();
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

      invalidateCache();
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
      invalidateCache();
      return true;
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      throw error;
    }
  }
}

module.exports = PipelineRepository;
