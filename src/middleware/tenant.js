// src/middleware/tenant.js
const ClientRepository = require('../repositories/ClientRepository');
const UserRepository = require('../repositories/UserRepository');

const userRepo = new UserRepository();

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
    let clientIds = [];

    // 1. Camino óptimo: Si el usuario ya viene de autenticación con clientIds
    if (Array.isArray(user.clientIds)) {
      clientIds = user.clientIds;
    } else if (user.userId) {
      // 2. Consulta puntual O(1) por Primary Key en ScraperLab-Users
      const dbUser = await userRepo.getUserById(user.userId);
      if (dbUser && Array.isArray(dbUser.clientIds)) {
        clientIds = dbUser.clientIds;
      }
    } else if (user.email) {
      // 3. Consulta por GSI O(1) EmailIndex en ScraperLab-Users
      const dbUser = await userRepo.getUserByEmail(user.email);
      if (dbUser && Array.isArray(dbUser.clientIds)) {
        clientIds = dbUser.clientIds;
      }
    }

    // Fallback de contingencia sólo si no se encontraron clientIds en el usuario
    if (clientIds.length === 0 && user.email) {
      const userClients = await ClientRepository.getClientsByUser(user.email);
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
