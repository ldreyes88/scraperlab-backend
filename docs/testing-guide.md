# Guía de Testing - Sistema de Autenticación ScraperLab

## Setup Inicial

### 1. Configurar Variables de Entorno

**Backend** (`scraperlab-backend/.env`):
```bash
# AWS Configuration
AWS_REGION=us-east-1
STAGE=dev

# DynamoDB Tables
PROVIDERS_TABLE_NAME=ScraperLab-Providers
DOMAINS_TABLE_NAME=ScraperLab-Domains
PROCESS_TABLE_NAME=ScraperLab-Process
USERS_TABLE_NAME=ScraperLab-Users

# AWS Cognito (completar con tus valores reales)
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
COGNITO_DOMAIN=scraperlab-auth.auth.us-east-1.amazoncognito.com
```

**Frontend** (`scraperlab-web/.env`):
```bash
VITE_API_URL=http://localhost:3000
```

### 2. Crear Infraestructura AWS

```bash
# Crear tabla de usuarios
cd scraperlab-backend
node scripts/createUsersTable.js --samples

# Ejecutar setup de Cognito (seguir instrucciones en scripts/setup-cognito.md)
```

### 3. Iniciar Servicios

**Terminal 1 - Backend:**
```bash
cd scraperlab-backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd scraperlab-web
npm run dev
```

## Tests Funcionales

### 1. Test de Registro (Email/Password)

#### Paso 1: Crear cuenta
1. Ir a `http://localhost:5173/register`
2. Completar formulario:
   - Nombre: "Usuario Test"
   - Email: "test@example.com"
   - Password: "TestPass123!"
   - Confirmar password: "TestPass123!"
3. Click en "Crear Cuenta"

**✅ Resultado esperado:**
- Mensaje de éxito
- Redirección a login después de 2 segundos
- Email de confirmación enviado (verificar en Cognito)

**❌ Casos de error a probar:**
- Password < 8 caracteres → Error de validación
- Passwords no coinciden → Error de validación
- Email ya registrado → Error 409

#### Paso 2: Confirmar email (opcional en dev)
```bash
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username test@example.com \
  --region us-east-1
```

### 2. Test de Login (Email/Password)

#### Paso 1: Login normal
1. Ir a `http://localhost:5173/login`
2. Ingresar:
   - Email: "test@example.com"
   - Password: "TestPass123!"
3. Click en "Iniciar Sesión"

**✅ Resultado esperado:**
- Login exitoso
- Tokens guardados en localStorage
- Redirección a `/` o a la página que intentaba acceder
- Header muestra usuario autenticado

**❌ Casos de error:**
- Credenciales incorrectas → Error 401
- Usuario no confirmado → Error específico

#### Paso 2: Verificar sesión persistente
1. Refrescar página
2. Verificar que sigue autenticado
3. Cerrar y reabrir navegador
4. Verificar que sigue autenticado

### 3. Test de OAuth - Google

#### Prerequisitos:
- Google OAuth configurado según `google-oauth-setup.md`
- Identity Provider agregado a Cognito

#### Paso 1: Login con Google
1. Ir a `http://localhost:5173/login`
2. Click en "Continuar con Google"
3. Seleccionar cuenta de Google
4. Autorizar permisos si es primera vez

**✅ Resultado esperado:**
- Redirección a Google
- Redirección de vuelta a `/callback`
- Procesamiento del código
- Redirección a `/`
- Usuario autenticado con datos de Google

**❌ Casos de error:**
- redirect_uri_mismatch → Verificar URIs en Google Console
- Usuario cancela login → Manejo graceful

### 4. Test de OAuth - Microsoft

#### Prerequisitos:
- Microsoft OAuth configurado según `microsoft-oauth-setup.md`
- Identity Provider agregado a Cognito

#### Paso 1: Login con Microsoft
1. Ir a `http://localhost:5173/login`
2. Click en "Continuar con Microsoft"
3. Ingresar credenciales de Microsoft
4. Autorizar permisos si es primera vez

**✅ Resultado esperado:**
- Redirección a Microsoft
- Redirección de vuelta a `/callback`
- Procesamiento del código
- Redirección a `/`
- Usuario autenticado con datos de Microsoft

### 5. Test de Recuperación de Contraseña

#### Paso 1: Solicitar código
1. Ir a `http://localhost:5173/forgot-password`
2. Ingresar email: "test@example.com"
3. Click en "Enviar Código"

**✅ Resultado esperado:**
- Mensaje de confirmación
- Email con código enviado (verificar en email o Cognito logs)

#### Paso 2: Resetear password
1. Ingresar código recibido
2. Nueva password: "NewPass123!"
3. Confirmar password: "NewPass123!"
4. Click en "Actualizar Contraseña"

**✅ Resultado esperado:**
- Mensaje de éxito
- Redirección a login
- Poder hacer login con nueva password

### 6. Test de Admin - Dashboard

#### Prerequisito: Usuario con rol admin

```bash
# Cambiar rol a admin
aws cognito-idp admin-update-user-attributes \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username test@example.com \
  --user-attributes Name=custom:role,Value=admin \
  --region us-east-1

# Actualizar en DynamoDB también (usando admin panel o AWS CLI)
```

#### Paso 1: Acceder a dashboard
1. Login como admin
2. Ir a `http://localhost:5173/admin`

**✅ Resultado esperado:**
- Dashboard carga correctamente
- KPIs muestran datos (o placeholders)
- Gráficos se renderizan
- Sidebar visible con navegación

**❌ Si no es admin:**
- Página de acceso denegado
- No puede acceder a `/admin/*`

### 7. Test de Admin - Gestión de Usuarios

#### Paso 1: Ver lista de usuarios
1. Ir a `http://localhost:5173/admin/users`

**✅ Resultado esperado:**
- Tabla con usuarios carga
- Filtros funcionan
- Search funciona

#### Paso 2: Cambiar rol
1. Seleccionar un usuario
2. Cambiar rol a "api_user" en el dropdown
3. Confirmar cambio

**✅ Resultado esperado:**
- Rol actualizado en tabla
- Cambio reflejado en DynamoDB y Cognito

#### Paso 3: Generar API Key
1. Click en "Generar" en columna API Key
2. Copiar la key mostrada

**✅ Resultado esperado:**
- Modal con API key completa
- Warning de que no se volverá a mostrar
- Key guardada en DynamoDB (parcialmente oculta en tabla)

#### Paso 4: Usar API Key
```bash
# Test con curl
curl -X POST http://localhost:3000/api/scrape \
  -H "x-api-key: sl_live_XXXXXXXXXXXXXXXXXXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "domain": "example.com"
  }'
```

**✅ Resultado esperado:**
- Request autenticado con API key
- Respuesta exitosa del scraper

#### Paso 5: Revocar API Key
1. Click en ícono X junto a la API key
2. Confirmar revocación

**✅ Resultado esperado:**
- API key eliminada de DynamoDB
- Intentar usar la key → Error 401

#### Paso 6: Desactivar usuario
1. Click en toggle de estado
2. Usuario pasa a "Inactivo"

**✅ Resultado esperado:**
- Usuario no puede hacer login
- Tokens existentes siguen válidos hasta expirar

### 8. Test de Admin - Dominios

#### Paso 1: Ver dominios
1. Ir a `http://localhost:5173/admin/domains`

**✅ Resultado esperado:**
- Lista de dominios configurados
- Estado (activo/inactivo) visible

#### Paso 2: Toggle estado
1. Click en toggle de un dominio
2. Estado cambia

**✅ Resultado esperado:**
- Cambio reflejado en DynamoDB
- Dominio inactivo no se usa para scraping

### 9. Test de Admin - Providers

1. Ir a `http://localhost:5173/admin/providers`

**✅ Resultado esperado:**
- Lista de providers en cards
- Estado de cada provider visible

### 10. Test de Admin - Process Logs

#### Paso 1: Ver logs
1. Ir a `http://localhost:5173/admin/process`

**✅ Resultado esperado:**
- Tabla con logs de procesos
- Filtros por estado y fecha funcionan
- Search funciona

#### Paso 2: Exportar CSV
1. Aplicar algún filtro
2. Click en "Exportar CSV"

**✅ Resultado esperado:**
- Descarga archivo CSV
- CSV contiene datos filtrados

### 11. Test de Autorización - Endpoints Protegidos

```bash
# Sin autenticación → 401
curl http://localhost:3000/api/users

# Con token inválido → 401
curl -H "Authorization: Bearer invalid_token" \
  http://localhost:3000/api/users

# Con token válido pero sin rol admin → 403
curl -H "Authorization: Bearer USER_TOKEN" \
  http://localhost:3000/api/users

# Con token admin válido → 200
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3000/api/users
```

### 12. Test de Refresh Token

#### Paso 1: Simular token expirado
1. En DevTools → Application → localStorage
2. Modificar `scraperlab_tokens.accessToken` a un valor inválido
3. Hacer una request (ej: ir a `/admin`)

**✅ Resultado esperado:**
- Frontend detecta 401
- Intenta refresh automático
- Request original se reintenta con nuevo token
- Usuario no nota nada (o mínimo delay)

**❌ Si refresh falla:**
- Logout automático
- Redirección a `/login`

### 13. Test de Logout

1. Click en "Cerrar sesión" en el sidebar
2. Verificar:
   - localStorage limpio
   - Redirección a `/login`
   - No puede acceder a rutas protegidas
   - Volver atrás en navegador → redirige a login

## Tests de Integración

### Backend Health Check
```bash
curl http://localhost:3000/health
# Esperado: { "status": "ok", ... }
```

### Test de Endpoints

#### Auth Endpoints
```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"Test123!","name":"New User"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

# Me (requires token)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Checklist de Testing Completo

### Backend
- [ ] Cognito User Pool creado y configurado
- [ ] Tabla Users creada en DynamoDB
- [ ] Dependencies instaladas
- [ ] Servidor inicia sin errores
- [ ] Health check responde
- [ ] Endpoints públicos accesibles
- [ ] Endpoints protegidos requieren auth
- [ ] JWT tokens se verifican correctamente
- [ ] API keys funcionan
- [ ] Refresh token funciona

### Frontend
- [ ] Dependencies instaladas
- [ ] App inicia sin errores
- [ ] Rutas públicas accesibles
- [ ] Rutas protegidas redirigen a login
- [ ] AuthContext funciona
- [ ] Login con email/password funciona
- [ ] Login con Google funciona
- [ ] Login con Microsoft funciona
- [ ] Registro funciona
- [ ] Recuperación de password funciona
- [ ] Logout funciona
- [ ] Sesión persiste en refresh
- [ ] Refresh token automático funciona

### Admin Panel
- [ ] Dashboard carga y muestra datos
- [ ] Gestión de usuarios funciona
- [ ] Cambio de roles funciona
- [ ] Generación de API keys funciona
- [ ] Revocación de API keys funciona
- [ ] Toggle de estado funciona
- [ ] Gestión de dominios funciona
- [ ] Visualización de providers funciona
- [ ] Logs de procesos funcionan
- [ ] Exportación a CSV funciona
- [ ] Filtros y búsqueda funcionan

### OAuth
- [ ] Google OAuth configurado
- [ ] Microsoft OAuth configurado
- [ ] Callback procesa código correctamente
- [ ] Usuario se crea en DynamoDB
- [ ] Atributos se mapean correctamente

### Seguridad
- [ ] Endpoints admin solo accesibles por admins
- [ ] API keys hasheadas en BD
- [ ] Passwords no se guardan (solo en Cognito)
- [ ] Tokens expiran correctamente
- [ ] Logout invalida sesión

## Problemas Comunes y Soluciones

### Backend no inicia
- Verificar variables de entorno
- Verificar credenciales AWS
- Verificar que DynamoDB tables existen

### 401 en todas las requests
- Verificar COGNITO_USER_POOL_ID correcto
- Verificar que JWKS endpoint es accesible
- Verificar formato del token

### OAuth no funciona
- Verificar redirect URIs coinciden exactamente
- Verificar Identity Provider habilitado en Cognito
- Verificar Client ID y Secret correctos

### Frontend no conecta con backend
- Verificar VITE_API_URL en .env
- Verificar CORS habilitado en backend
- Verificar ambos servicios corriendo

## Conclusión

Una vez completados todos los tests, el sistema de autenticación está listo para desarrollo. Para producción, asegúrate de:

1. Usar URLs de producción reales
2. Configurar HTTPS
3. Rotar secrets regularmente
4. Monitorear logs de Cognito
5. Implementar rate limiting
6. Configurar alertas de seguridad
