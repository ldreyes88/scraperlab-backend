# Quick Start: custom:role en AWS Cognito

Guía rápida de 5 minutos para configurar y probar la sincronización de roles.

## 🚀 Configuración (5 minutos)

### Paso 1: Crear Atributo en Cognito (2 min)

1. Ve a [AWS Cognito Console](https://console.aws.amazon.com/cognito)
2. Selecciona tu User Pool
3. **Sign-up experience** → **Attributes** → **Add custom attribute**
4. Configura:
   ```
   Name:     role
   Type:     String
   Min:      3
   Max:      10
   Mutable:  ✅ Yes
   ```
5. Guarda

### Paso 2: Configurar App Client (2 min)

1. **App integration** → **App clients** → [Tu app]
2. **Edit** → **Token Generation**
3. En **ID token claims**, asegúrate que `custom:role` esté incluido
4. Guarda

### Paso 3: Verificar Variables de Entorno (1 min)

```bash
cd scraperlab-backend
cat .env | grep COGNITO
```

Debe mostrar:
```
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxx
COGNITO_DOMAIN=xxxxx.auth.us-east-1.amazoncognito.com
COGNITO_REGION=us-east-1
```

## ✅ Verificación Rápida

### Test 1: Verificar el atributo existe

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id <TU_USER_POOL_ID> \
  --region us-east-1 \
  --query 'UserPool.SchemaAttributes[?Name==`custom:role`]'
```

Debe retornar información del atributo. Si retorna `[]`, el atributo NO existe.

### Test 2: Crear usuario de prueba

```bash
# Crear usuario (si tienes un admin token)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "prueba@test.com",
    "password": "Test123!",
    "role": "user"
  }'
```

### Test 3: Verificar en Cognito

```bash
aws cognito-idp admin-get-user \
  --user-pool-id <TU_USER_POOL_ID> \
  --username prueba@test.com \
  --region us-east-1
```

Busca en el output:
```json
{
  "Name": "custom:role",
  "Value": "user"  ← DEBE ESTAR PRESENTE
}
```

### Test 4: Cambiar rol

Desde el panel admin en `http://localhost:3000/admin/users`:
1. Busca el usuario
2. Cambia el rol usando el dropdown
3. Verifica el mensaje de confirmación

### Test 5: Verificar JWT

1. Login con el usuario:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "prueba@test.com",
       "password": "Test123!"
     }'
   ```

2. Copia el `idToken` de la respuesta

3. Pégalo en [https://jwt.io](https://jwt.io)

4. Verifica el payload:
   ```json
   {
     "sub": "...",
     "email": "prueba@test.com",
     "custom:role": "user",  ← DEBE ESTAR AQUÍ
     ...
   }
   ```

## 🐛 Problemas Comunes

### ❌ Error: "InvalidParameterException"

```
An error occurred (InvalidParameterException) when calling 
the AdminUpdateUserAttributes operation
```

**Solución**: El atributo NO existe. Vuelve al Paso 1.

### ❌ JWT no incluye custom:role

**Solución**: 
1. Verifica configuración del App Client (Paso 2)
2. Regenera el token (logout + login)
3. Si persiste, revisa que el atributo sea `Mutable: Yes`

### ❌ Usuario no existe en Cognito

```
⚠️  Usuario prueba@test.com no encontrado en Cognito
```

**Solución**: 
1. El usuario debe registrarse primero: `POST /api/auth/signup`
2. O crear desde el panel admin

## 📋 Checklist Final

- [ ] Atributo `custom:role` creado en Cognito
- [ ] App Client configurado para incluir el atributo
- [ ] Variables de entorno correctas
- [ ] Test 1: Atributo existe ✅
- [ ] Test 2: Usuario creado ✅
- [ ] Test 3: custom:role en Cognito ✅
- [ ] Test 4: Cambio de rol funciona ✅
- [ ] Test 5: JWT incluye custom:role ✅

## 📚 Próximos Pasos

Una vez validado:

1. **Deploy a producción**:
   ```bash
   cd scraperlab-backend
   sls deploy --stage prod
   ```

2. **Actualizar usuarios existentes** (opcional):
   ```bash
   node scripts/updateExistingUsersRoles.js
   ```

3. **Monitorear logs**:
   ```bash
   sls logs -f users --stage prod --tail
   ```

## 🆘 Ayuda

Si tienes problemas:

1. Revisa logs del servidor: `tail -f logs/app.log`
2. Consulta `docs/COGNITO-CUSTOM-ROLE-SETUP.md` (troubleshooting detallado)
3. Verifica permisos IAM del usuario/role que ejecuta el backend
4. Asegúrate de tener permisos `cognito-idp:AdminUpdateUserAttributes`

## 🎉 ¡Listo!

Si todos los tests pasaron, la implementación está funcionando correctamente.

El sistema ahora:
- ✅ Sincroniza roles con Cognito al crear usuarios
- ✅ Actualiza custom:role al cambiar roles
- ✅ Invalida sesiones al cambiar roles
- ✅ Incluye rol en JWT tokens
- ✅ Muestra feedback claro al admin

---

**Tiempo estimado**: 5-10 minutos  
**Dificultad**: Fácil  
**Prerequisitos**: Acceso a AWS Console y permisos de Cognito
