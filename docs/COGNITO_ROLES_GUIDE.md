# Guía de Roles y Cognito

## Resumen

Este documento explica cómo funciona el sistema de gestión de roles en ScraperLab, integrando AWS Cognito con DynamoDB.

## Arquitectura

### Almacenamiento de Roles

Los roles de usuario se almacenan en **dos lugares**:

1. **DynamoDB** (`users` table): Rol principal y fuente de verdad
   - Campo: `role` (valores: `admin`, `user`, `api_user`)
   
2. **AWS Cognito** (User Pool): Atributo custom del usuario
   - Atributo: `custom:role`
   - Se incluye automáticamente en el JWT token

### Flujo de Autenticación

```
1. Usuario inicia sesión
   └─> Cognito genera JWT token con custom:role
   
2. Request al backend con JWT
   └─> Middleware verifyToken decodifica el token
   └─> Extrae role del atributo custom:role
   └─> req.user.role = decoded['custom:role'] || 'user'
   
3. Middleware requireRole verifica permisos
   └─> Compara req.user.role con roles permitidos
   └─> 403 Forbidden si no coincide
```

## Actualización de Roles

### Método Automático (Recomendado)

Cuando cambias el rol de un usuario desde el panel de administración:

```javascript
// 1. Se actualiza DynamoDB
const user = await userService.changeUserRole(userId, newRole);

// 2. Se actualiza Cognito (custom:role)
await cognitoService.updateUserAttributes(user.email, {
  'custom:role': newRole
});

// 3. Se invalidan todas las sesiones activas
await cognitoService.adminSignOutUser(user.email);
```

**Resultado:** El usuario debe cerrar sesión y volver a iniciar sesión para obtener un nuevo JWT con el rol actualizado.

### Método Manual (Scripts)

Usa el script `makeUserAdmin.js` para hacer a un usuario administrador:

```bash
# Editar el email en el script
node scripts/makeUserAdmin.js
```

Este script:
- ✅ Actualiza el rol en DynamoDB
- ✅ Actualiza el atributo `custom:role` en Cognito
- ✅ Invalida todas las sesiones activas del usuario

## Variables de Entorno Requeridas

```env
# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
COGNITO_DOMAIN=tu-dominio.auth.us-east-1.amazoncognito.com

# AWS Credentials (para operaciones administrativas)
AWS_ACCESS_KEY_ID=xxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxx
```

## Permisos IAM Requeridos

Tu usuario/rol de AWS necesita estos permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminUserGlobalSignOut"
      ],
      "Resource": "arn:aws:cognito-idp:REGION:ACCOUNT_ID:userpool/USER_POOL_ID"
    }
  ]
}
```

## Roles Disponibles

### `admin`
- Acceso completo al panel de administración
- Puede gestionar usuarios, dominios, providers
- Puede ver estadísticas y logs de procesos
- Puede generar/revocar API keys

### `user`
- Puede usar la API de scraping con JWT
- Puede ver sus propios logs de procesos
- No tiene acceso al panel de administración

### `api_user`
- Similar a `user` pero diseñado para uso de API
- Puede usar API key en lugar de JWT
- Ideal para integraciones de servidor a servidor

## Endpoints Protegidos por Rol

### Solo Admin (`requireRole(['admin'])`)
```
GET    /api/users
GET    /api/users/stats
PUT    /api/users/:userId/role
GET    /api/providers
POST   /api/providers
GET    /api/domains
POST   /api/domains
PUT    /api/domains/:domainId
DELETE /api/domains/:domainId
GET    /api/process/stats
DELETE /api/process/:logId
```

### Admin o User (`requireRole(['admin', 'user'])`)
```
GET    /api/process
GET    /api/process/domain/:domainId
```

### Cualquier usuario autenticado (`verifyAuth`)
```
POST   /api/scrape
POST   /api/scrape/batch
POST   /api/scrape/test
```

## Solución de Problemas

### Error 403 después de cambiar rol

**Causa:** El JWT token aún tiene el rol antiguo.

**Solución:** 
1. El usuario debe cerrar sesión completamente
2. Limpiar localStorage del navegador (o esperar a que las sesiones expiren)
3. Volver a iniciar sesión

**Prevención:** El sistema automáticamente invalida las sesiones cuando cambias un rol.

### Usuario no puede acceder a recursos de admin

**Verificar:**
1. ¿El rol en DynamoDB es `admin`?
   ```bash
   # Verificar en DynamoDB Console o AWS CLI
   ```

2. ¿El atributo `custom:role` en Cognito es `admin`?
   ```bash
   aws cognito-idp admin-get-user \
     --user-pool-id us-east-1_xxxxxxxxx \
     --username user@example.com
   ```

3. ¿El usuario ha cerrado sesión y vuelto a iniciar?

### Cognito no se actualiza

**Posibles causas:**
- Credenciales AWS incorrectas o sin permisos
- Usuario no existe en Cognito
- Region incorrecta

**Verificar logs:**
```bash
# Los logs mostrarán errores específicos
tail -f logs/scraperlab.log
```

## Testing

### Probar cambio de rol

1. Crear un usuario de prueba
2. Cambiar su rol a `admin` desde el panel
3. Verificar que se muestra el mensaje de re-login
4. El usuario cierra sesión
5. El usuario vuelve a iniciar sesión
6. Verificar acceso al panel de admin

### Verificar JWT token

Decodifica el JWT token en [jwt.io](https://jwt.io) y verifica:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "custom:role": "admin",  // <-- Este campo debe estar presente
  "cognito:username": "username",
  ...
}
```

## Mejores Prácticas

1. **Nunca cambies tu propio rol** - El sistema lo previene automáticamente
2. **Siempre usa el panel de admin** - No modifiques roles directamente en la DB
3. **Documenta cambios de rol** - Especialmente cuando elevas privilegios
4. **Revoca API keys** cuando cambies un usuario a rol `user` (no necesita API key)
5. **Monitorea accesos** - Revisa los logs de usuarios admin regularmente

## Referencias

- [AWS Cognito User Pool Attributes](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html)
- [JWT Token Structure](https://jwt.io/introduction)
- [ScraperLab Architecture](./ARCHITECTURE.md)
