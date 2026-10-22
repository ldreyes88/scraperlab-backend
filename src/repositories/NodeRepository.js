// src/repositories/NodeRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

/**
 * Repositorio para la gestión de Nodos Independientes y Reutilizables en DynamoDB
 */
class NodeRepository {
  /**
   * Obtener un nodo por su identificador único
   * @param {string} nodeId
   * @returns {Promise<Object|null>}
   */
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
      console.error(`Error al obtener nodo ${nodeId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener todos los nodos del catálogo con filtros opcionales
   * @param {Object} [filters]
   * @param {string} [filters.clientId] - Filtrar por cliente o 'global'
   * @param {string} [filters.category] - Filtrar por categoría (scraping, ai, condition, api, etc.)
   * @param {string} [filters.type] - Filtrar por tipo (SCRAPE_SEARCH, AI_PROMPT, CONDITION, etc.)
   * @returns {Promise<Array>}
   */
  static async getAll(filters = {}) {
    try {
      const result = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.NODES
        })
      );

      let items = result.Items || [];

      // Aplicar filtros en memoria (para tablas con cardinalidad baja/media)
      if (filters.clientId) {
        items = items.filter(n => n.clientId === filters.clientId || n.clientId === 'global' || !n.clientId);
      }
      if (filters.category) {
        items = items.filter(n => n.category === filters.category);
      }
      if (filters.type) {
        items = items.filter(n => n.type === filters.type);
      }

      return items;
    } catch (error) {
      console.error('Error al listar nodos del catálogo:', error);
      throw error;
    }
  }

  /**
   * Crear un nuevo nodo en el catálogo
   * @param {Object} nodeData
   * @returns {Promise<Object>}
   */
  static async create(nodeData) {
    try {
      if (!nodeData.nodeId) {
        throw new Error('El campo nodeId es obligatorio');
      }

      const item = {
        nodeId: nodeData.nodeId,
        name: nodeData.name || nodeData.nodeId,
        description: nodeData.description || '',
        type: nodeData.type,
        category: nodeData.category || 'general',
        clientId: nodeData.clientId || 'global',
        defaultConfig: nodeData.defaultConfig || nodeData.config || {},
        enabled: nodeData.enabled !== undefined ? nodeData.enabled : true,
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
      console.error('Error al crear nodo:', error);
      throw error;
    }
  }

  /**
   * Actualizar un nodo existente en el catálogo
   * @param {string} nodeId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  static async update(nodeId, updates) {
    try {
      const existing = await this.getById(nodeId);
      if (!existing) {
        throw new Error(`Nodo ${nodeId} no encontrado`);
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
      console.error(`Error al actualizar nodo ${nodeId}:`, error);
      throw error;
    }
  }

  /**
   * Eliminar un nodo del catálogo
   * @param {string} nodeId
   * @returns {Promise<boolean>}
   */
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
      console.error(`Error al eliminar nodo ${nodeId}:`, error);
      throw error;
    }
  }
}

module.exports = NodeRepository;
