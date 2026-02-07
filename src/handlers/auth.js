const CognitoService = require('../services/CognitoService');
const UserService = require('../services/UserService');

const cognitoService = new CognitoService();
const userService = new UserService();

/**
 * POST /api/auth/signup
 * Registrar nuevo usuario
 */
const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Email y password son requeridos' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }

    // Registrar en Cognito
    const cognitoResult = await cognitoService.signUp(email, password, { name });

    // Auto-confirmar usuario (evita depender del email de Cognito)
    await cognitoService.adminConfirmUser(email);

    // Establecer el rol por defecto en Cognito (custom:role)
    await cognitoService.updateUserAttributes(email, {
      'custom:role': 'user'
    });

    // Crear usuario en DynamoDB
    const user = await userService.createUser({
      userId: cognitoResult.userSub,
      email,
      role: 'user', // Por defecto todos son users
      metadata: { name }
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user,
      requiresConfirmation: false
    });
  } catch (error) {
    console.error('Error en signup:', error);
    
    if (error.message.includes('ya está registrado')) {
      return res.status(409).json({ 
        error: 'ConflictError',
        message: error.message 
      });
    }

    if (error.message.includes('requisitos de seguridad') || error.message.includes('Parámetro inválido')) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: error.message 
      });
    }

    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error registrando usuario' 
    });
  }
};

/**
 * POST /api/auth/login
 * Iniciar sesión con email y password
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Email y password son requeridos' 
      });
    }

    // Autenticar con Cognito
    const tokens = await cognitoService.signIn(email, password);

    // Obtener info del usuario decodificando el ID Token
    // (el access token de InitiateAuth no es compatible con /oauth2/userInfo)
    const userInfo = cognitoService.getUserInfoFromIdToken(tokens.idToken);

    // Obtener datos adicionales de DynamoDB
    let dbUser;
    try {
      dbUser = await userService.getUserById(userInfo.sub);
    } catch (error) {
      // Si el usuario no existe en DynamoDB, crearlo
      const defaultRole = userInfo.customRole || 'user';
      
      // Asegurarse de que el custom:role esté en Cognito
      try {
        await cognitoService.updateUserAttributes(userInfo.email, {
          'custom:role': defaultRole
        });
      } catch (cognitoError) {
        console.warn('⚠️ Error actualizando custom:role en login:', cognitoError.message);
      }
      
      dbUser = await userService.createUser({
        userId: userInfo.sub,
        email: userInfo.email,
        role: defaultRole
      });
    }

    res.json({
      message: 'Login exitoso',
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      },
      user: dbUser
    });
  } catch (error) {
    console.error('Error en login:', error);
    
    // Usuario no confirmado - necesita verificar email
    if (error.message.includes('no confirmado') || error.message.includes('not confirmed')) {
      return res.status(403).json({ 
        error: 'UserNotConfirmedException',
        message: 'Tu cuenta no está confirmada. Revisa tu email para confirmar tu cuenta.',
        requiresConfirmation: true
      });
    }

    // Error de auth flow no habilitado en Cognito
    if (error.message.includes('not supported') || error.message.includes('not enabled')) {
      console.error('⚠️ AUTH FLOW ERROR: USER_PASSWORD_AUTH puede no estar habilitado en el App Client de Cognito');
      return res.status(500).json({ 
        error: 'ConfigurationError',
        message: 'Error de configuración del servidor de autenticación'
      });
    }

    res.status(401).json({ 
      error: 'AuthenticationError',
      message: error.message || 'Credenciales inválidas' 
    });
  }
};

/**
 * POST /api/auth/refresh
 * Refrescar tokens usando refresh token
 */
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Refresh token es requerido' 
      });
    }

    const tokens = await cognitoService.refreshTokens(refreshToken);

    res.json({
      message: 'Tokens refrescados exitosamente',
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        expiresIn: tokens.expiresIn
      }
    });
  } catch (error) {
    console.error('Error refrescando tokens:', error);
    
    res.status(401).json({ 
      error: 'TokenError',
      message: 'Refresh token inválido o expirado' 
    });
  }
};

/**
 * GET /api/auth/me
 * Obtener información del usuario autenticado
 */
const me = async (req, res) => {
  try {
    // El middleware verifyToken ya agregó req.user
    const userId = req.user.userId;

    const user = await userService.getUserById(userId);

    res.json({
      user: {
        ...user,
        tokenInfo: {
          userId: req.user.userId,
          email: req.user.email,
          role: req.user.role,
          authMethod: req.user.authMethod || 'jwt'
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error obteniendo información del usuario' 
    });
  }
};

/**
 * POST /api/auth/logout
 * Cerrar sesión (invalidar tokens)
 */
const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await cognitoService.signOut(token);
    }

    res.json({
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    
    // Aunque falle, consideramos el logout exitoso en el cliente
    res.json({
      message: 'Sesión cerrada'
    });
  }
};

/**
 * POST /api/auth/forgot-password
 * Iniciar proceso de recuperación de contraseña
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Email es requerido' 
      });
    }

    await cognitoService.forgotPassword(email);

    res.json({
      message: 'Se envió un código de recuperación a tu email'
    });
  } catch (error) {
    console.error('Error en forgot password:', error);
    
    // Por seguridad, siempre retornar éxito aunque el email no exista
    res.json({
      message: 'Si el email existe, se enviará un código de recuperación'
    });
  }
};

/**
 * POST /api/auth/reset-password
 * Confirmar nueva contraseña con código
 */
const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Email, código y nueva contraseña son requeridos' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }

    await cognitoService.confirmPassword(email, code, newPassword);

    res.json({
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error en reset password:', error);
    
    res.status(400).json({ 
      error: 'ResetPasswordError',
      message: 'Código inválido o expirado' 
    });
  }
};

/**
 * POST /api/auth/change-password
 * Cambiar contraseña (usuario autenticado)
 */
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Contraseña actual y nueva contraseña son requeridas' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'La nueva contraseña debe tener al menos 8 caracteres' 
      });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);

    await cognitoService.changePassword(token, oldPassword, newPassword);

    res.json({
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error en change password:', error);
    
    res.status(400).json({ 
      error: 'ChangePasswordError',
      message: 'Error cambiando contraseña. Verifica tu contraseña actual.' 
    });
  }
};

/**
 * GET /api/auth/oauth/url
 * Obtener URL de OAuth para providers externos
 */
const getOAuthUrl = async (req, res) => {
  try {
    const { provider, redirectUri } = req.query;

    if (!provider || !redirectUri) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Provider y redirectUri son requeridos' 
      });
    }

    const validProviders = ['Google', 'Microsoft'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: `Provider inválido. Válidos: ${validProviders.join(', ')}` 
      });
    }

    const url = cognitoService.getOAuthUrl(provider, redirectUri);

    res.json({
      url,
      provider
    });
  } catch (error) {
    console.error('Error generando OAuth URL:', error);
    
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error generando URL de OAuth' 
    });
  }
};

/**
 * POST /api/auth/oauth/callback
 * Intercambiar código de OAuth por tokens
 */
const oauthCallback = async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ 
        error: 'ValidationError',
        message: 'Code y redirectUri son requeridos' 
      });
    }

    // Intercambiar código por tokens
    const tokens = await cognitoService.exchangeCodeForTokens(code, redirectUri);

    // Obtener info del usuario
    const userInfo = await cognitoService.getUserInfo(tokens.accessToken);

    // Obtener o crear usuario en DynamoDB
    let dbUser;
    try {
      dbUser = await userService.getUserById(userInfo.sub);
    } catch (error) {
      // Usuario nuevo desde OAuth, establecer rol por defecto
      const defaultRole = userInfo.customRole || 'user';
      
      // Asegurarse de que el custom:role esté en Cognito
      try {
        await cognitoService.updateUserAttributes(userInfo.email, {
          'custom:role': defaultRole
        });
      } catch (cognitoError) {
        console.warn('⚠️ Error actualizando custom:role para usuario OAuth:', cognitoError.message);
      }
      
      dbUser = await userService.createUser({
        userId: userInfo.sub,
        email: userInfo.email,
        role: defaultRole,
        metadata: {
          oauthProvider: true
        }
      });
    }

    res.json({
      message: 'Autenticación OAuth exitosa',
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      },
      user: dbUser
    });
  } catch (error) {
    console.error('Error en OAuth callback:', error);
    
    res.status(400).json({ 
      error: 'OAuthError',
      message: 'Error procesando autenticación OAuth' 
    });
  }
};

module.exports = {
  signup,
  login,
  refresh,
  me,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getOAuthUrl,
  oauthCallback
};
