// src/repositories/NodeRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { GetCommand, PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { nowColombiaISO } = require('../utils/time');

// Caché en memoria para evitar Scan continuo a DynamoDB
let cachedNodes = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos

const invalidateCache = () => {
  cachedNodes = null;
  cacheExpiry = 0;
};

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
      // Si la caché está activa y contiene el nodo, resolver inmediatamente
      if (cachedNodes && Date.now() < cacheExpiry) {
        const found = cachedNodes.find(n => n.nodeId === nodeId);
        if (found) return found;
      }

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
      const now = Date.now();
      let items;

      if (cachedNodes && now < cacheExpiry) {
        items = cachedNodes;
      } else {
        const result = await dynamoDB.send(
          new ScanCommand({
            TableName: TABLES.NODES
          })
        );
        items = result.Items || [];
        cachedNodes = items;
        cacheExpiry = now + CACHE_TTL_MS;
      }

      let filteredItems = [...items];

      // Aplicar filtros en memoria (para tablas con cardinalidad baja/media)
      if (filters.clientId) {
        filteredItems = filteredItems.filter(n => n.clientId === filters.clientId || n.clientId === 'global' || !n.clientId);
      }
      if (filters.category) {
        filteredItems = filteredItems.filter(n => n.category === filters.category);
      }
      if (filters.type) {
        filteredItems = filteredItems.filter(n => n.type === filters.type);
      }

      return filteredItems;
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

      invalidateCache();
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

      invalidateCache();
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
      invalidateCache();
      return true;
    } catch (error) {
      console.error(`Error al eliminar nodo ${nodeId}:`, error);
      throw error;
    }
  }
}

module.exports = NodeRepository;
