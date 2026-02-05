# Configuración del Atributo custom:role en AWS Cognito

Este documento explica cómo configurar el atributo personalizado `custom:role` en AWS Cognito para gestionar roles de usuario.

## ¿Por qué necesitamos custom:role?

El atributo `custom:role` permite:
1. Almacenar el rol del usuario directamente en Cognito
2. Incluir el rol en los JWT tokens (ID Token)
3. Validar permisos sin consultar la base de datos en cada request
4. Mantener sincronización entre Cognito y DynamoDB

## Configuración en AWS Cognito

### Paso 1: Crear el Atributo Personalizado

1. Accede a la consola de AWS Cognito
2. Selecciona tu User Pool: `ScraperLab-Users` (o el nombre correspondiente)
3. Ve a la sección **"Sign-up experience"** o **"Attributes"**
4. Haz clic en **"Add custom attribute"**
5. Configura el atributo:
   - **Attribute name**: `role`
   - **Type**: `String`
   - **Min length**: 3
   - **Max length**: 10
   - **Mutable**: ✅ Yes (debe ser editable)

> **Nota**: El nombre del atributo será `custom:role` automáticamente (Cognito agrega el prefijo `custom:`).

### Paso 2: Configurar el App Client

1. Ve a la sección **"App integration"** > **"App clients"**
2. Selecciona tu App Client
3. En **"Token Generation"** > **"ID token claims"**:
   - Asegúrate de que `custom:role` esté incluido en los claims del ID Token
   - Si no aparece, agrégalo manualmente

### Paso 3: Verificar el Atributo

Puedes verificar que el atributo existe usando AWS CLI:

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id YOUR_USER_POOL_ID \
  --region us-east-1 \
  --query 'UserPool.SchemaAttributes[?Name==`custom:role`]'
```

## Roles Disponibles

El sistema ScraperLab maneja 3 roles:

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `user` | Usuario estándar | Acceso a funcionalidades básicas de scraping |
| `admin` | Administrador | Acceso completo al panel de administración |
| `api_user` | Usuario API | Acceso solo vía API key |

## Flujo de Sincronización

### 1. Creación de Usuario

Cuando se crea un usuario (signup o admin):
```javascript
// 1. Crear usuario en Cognito
const cognitoResult = await cognitoService.signUp(email, password);

// 2. Establecer custom:role en Cognito
await cognitoService.updateUserAttributes(email, {
  'custom:role': 'user' // o 'admin', 'api_user'
});

// 3. Crear registro en DynamoDB
await userService.createUser({
  userId: cognitoResult.userSub,
  email,
  role: 'user'
});
```

### 2. Cambio de Rol

Cuando un admin cambia el rol de un usuario:
```javascript
// 1. Actualizar en DynamoDB
await userService.changeUserRole(userId, newRole);

// 2. Actualizar custom:role en Cognito
await cognitoService.updateUserAttributes(email, {
  'custom:role': newRole
});

// 3. Invalidar sesiones activas (forzar re-login)
await cognitoService.adminSignOutUser(email);
```

### 3. Login

Al iniciar sesión, el JWT incluirá el rol:
```json
{
  "sub": "usuario-id",
  "email": "user@example.com",
  "custom:role": "admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Verificación del Atributo

### Opción 1: AWS Console

1. Ve a **Users** en tu User Pool
2. Selecciona un usuario
3. Revisa la sección **"Attributes"**
4. Deberías ver `custom:role` con su valor

### Opción 2: AWS CLI

```bash
aws cognito-idp admin-get-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username user@example.com \
  --region us-east-1 \
  --query 'UserAttributes[?Name==`custom:role`]'
```

### Opción 3: Decodificar JWT Token

Copia el ID Token y decodifícalo en [jwt.io](https://jwt.io). Deberías ver:
```json
{
  "custom:role": "user"
}
```

## Actualización Manual de Rol en Cognito

Si necesitas actualizar manualmente el rol de un usuario:

```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id YOUR_USER_POOL_ID \
  --username user@example.com \
  --user-attributes Name=custom:role,Value=admin \
  --region us-east-1
```

## Script de Inicialización

Para actualizar el rol de usuarios existentes, usa el script de creación de tablas:

```bash
# Actualizar roles de usuarios de ejemplo
node scripts/createUsersTable.js --samples
```

Este script:
1. Crea usuarios en DynamoDB (si no existen)
2. Actualiza el `custom:role` en Cognito (si el usuario existe en Cognito)

## Troubleshooting

### Error: "An error occurred (InvalidParameterException) when calling the AdminUpdateUserAttributes operation"

**Causa**: El atributo `custom:role` no existe en el User Pool.

**Solución**: Sigue los pasos del "Paso 1" para crear el atributo.

### El JWT no incluye custom:role

**Causa**: El App Client no está configurado para incluir el atributo en los tokens.

**Solución**: Verifica la configuración del App Client en "Paso 2".

### El usuario debe hacer logout/login después de cambiar rol

**Comportamiento esperado**: Cuando se cambia el rol de un usuario, las sesiones activas deben invalidarse para que el nuevo JWT incluya el rol actualizado.

El backend automáticamente:
1. Invalida todas las sesiones activas del usuario
2. Fuerza al usuario a hacer re-login
3. El nuevo JWT tendrá el rol actualizado

## Consideraciones de Seguridad

1. **No confiar solo en el JWT**: Aunque el JWT contiene el rol, siempre verifica en DynamoDB para operaciones críticas.

2. **Invalidar sesiones al cambiar rol**: El sistema automáticamente invalida todas las sesiones activas cuando se cambia un rol.

3. **Auditar cambios de rol**: Todos los cambios de rol se registran en los logs del servidor.

## Referencias

- [AWS Cognito Custom Attributes](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html)
- [JWT Token Structure](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
- [AdminUpdateUserAttributes API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminUpdateUserAttributes.html)
