const NodeRepository = require('../repositories/NodeRepository');

exports.getAllNodes = async (req, res, next) => {
  try {
    const nodes = await NodeRepository.getAll();
    res.json({
      success: true,
      data: nodes,
      total: nodes.length
    });
  } catch (error) {
    next(error);
  }
};

exports.getNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const node = await NodeRepository.getById(nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Nodo no encontrado'
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

exports.createNode = async (req, res, next) => {
  try {
    const node = await NodeRepository.create(req.body);
    res.status(201).json({
      success: true,
      data: node,
      message: `Nodo ${node.nodeId} creado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.updateNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const node = await NodeRepository.update(nodeId, req.body);
    res.json({
      success: true,
      data: node,
      message: `Nodo ${nodeId} actualizado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteNode = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    await NodeRepository.delete(nodeId);
    res.json({
      success: true,
      message: `Nodo ${nodeId} eliminado exitosamente`
    });
  } catch (error) {
    next(error);
  }
};
