const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Cliente JWKS para verificar tokens de Cognito
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000 // 24 horas
});

/**
 * Obtiene la clave pública para verificar el token JWT
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Middleware para verificar token JWT de Cognito
 * Extrae el token del header Authorization y lo verifica
 */
const verifyToken = async (req, res, next) => {
  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No se proporcionó token de autenticación' 
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    // Verificar token con promisify
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          issuer: `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
          algorithms: ['RS256']
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    // Extraer información del usuario del token
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded['custom:role'] || 'user',
      username: decoded['cognito:username'],
      tokenUse: decoded.token_use
    };

    next();
  } catch (error) {
    console.error('Error verificando token:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TokenExpired',
        message: 'El token ha expirado' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'InvalidToken',
        message: 'Token inválido' 
      });
    }

    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Error verificando autenticación' 
    });
  }
};

/**
 * Middleware para verificar roles específicos
 * @param {string[]} allowedRoles - Array de roles permitidos
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Usuario no autenticado' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Acceso denegado. Rol requerido: ${allowedRoles.join(' o ')}` 
      });
    }

    next();
  };
};

/**
 * Middleware para verificar API Key (alternativa al JWT para api_user)
 * Lee el API key del header x-api-key
 */
const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No se proporcionó API key' 
      });
    }

    // Importar el repositorio de usuarios
    const UserRepository = require('../repositories/UserRepository');
    const userRepo = new UserRepository();

    // Buscar usuario por API key
    const user = await userRepo.getUserByApiKey(apiKey);

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'API key inválida o usuario inactivo' 
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      authMethod: 'apiKey'
    };

    // Actualizar última vez usado el API key (opcional, pero útil para auditoría)
    await userRepo.updateApiKeyLastUsed(apiKey);

    next();
  } catch (error) {
    console.error('Error verificando API key:', error);
    return res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Error verificando API key' 
    });
  }
};

/**
 * Middleware combinado: permite autenticación por JWT o API Key
 * Útil para endpoints que pueden ser accedidos por usuarios web o por API
 */
const verifyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // Priorizar JWT si está presente
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyToken(req, res, next);
  }

  // Si no hay JWT, intentar con API key
  if (apiKey) {
    return verifyApiKey(req, res, next);
  }

  // Si no hay ninguno, rechazar
  return res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Se requiere autenticación (JWT token o API key)' 
  });
};

/**
 * Middleware para validar que el usuario solo acceda a sus propios recursos
 * Compara el userId del token con el userId del parámetro
 */
const validateResourceOwnership = (userIdParam = 'userId') => {
  return (req, res, next) => {
    const requestedUserId = req.params[userIdParam];
    const authenticatedUserId = req.user.userId;

    // Admins pueden acceder a cualquier recurso
    if (req.user.role === 'admin') {
      return next();
    }

    // Usuarios normales solo pueden acceder a sus propios recursos
    if (requestedUserId !== authenticatedUserId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'No tienes permiso para acceder a este recurso' 
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRole,
  verifyApiKey,
  verifyAuth,
  validateResourceOwnership
};
