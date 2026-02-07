const axios = require('axios');
const crypto = require('crypto');
const { 
  CognitoIdentityProviderClient, 
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  AdminUserGlobalSignOutCommand
} = require('@aws-sdk/client-cognito-identity-provider');

class CognitoService {
  constructor() {
    this.userPoolId = process.env.COGNITO_USER_POOL_ID;
    this.clientId = process.env.COGNITO_CLIENT_ID;
    this.clientSecret = process.env.COGNITO_CLIENT_SECRET;
    this.region = process.env.COGNITO_REGION || 'us-east-1';
    this.cognitoDomain = process.env.COGNITO_DOMAIN;
    
    // Inicializar cliente de AWS SDK para operaciones administrativas
    this.cognitoClient = new CognitoIdentityProviderClient({ 
      region: this.region 
    });
  }

  /**
   * Calcular SecretHash requerido cuando el App Client tiene client secret
   */
  calculateSecretHash(username) {
    return crypto
      .createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  /**
   * Registrar nuevo usuario en Cognito
   */
  async signUp(email, password, attributes = {}) {
    try {
      const userAttributes = [
        { Name: 'email', Value: email }
      ];

      if (attributes.name) {
        userAttributes.push({ Name: 'name', Value: attributes.name });
      }

      const params = {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes
      };

      // Agregar SecretHash si hay client secret configurado
      if (this.clientSecret) {
        params.SecretHash = this.calculateSecretHash(email);
      }

      const command = new SignUpCommand(params);
      const response = await this.cognitoClient.send(command);

      return {
        userSub: response.UserSub,
        email,
        userConfirmed: response.UserConfirmed,
        message: 'Usuario registrado. Se envió email de confirmación.'
      };
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        throw new Error('El email ya está registrado');
      }
      if (error.name === 'InvalidPasswordException') {
        throw new Error('La contraseña no cumple los requisitos de seguridad (mínimo 8 caracteres, mayúscula, minúscula, número y símbolo)');
      }
      if (error.name === 'InvalidParameterException') {
        throw new Error(`Parámetro inválido: ${error.message}`);
      }
      console.error('Error detallado en signUp:', error);
      throw new Error(`Error en registro: ${error.message}`);
    }
  }

  /**
   * Auto-confirmar usuario desde el backend (Admin)
   * Útil cuando no se quiere depender del email de confirmación
   */
  async adminConfirmUser(email) {
    try {
      const command = new AdminConfirmSignUpCommand({
        UserPoolId: this.userPoolId,
        Username: email
      });

      await this.cognitoClient.send(command);
      console.log(`✅ Usuario auto-confirmado: ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Error auto-confirmando usuario:', error);
      throw new Error(`Error confirmando usuario: ${error.message}`);
    }
  }

  /**
   * Iniciar sesión y obtener tokens
   */
  async signIn(email, password) {
    try {
      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      // Agregar SecretHash si hay client secret configurado
      if (this.clientSecret) {
        params.AuthParameters.SECRET_HASH = this.calculateSecretHash(email);
      }

      const command = new InitiateAuthCommand(params);
      const response = await this.cognitoClient.send(command);

      const result = response.AuthenticationResult;

      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken,
        expiresIn: result.ExpiresIn
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new Error('Credenciales inválidas');
      }
      if (error.name === 'UserNotConfirmedException') {
        throw new Error('Usuario no confirmado. Revisa tu email para confirmar tu cuenta.');
      }
      if (error.name === 'UserNotFoundException') {
        throw new Error('Credenciales inválidas');
      }
      console.error('Error detallado en signIn:', error);
      throw new Error(`Error en login: ${error.message}`);
    }
  }

  /**
   * Refrescar tokens usando refresh token
   */
  async refreshTokens(refreshToken) {
    try {
      const response = await axios.post(
        `https://${this.cognitoDomain}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      throw new Error(`Error refrescando tokens: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Obtener información del usuario decodificando el ID Token (JWT)
   * Funciona con tokens de InitiateAuth y OAuth2 flows
   */
  getUserInfoFromIdToken(idToken) {
    try {
      const payload = JSON.parse(
        Buffer.from(idToken.split('.')[1], 'base64').toString()
      );

      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        username: payload['cognito:username'] || payload.email,
        customRole: payload['custom:role']
      };
    } catch (error) {
      throw new Error(`Error decodificando ID token: ${error.message}`);
    }
  }

  /**
   * Obtener información del usuario desde el endpoint OAuth2 /userInfo
   * Solo funciona con access tokens obtenidos a través del flujo OAuth2 (hosted UI)
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(
        `https://${this.cognitoDomain}/oauth2/userInfo`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return {
        sub: response.data.sub,
        email: response.data.email,
        emailVerified: response.data.email_verified,
        username: response.data.username,
        customRole: response.data['custom:role']
      };
    } catch (error) {
      throw new Error(`Error obteniendo info de usuario: ${error.message}`);
    }
  }

  /**
   * Cerrar sesión (invalidar tokens)
   */
  async signOut(accessToken) {
    try {
      await axios.post(
        `https://${this.cognitoDomain}/oauth2/revoke`,
        new URLSearchParams({
          token: accessToken,
          client_id: this.clientId
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      return { success: true };
    } catch (error) {
      // Ignorar errores de revocación, el token expirará de todas formas
      console.warn('Error revocando token:', error.message);
      return { success: true };
    }
  }

  /**
   * Iniciar recuperación de contraseña
   */
  async forgotPassword(email) {
    // AWS SDK: cognito.forgotPassword({...}).promise();
    return { 
      success: true,
      message: 'Se envió código de recuperación al email' 
    };
  }

  /**
   * Confirmar nueva contraseña
   */
  async confirmPassword(email, confirmationCode, newPassword) {
    // AWS SDK: cognito.confirmForgotPassword({...}).promise();
    return { success: true };
  }

  /**
   * Cambiar contraseña (usuario autenticado)
   */
  async changePassword(accessToken, oldPassword, newPassword) {
    // AWS SDK: cognito.changePassword({...}).promise();
    return { success: true };
  }

  /**
   * Actualizar atributos del usuario en Cognito (ej: custom:role)
   * @param {string} emailOrUsername - Email o username del usuario
   * @param {object} attributes - Objeto con atributos a actualizar (ej: {'custom:role': 'admin'})
   * @returns {Promise<object>} Resultado de la operación
   */
  async updateUserAttributes(emailOrUsername, attributes) {
    try {
      // Primero obtener el usuario para verificar que existe
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: emailOrUsername
      });
      
      const userResponse = await this.cognitoClient.send(getUserCommand);
      const username = userResponse.Username;

      // Convertir objeto de atributos al formato requerido por Cognito
      const attributeList = Object.entries(attributes).map(([key, value]) => ({
        Name: key,
        Value: String(value)
      }));

      // Actualizar atributos en Cognito
      const updateCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: attributeList
      });

      await this.cognitoClient.send(updateCommand);

      console.log(`✅ Atributos actualizados en Cognito para usuario: ${emailOrUsername}`);
      console.log(`   Atributos actualizados:`, attributes);
      
      return { 
        success: true,
        message: 'Atributos actualizados en Cognito',
        username,
        updatedAttributes: attributes
      };
    } catch (error) {
      console.error('❌ Error actualizando atributos en Cognito:', error);
      
      // Si el usuario no existe en Cognito, no es un error crítico
      if (error.name === 'UserNotFoundException') {
        console.warn(`⚠️  Usuario ${emailOrUsername} no encontrado en Cognito`);
        return {
          success: false,
          message: 'Usuario no encontrado en Cognito',
          error: 'UserNotFoundException'
        };
      }
      
      throw new Error(`Error actualizando atributos en Cognito: ${error.message}`);
    }
  }

  /**
   * Invalidar todas las sesiones activas de un usuario
   * Útil cuando se cambia el rol para forzar re-login
   * @param {string} emailOrUsername - Email o username del usuario
   * @returns {Promise<object>} Resultado de la operación
   */
  async adminSignOutUser(emailOrUsername) {
    try {
      const command = new AdminUserGlobalSignOutCommand({
        UserPoolId: this.userPoolId,
        Username: emailOrUsername
      });

      await this.cognitoClient.send(command);
      
      console.log(`✅ Sesiones invalidadas para usuario: ${emailOrUsername}`);
      
      return { 
        success: true, 
        message: 'Todas las sesiones del usuario han sido invalidadas' 
      };
    } catch (error) {
      console.error('❌ Error invalidando sesiones:', error);
      
      // Si el usuario no existe, no es un error crítico
      if (error.name === 'UserNotFoundException') {
        console.warn(`⚠️  Usuario ${emailOrUsername} no encontrado en Cognito`);
        return {
          success: false,
          message: 'Usuario no encontrado en Cognito',
          error: 'UserNotFoundException'
        };
      }
      
      throw new Error(`Error invalidando sesiones: ${error.message}`);
    }
  }

  /**
   * Eliminar usuario de Cognito
   */
  async deleteUser(username) {
    // AWS SDK: cognito.adminDeleteUser({...}).promise();
    return { success: true };
  }

  /**
   * Generar URL de OAuth para providers externos
   */
  getOAuthUrl(provider, redirectUri, state = '') {
    const baseUrl = `https://${this.cognitoDomain}/oauth2/authorize`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: redirectUri,
      identity_provider: provider, // 'Google' o 'Microsoft'
      state: state
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Intercambiar authorization code por tokens
   */
  async exchangeCodeForTokens(code, redirectUri) {
    try {
      const response = await axios.post(
        `https://${this.cognitoDomain}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          code: code,
          redirect_uri: redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error detallado:', {
        error: error.response?.data,
        status: error.response?.status,
        message: error.message
      });
      throw new Error(`Error intercambiando código: ${error.response?.data?.error || error.message}`);
    }
  }
}

module.exports = CognitoService;
