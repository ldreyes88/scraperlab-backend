const ClientService = require('../services/ClientService');

/**
 * GET /api/clients
 * Obtener todos los clientes
 */
exports.getAllClients = async (req, res, next) => {
  try {
    const result = await ClientService.getAllClients();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/clients/:clientId
 * Obtener un cliente por ID
 */
exports.getClientById = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const result = await ClientService.getClientById(clientId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/clients
 * Crear un nuevo cliente
 */
exports.createClient = async (req, res, next) => {
  try {
    const clientData = req.body;
    
    const result = await ClientService.createClient(clientData);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/clients/:clientId
 * Actualizar un cliente
 */
exports.updateClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const updates = req.body;
    
    const result = await ClientService.updateClient(clientId, updates);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/clients/:clientId
 * Eliminar un cliente
 */
exports.deleteClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const result = await ClientService.deleteClient(clientId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/clients/:clientId/users
 * Agregar usuario a cliente
 */
exports.addUserToClient = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: userEmail'
      });
    }
    
    const result = await ClientService.addUserToClient(clientId, userEmail);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/clients/:clientId/users/:userEmail
 * Remover usuario de cliente
 */
exports.removeUserFromClient = async (req, res, next) => {
  try {
    const { clientId, userEmail } = req.params;
    
    const result = await ClientService.removeUserFromClient(clientId, userEmail);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/clients/user/:userEmail
 * Obtener clientes por usuario
 */
exports.getClientsByUser = async (req, res, next) => {
  try {
    const { userEmail } = req.params;
    
    const result = await ClientService.getClientsByUser(userEmail);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/clients/:clientId/toggle
 * Toggle estado activo de un cliente
 */
exports.toggleClientStatus = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { isActive } = req.body;
    
    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: isActive'
      });
    }
    
    const result = await ClientService.toggleClientStatus(clientId, isActive);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
