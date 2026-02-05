# Changelog: Sincronización de Roles con AWS Cognito

## Resumen de Cambios

Se implementó la sincronización automática del rol de usuario con el atributo `custom:role` de AWS Cognito. Ahora, todos los cambios de rol se reflejan tanto en DynamoDB como en Cognito, y el rol está disponible en los JWT tokens.

## Archivos Modificados

### Backend

#### 1. `src/handlers/users.js`
- **Cambio**: Creación de usuarios ahora establece `custom:role` en Cognito para TODOS los roles (no solo admin/api_user)
- **Líneas**: 96-153
- **Beneficio**: Consistencia total entre DynamoDB y Cognito desde la creación

```javascript
// Antes: Solo admin y api_user
if (role && role !== 'user') {
  await cognitoService.updateUserAttributes(email, {'custom:role': role});
}

// Después: Todos los usuarios
const userRole = role || 'user';
await cognitoService.updateUserAttributes(email, {'custom:role': userRole});
```

#### 2. `src/handlers/auth.js`
- **Cambios**:
  - Signup: Establece `custom:role` = 'user' al registrar (líneas 30-40)
  - Login: Sincroniza `custom:role` si el usuario se crea desde login (líneas 84-96)
  - OAuth Callback: Sincroniza `custom:role` para usuarios OAuth (líneas 377-391)
- **Beneficio**: Todos los flujos de autenticación establecen el rol en Cognito

#### 3. `src/services/CognitoService.js`
- **Ya existía**: Los métodos `updateUserAttributes()` y `adminSignOutUser()` ya estaban implementados
- **Sin cambios**: Funcionalidad completa desde el inicio

#### 4. `scripts/createUsersTable.js`
- **Nuevo**: Función `updateCognitoRole()` para sincronizar roles al crear usuarios de ejemplo
- **Beneficio**: Los scripts de inicialización también sincronizan Cognito
- **Uso**: `node scripts/createUsersTable.js --samples`

### Frontend

#### 5. `src/pages/admin/Users.jsx`
- **Cambio**: Mejorado el mensaje de confirmación al cambiar rol (líneas 96-119)
- **Beneficio**: Feedback claro al administrador sobre:
  - Éxito de la actualización en Cognito
  - Necesidad de re-login del usuario
  - Invalidación automática de sesiones

```javascript
// Mensaje mejorado incluye:
✅ Rol actualizado exitosamente!
⚠️ IMPORTANTE:
• El atributo custom:role se ha actualizado en AWS Cognito
• El usuario debe cerrar sesión y volver a iniciar sesión
• Los nuevos permisos se aplicarán al obtener un nuevo JWT
✓ Todas las sesiones activas del usuario han sido invalidadas automáticamente.
```

## Nuevos Documentos

### 6. `docs/COGNITO-CUSTOM-ROLE-SETUP.md`
- **Nuevo**: Guía completa de configuración del atributo `custom:role` en AWS Cognito
- **Contenido**:
  - Instrucciones paso a paso para crear el atributo
  - Configuración del App Client
  - Flujos de sincronización
  - Troubleshooting
  - Referencias a documentación oficial

### 7. `docs/CHANGELOG-CUSTOM-ROLE.md` (este archivo)
- **Nuevo**: Resumen de cambios implementados

## Flujos Actualizados

### Flujo 1: Registro de Usuario (Signup)

```
Usuario se registra
    ↓
1. Crear usuario en Cognito
    ↓
2. Establecer custom:role = 'user' ✨ NUEVO
    ↓
3. Crear registro en DynamoDB con role = 'user'
    ↓
Usuario creado con rol sincronizado
```

### Flujo 2: Creación de Usuario por Admin

```
Admin crea usuario con rol específico
    ↓
1. Crear usuario en Cognito
    ↓
2. Establecer custom:role = rol seleccionado ✨ MEJORADO
    ↓
3. Crear registro en DynamoDB con role
    ↓
Usuario creado con rol sincronizado
```

### Flujo 3: Cambio de Rol (Existente, Ya Funcionaba)

```
Admin cambia rol de usuario
    ↓
1. Actualizar role en DynamoDB
    ↓
2. Actualizar custom:role en Cognito ✅ YA EXISTÍA
    ↓
3. Invalidar todas las sesiones activas ✅ YA EXISTÍA
    ↓
Rol actualizado y sesiones invalidadas
```

### Flujo 4: Login

```
Usuario inicia sesión
    ↓
1. Autenticar con Cognito
    ↓
2. Obtener JWT con custom:role incluido
    ↓
3. Si es primera vez, crear usuario en DynamoDB con rol desde Cognito ✨ MEJORADO
    ↓
Usuario autenticado con rol sincronizado
```

## Validación del JWT

Después de estos cambios, el ID Token incluirá el rol:

```json
{
  "sub": "abc123-uuid",
  "email": "user@example.com",
  "custom:role": "admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Requisitos Previos

### En AWS Cognito

**IMPORTANTE**: Debes crear el atributo `custom:role` en el User Pool:

1. Ve a AWS Console > Cognito > User Pools > [Tu Pool]
2. Sign-up experience > Attributes > Add custom attribute
3. Configura:
   - Name: `role`
   - Type: `String`
   - Min: 3, Max: 10
   - Mutable: ✅ Yes

**Ver guía completa**: `docs/COGNITO-CUSTOM-ROLE-SETUP.md`

### Variables de Entorno

Asegúrate de tener estas variables en `.env`:

```bash
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_DOMAIN=scraperlab-auth.auth.us-east-1.amazoncognito.com
COGNITO_REGION=us-east-1
```

## Testing

### 1. Crear Usuario
```bash
POST /api/users
{
  "email": "test@example.com",
  "password": "Test123!",
  "role": "admin"
}
```

Verificar:
- Usuario creado en DynamoDB con `role: 'admin'`
- Usuario tiene `custom:role: 'admin'` en Cognito

### 2. Cambiar Rol
```bash
PUT /api/users/{userId}/role
{
  "role": "user"
}
```

Verificar:
- Rol actualizado en DynamoDB
- `custom:role` actualizado en Cognito
- Sesiones del usuario invalidadas

### 3. Login y JWT
```bash
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "Test123!"
}
```

Verificar:
- JWT incluye `custom:role` en el payload
- Decodificar en [jwt.io](https://jwt.io)

## Breaking Changes

Ninguno. Los cambios son retrocompatibles.

**Nota**: Los usuarios existentes que no tengan `custom:role` en Cognito:
- Funcionarán normalmente
- Se sincronizará el rol la próxima vez que se actualice su información

## Beneficios

1. ✅ **Sincronización automática**: El rol siempre está actualizado en Cognito y DynamoDB
2. ✅ **JWT incluye rol**: No es necesario consultar DB para validar permisos básicos
3. ✅ **Invalidación de sesiones**: Cambios de rol requieren re-login para seguridad
4. ✅ **Feedback claro**: El admin sabe exactamente qué pasó al cambiar un rol
5. ✅ **Documentación completa**: Guías paso a paso para configuración

## Próximos Pasos

1. Configurar el atributo `custom:role` en AWS Cognito (ver guía)
2. Desplegar los cambios del backend
3. Probar creación y cambio de roles
4. Verificar que los JWT incluyan el atributo `custom:role`

## Soporte

Para problemas o dudas:
- Revisa `docs/COGNITO-CUSTOM-ROLE-SETUP.md` (troubleshooting)
- Verifica logs del servidor
- Usa AWS CLI para inspeccionar usuarios en Cognito
