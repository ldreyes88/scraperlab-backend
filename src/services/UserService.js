const UserRepository = require('../repositories/UserRepository');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { nowColombiaISO } = require('../utils/time');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId) {
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return this.sanitizeUser(user);
  }

  /**
   * Obtener usuario por email
   */
  async getUserByEmail(email) {
    const user = await this.userRepository.getUserByEmail(email);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return this.sanitizeUser(user);
  }

  /**
   * Crear usuario (sincronizado con Cognito)
   */
  async createUser(userData) {
    // Validar que el email no exista
    const existingUser = await this.userRepository.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    const user = await this.userRepository.createUser({
      userId: userData.userId, // Cognito sub
      email: userData.email,
      role: userData.role || 'user',
      metadata: userData.metadata || {}
    });

    return this.sanitizeUser(user);
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId, updates) {
    // Validar que el usuario existe
    await this.getUserById(userId);

    // No permitir actualizar email o userId
    delete updates.email;
    delete updates.userId;

    const updatedUser = await this.userRepository.updateUser(userId, updates);
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Cambiar rol de usuario
   */
  async changeUserRole(userId, newRole) {
    const validRoles = ['admin', 'user', 'api_user'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Rol inválido. Roles válidos: ${validRoles.join(', ')}`);
    }

    const updatedUser = await this.userRepository.updateUser(userId, { role: newRole });
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Generar API key para usuario
   */
  async generateApiKey(userId) {
    const user = await this.getUserById(userId);
    
    // Generar API key única
    const apiKey = this.generateSecureApiKey();

    // Actualizar usuario con nueva API key
    const updatedUser = await this.userRepository.updateUser(userId, { 
      apiKey,
      apiKeyCreatedAt: nowColombiaISO()
    });

    return {
      user: this.sanitizeUser(updatedUser),
      apiKey // Retornar la key en texto plano solo esta vez
    };
  }

  /**
   * Revocar API key de usuario
   */
  async revokeApiKey(userId) {
    const updatedUser = await this.userRepository.updateUser(userId, { 
      apiKey: null,
      apiKeyLastUsed: null,
      apiKeyCreatedAt: null
    });

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Activar/desactivar usuario
   */
  async toggleUserStatus(userId, isActive) {
    const updatedUser = await this.userRepository.updateUser(userId, { isActive });
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUser(userId) {
    await this.userRepository.deleteUser(userId);
    return { message: 'Usuario desactivado exitosamente' };
  }

  /**
   * Listar usuarios con filtros
   */
  async listUsers(options = {}) {
    const result = await this.userRepository.listUsers(options);
    
    return {
      users: result.users.map(user => this.sanitizeUser(user)),
      lastEvaluatedKey: result.lastEvaluatedKey,
      count: result.count
    };
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getUserStats() {
    const counts = await this.userRepository.countUsersByRole();
    
    return {
      total: counts.total,
      byRole: {
        admin: counts.admin,
        user: counts.user,
        api_user: counts.api_user
      },
      active: counts.total // TODO: agregar conteo de activos vs inactivos
    };
  }

  /**
   * Generar API key segura
   */
  generateSecureApiKey() {
    // Formato: sl_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    const randomBytes = crypto.randomBytes(24);
    const key = randomBytes.toString('base64')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '')
      .substring(0, 32);
    
    return `sl_live_${key}`;
  }

  /**
   * Sanitizar usuario (remover información sensible)
   */
  sanitizeUser(user) {
    if (!user) return null;

    const sanitized = { ...user };
    
    // Ocultar parcialmente el API key
    if (sanitized.apiKey) {
      const key = sanitized.apiKey;
      sanitized.apiKey = `${key.substring(0, 12)}...${key.substring(key.length - 4)}`;
    }

    return sanitized;
  }

  /**
   * Verificar si un usuario tiene un rol específico
   */
  async hasRole(userId, role) {
    const user = await this.getUserById(userId);
    return user.role === role;
  }

  /**
   * Verificar si un usuario es admin
   */
  async isAdmin(userId) {
    return await this.hasRole(userId, 'admin');
  }
}

module.exports = UserService;
