// src/handlers/nodes.js
const NodeRepository = require('../repositories/NodeRepository');

/**
 * Obtener todos los nodos del catálogo con soporte de filtros (clientId, category, type)
 */
exports.getAllNodes = async (req, res, next) => {
  try {
    const { clientId, category, type } = req.query;
    const nodes = await NodeRepository.getAll({ clientId, category, type });

    res.json({
      success: true,
      data: nodes,
      total: nodes.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un nodo específico por su ID
 */
exports.getNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const node = await NodeRepository.getById(nodeId);

    if (!node) {
      return res.status(404).json({
        success: false,
        message: `Nodo '${nodeId}' no encontrado en el catálogo`
      });
    }

    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo nodo independiente en el catálogo
 */
exports.createNode = async (req, res, next) => {
  try {
    const { nodeId, name, type, defaultConfig, config, category, clientId, description } = req.body;

    if (!nodeId || typeof nodeId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'El campo nodeId es obligatorio y debe ser un string válido'
      });
    }

    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'El campo type es obligatorio (ej: SCRAPE_SEARCH, AI_PROMPT, API_REQUEST, CONDITION)'
      });
    }

    // Verificar si ya existe
    const existing = await NodeRepository.getById(nodeId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Ya existe un nodo registrado con el ID '${nodeId}'`
      });
    }

    const node = await NodeRepository.create({
      nodeId,
      name: name || nodeId,
      type,
      description: description || '',
      category: category || 'general',
      clientId: clientId || 'global',
      defaultConfig: defaultConfig || config || {}
    });

    res.status(201).json({
      success: true,
      data: node,
      message: `Nodo '${node.nodeId}' creado exitosamente en el catálogo`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un nodo existente en el catálogo
 */
exports.updateNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const updated = await NodeRepository.update(nodeId, req.body);

    res.json({
      success: true,
      data: updated,
      message: `Nodo '${nodeId}' actualizado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un nodo del catálogo
 */
exports.deleteNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    await NodeRepository.delete(nodeId);

    res.json({
      success: true,
      message: `Nodo '${nodeId}' eliminado exitosamente del catálogo`
    });
  } catch (error) {
    next(error);
  }
};
