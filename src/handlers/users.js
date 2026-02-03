const UserService = require('../services/UserService');
const CognitoService = require('../services/CognitoService');

const userService = new UserService();
const cognitoService = new CognitoService();

/**
 * GET /api/users
 * Listar todos los usuarios (solo admin)
 */
const getAllUsers = async (req, res) => {
  try {
    const { limit, lastEvaluatedKey, role, status } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      lastEvaluatedKey: lastEvaluatedKey ? JSON.parse(lastEvaluatedKey) : undefined,
      filterByRole: role,
      filterByStatus: status !== undefined ? status === 'true' : undefined
    };

    const result = await userService.listUsers(options);

    res.json({
      users: result.users,
      pagination: {
        count: result.count,
        lastEvaluatedKey: result.lastEvaluatedKey
      }
    });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error obteniendo lista de usuarios' 
    });
  }
};

/**
 * GET /api/users/stats
 * Obtener estadísticas de usuarios (solo admin)
 */
const getUserStats = async (req, res) => {
  try {
    const stats = await userService.getUserStats();

    res.json({
      stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error obteniendo estadísticas' 
    });
  }
};

/**
 * GET /api/users/:userId
 * Obtener un usuario específico
 */
const getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userService.getUserById(userId);

    res.json({
      user
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ 
        error: 'NotFoundError',
        message: 'Usuario no encontrado' 
      });
    }

    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error obteniendo usuario' 
    });
  }
};

/**
 * POST /api/users
 * Crear nuevo usuario (solo admin)
 */
const createUser = async (req, res) => {
  try {
    const { email, password, role, metadata } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Email y password son requeridos' 
      });
    }

    const validRoles = ['admin', 'user', 'api_user'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: `Rol inválido. Válidos: ${validRoles.join(', ')}` 
      });
    }

    // Crear en Cognito primero
    const cognitoResult = await cognitoService.signUp(email, password, metadata);

    // Si el usuario tiene rol admin o api_user, actualizar en Cognito
    if (role && role !== 'user') {
      await cognitoService.updateUserAttributes(email, {
        'custom:role': role
      });
    }

    // Crear en DynamoDB
    const user = await userService.createUser({
      userId: cognitoResult.userSub,
      email,
      role: role || 'user',
      metadata
    });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    
    if (error.message.includes('ya está registrado')) {
      return res.status(409).json({ 
        error: 'ConflictError',
        message: 'El email ya está registrado' 
      });
    }

    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error creando usuario' 
    });
  }
};

/**
 * PUT /api/users/:userId
 * Actualizar usuario (solo admin)
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // No permitir actualizar ciertos campos
    delete updates.userId;
    delete updates.email;
    delete updates.createdAt;

    const user = await userService.updateUser(userId, updates);

    res.json({
      message: 'Usuario actualizado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ 
        error: 'NotFoundError',
        message: 'Usuario no encontrado' 
      });
    }

    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error actualizando usuario' 
    });
  }
};

/**
 * DELETE /api/users/:userId
 * Eliminar usuario (soft delete - solo admin)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // No permitir que un admin se elimine a sí mismo
    if (userId === req.user.userId) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'No puedes eliminar tu propia cuenta' 
      });
    }

    await userService.deleteUser(userId);

    res.json({
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error eliminando usuario' 
    });
  }
};

/**
 * PUT /api/users/:userId/role
 * Cambiar rol de usuario (solo admin)
 */
const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Rol es requerido' 
      });
    }

    // No permitir que un admin cambie su propio rol
    if (userId === req.user.userId) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'No puedes cambiar tu propio rol' 
      });
    }

    // Actualizar en DynamoDB
    const user = await userService.changeUserRole(userId, role);

    // Actualizar en Cognito (atributo custom:role)
    let cognitoResult = null;
    try {
      cognitoResult = await cognitoService.updateUserAttributes(user.email, {
        'custom:role': role
      });

      // Invalidar todas las sesiones del usuario para forzar re-login
      // Esto asegura que el nuevo JWT tenga el rol actualizado
      await cognitoService.adminSignOutUser(user.email);
      
      console.log(`✅ Rol actualizado en Cognito y sesiones invalidadas para: ${user.email}`);
    } catch (cognitoError) {
      console.error('⚠️  Error actualizando Cognito, pero el usuario fue actualizado en DynamoDB:', cognitoError);
      // No fallar la operación si Cognito falla, el rol está actualizado en DB
    }

    res.json({
      message: 'Rol actualizado exitosamente',
      user,
      requiresRelogin: true,
      info: cognitoResult?.success 
        ? 'El usuario debe cerrar sesión y volver a iniciar sesión para que el cambio tome efecto.'
        : 'Rol actualizado en la base de datos. El usuario debe contactar al administrador si tiene problemas de permisos.',
      cognitoUpdated: cognitoResult?.success || false
    });
  } catch (error) {
    console.error('Error cambiando rol:', error);
    
    if (error.message.includes('Rol inválido')) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: error.message 
      });
    }

    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error cambiando rol de usuario' 
    });
  }
};

/**
 * POST /api/users/:userId/api-key
 * Generar API key para usuario (solo admin)
 */
const generateApiKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await userService.generateApiKey(userId);

    res.json({
      message: 'API key generada exitosamente',
      apiKey: result.apiKey, // Mostrar completa solo esta vez
      user: result.user,
      warning: 'Guarda esta API key en un lugar seguro. No podrás verla de nuevo.'
    });
  } catch (error) {
    console.error('Error generando API key:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error generando API key' 
    });
  }
};

/**
 * DELETE /api/users/:userId/api-key
 * Revocar API key de usuario (solo admin)
 */
const revokeApiKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userService.revokeApiKey(userId);

    res.json({
      message: 'API key revocada exitosamente',
      user
    });
  } catch (error) {
    console.error('Error revocando API key:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error revocando API key' 
    });
  }
};

/**
 * PUT /api/users/:userId/status
 * Activar/desactivar usuario (solo admin)
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'isActive es requerido' 
      });
    }

    // No permitir desactivar la propia cuenta
    if (userId === req.user.userId) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'No puedes desactivar tu propia cuenta' 
      });
    }

    const user = await userService.toggleUserStatus(userId, isActive);

    res.json({
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      user
    });
  } catch (error) {
    console.error('Error cambiando estado de usuario:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error cambiando estado de usuario' 
    });
  }
};

module.exports = {
  getAllUsers,
  getUserStats,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  changeUserRole,
  generateApiKey,
  revokeApiKey,
  toggleUserStatus
};
