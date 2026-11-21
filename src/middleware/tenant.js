// src/middleware/tenant.js
const ClientRepository = require('../repositories/ClientRepository');

/**
 * Middleware para resolver el contexto multi-tenant del usuario autenticado.
 * - Si es admin: req.tenant = { isAdmin: true, clientIds: [] }
 * - Si es usuario empresarial: req.tenant = { isAdmin: false, clientIds: ['lubricantes-caribe', ...] }
 */
const resolveTenant = async (req, res, next) => {
  try {
    const user = req.user;

    // Si no hay usuario autenticado (endpoints públicos), continuar
    if (!user) {
      req.tenant = { isAdmin: false, clientIds: [], isEnterprise: false };
      return next();
    }

    // Admins tienen visibilidad y control global
    if (user.role === 'admin') {
      req.tenant = {
        isAdmin: true,
        clientIds: [],
        isEnterprise: false
      };
      return next();
    }

    // Para usuarios con rol no admin, determinar si están asignados a empresas
    const userEmail = user.email;
    let clientIds = [];

    if (userEmail) {
      const userClients = await ClientRepository.getClientsByUser(userEmail);
      clientIds = userClients.map(c => c.clientId).filter(Boolean);
    }

    req.tenant = {
      isAdmin: false,
      isEnterprise: clientIds.length > 0,
      clientIds
    };

    next();
  } catch (error) {
    console.error('Error resolviendo tenant context:', error);
    // Continuar con contexto seguro por defecto
    req.tenant = { isAdmin: false, clientIds: [], isEnterprise: false };
    next();
  }
};

module.exports = {
  resolveTenant
};
