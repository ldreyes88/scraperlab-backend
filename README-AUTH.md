# Sistema de Autenticación y Administración - ScraperLab

## 📋 Descripción

Sistema completo de autenticación y panel de administración para ScraperLab, construido con:

- **Backend**: Node.js + Express + AWS Cognito + DynamoDB
- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Autenticación**: AWS Cognito (Email/Password + OAuth Google/Microsoft)
- **Autorización**: Roles (admin, user, api_user) + API Keys

## 🏗️ Arquitectura

### Backend (scraperlab-backend)

```
src/
├── handlers/
│   ├── auth.js           # Endpoints de autenticación
│   ├── users.js          # CRUD de usuarios (admin)
│   ├── scraper.js        # Endpoints de scraping (protegidos)
│   ├── providers.js      # Gestión de providers (admin)
│   ├── domains.js        # Gestión de dominios (admin)
│   └── process.js        # Logs de procesos
├── middleware/
│   └── auth.js           # Middleware de autenticación JWT/API Key
├── repositories/
│   └── UserRepository.js # Acceso a datos de usuarios
├── services/
│   ├── UserService.js    # Lógica de negocio de usuarios
│   └── CognitoService.js # Integración con Cognito
└── config/
    └── database.js       # Configuración DynamoDB
```

### Frontend (scraperlab-web)

```
src/
├── pages/
│   ├── Login.jsx         # Página de login
│   ├── Register.jsx      # Página de registro
│   ├── ForgotPassword.jsx # Recuperación de contraseña
│   ├── OAuthCallback.jsx # Callback OAuth
│   └── admin/
│       ├── Dashboard.jsx # Dashboard principal
│       ├── Users.jsx     # Gestión de usuarios
│       ├── Domains.jsx   # Gestión de dominios
│       ├── Providers.jsx # Gestión de providers
│       └── Process.jsx   # Logs de procesos
├── components/
│   ├── admin/
│   │   ├── AdminLayout.jsx # Layout admin
│   │   └── Sidebar.jsx     # Sidebar de navegación
│   └── common/
│       └── ProtectedRoute.jsx # HOC para rutas protegidas
├── context/
│   └── AuthContext.jsx   # Context de autenticación
├── hooks/
│   └── useAuth.js        # Hook de autenticación
└── services/
    ├── api.js            # Cliente axios configurado
    ├── authService.js    # Servicios de autenticación
    └── adminService.js   # Servicios admin
```

## 🚀 Setup e Instalación

### 1. Prerequisitos

- Node.js 18+
- AWS Account con acceso a:
  - Cognito
  - DynamoDB
  - IAM
- AWS CLI configurado

### 2. Backend Setup

```bash
cd scraperlab-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Crear tabla de usuarios en DynamoDB
node scripts/createUsersTable.js --samples

# Configurar Cognito (seguir guía en scripts/setup-cognito.md)

# Iniciar servidor de desarrollo
npm run dev
```

### 3. Frontend Setup

```bash
cd scraperlab-web

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con la URL del backend

# Iniciar servidor de desarrollo
npm run dev
```

### 4. Configuración de OAuth (Opcional pero recomendado)

#### Google OAuth
Seguir guía en `docs/google-oauth-setup.md`

#### Microsoft OAuth
Seguir guía en `docs/microsoft-oauth-setup.md`

## 📚 Documentación

- [`scripts/setup-cognito.md`](scripts/setup-cognito.md) - Configuración de AWS Cognito
- [`docs/google-oauth-setup.md`](docs/google-oauth-setup.md) - Configuración de Google OAuth
- [`docs/microsoft-oauth-setup.md`](docs/microsoft-oauth-setup.md) - Configuración de Microsoft OAuth
- [`docs/testing-guide.md`](docs/testing-guide.md) - Guía completa de testing

## 🔑 Características Implementadas

### Autenticación

✅ Registro con email y contraseña  
✅ Login con email y contraseña  
✅ Login con Google OAuth  
✅ Login con Microsoft OAuth  
✅ Recuperación de contraseña  
✅ Cambio de contraseña  
✅ Logout con invalidación de tokens  
✅ Refresh automático de tokens  
✅ Sesión persistente  

### Autorización

✅ Sistema de roles (admin, user, api_user)  
✅ Middleware de verificación de JWT  
✅ Middleware de verificación de API Keys  
✅ Middleware de verificación de roles  
✅ Protección de endpoints por rol  
✅ Rutas protegidas en frontend  

### Panel de Administración

✅ Dashboard con KPIs y gráficos  
✅ Gestión completa de usuarios  
✅ Cambio de roles  
✅ Generación y revocación de API Keys  
✅ Activación/desactivación de usuarios  
✅ Gestión de dominios  
✅ Gestión de providers  
✅ Visualización de logs de procesos  
✅ Filtros y búsqueda avanzada  
✅ Exportación a CSV  

### API Keys

✅ Generación de API keys únicas  
✅ Uso de API keys para autenticación  
✅ Tracking de uso de API keys  
✅ Revocación de API keys  

## 🔐 Endpoints del API

### Públicos

```
POST   /api/auth/signup              # Registro
POST   /api/auth/login               # Login
POST   /api/auth/refresh             # Refresh tokens
POST   /api/auth/forgot-password     # Recuperar contraseña
POST   /api/auth/reset-password      # Resetear contraseña
GET    /api/auth/oauth/url           # Obtener URL OAuth
POST   /api/auth/oauth/callback      # Callback OAuth
```

### Protegidos (requieren autenticación)

```
GET    /api/auth/me                  # Usuario actual
POST   /api/auth/logout              # Logout
POST   /api/auth/change-password     # Cambiar contraseña
```

### Admin (solo role: admin)

```
GET    /api/users                    # Listar usuarios
GET    /api/users/stats              # Estadísticas de usuarios
GET    /api/users/:userId            # Ver usuario
POST   /api/users                    # Crear usuario
PUT    /api/users/:userId            # Actualizar usuario
DELETE /api/users/:userId            # Eliminar usuario
PUT    /api/users/:userId/role       # Cambiar rol
POST   /api/users/:userId/api-key    # Generar API key
DELETE /api/users/:userId/api-key    # Revocar API key
PUT    /api/users/:userId/status     # Cambiar estado

GET    /api/providers                # Listar providers
GET    /api/providers/:providerId    # Ver provider
POST   /api/providers                # Crear provider
PUT    /api/providers/:providerId    # Actualizar provider

GET    /api/domains                  # Listar dominios
GET    /api/domains/:domainId        # Ver dominio
POST   /api/domains                  # Crear dominio
PUT    /api/domains/:domainId        # Actualizar dominio
DELETE /api/domains/:domainId        # Eliminar dominio
PUT    /api/domains/:domainId/toggle # Toggle estado

GET    /api/process                  # Listar logs
GET    /api/process/stats            # Estadísticas
DELETE /api/process/:logId           # Eliminar log
```

### Scraping (requiere JWT o API key)

```
POST   /api/scrape                   # Scrape single URL
POST   /api/scrape/batch             # Scrape múltiples URLs
POST   /api/scrape/test              # Test scraping
```

## 🔒 Seguridad

### Tokens JWT

- **Access Token**: 1 hora de validez
- **ID Token**: 1 hora de validez
- **Refresh Token**: 30 días de validez
- Verificación con JWKS de Cognito
- Refresh automático en frontend

### API Keys

- Formato: `sl_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- Almacenadas en DynamoDB
- Mostradas completas solo al momento de creación
- Verificadas mediante índice GSI

### Roles

- **admin**: Acceso completo al panel de administración
- **user**: Acceso a endpoints de scraping
- **api_user**: Diseñado para integraciones vía API Key

## 🎨 UI/UX

- Diseño moderno con Tailwind CSS
- Responsive (mobile, tablet, desktop)
- Loading states y error handling
- Validaciones en tiempo real
- Mensajes de éxito/error informativos
- Gráficos interactivos con Recharts

## 📊 Tablas DynamoDB

### ScraperLab-Users

```
PK: userId (Cognito sub)
Attributes:
  - email
  - role (admin|user|api_user)
  - apiKey
  - apiKeyLastUsed
  - isActive
  - createdAt
  - updatedAt
  - metadata {}

GSI:
  - EmailIndex (email)
  - ApiKeyIndex (apiKey)
```

## 🧪 Testing

Ver guía completa en [`docs/testing-guide.md`](docs/testing-guide.md)

```bash
# Backend
cd scraperlab-backend
npm run dev

# Frontend
cd scraperlab-web
npm run dev

# Acceder a:
# - Frontend: http://localhost:5173
# - Backend: http://localhost:3000
# - Admin Panel: http://localhost:5173/admin
```

## 🚀 Deployment

### Backend (Serverless Framework)

```bash
cd scraperlab-backend
serverless deploy --stage prod
```

### Frontend (Vite Build)

```bash
cd scraperlab-web
npm run build
# Desplegar carpeta dist/ a S3, Vercel, Netlify, etc.
```

## 📝 Variables de Entorno

### Backend

```bash
AWS_REGION=us-east-1
STAGE=prod
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
COGNITO_DOMAIN=scraperlab-auth.auth.us-east-1.amazoncognito.com
USERS_TABLE_NAME=ScraperLab-Users
PROVIDERS_TABLE_NAME=ScraperLab-Providers
DOMAINS_TABLE_NAME=ScraperLab-Domains
PROCESS_TABLE_NAME=ScraperLab-Process
```

### Frontend

```bash
VITE_API_URL=https://api.scraperlab.com.co
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es privado y propietario de ScraperLab.

## 👥 Autores

- **ScraperLab Team** - Desarrollo inicial

## 🆘 Soporte

Para soporte, contactar a: support@scraperlab.com.co

## 📌 Roadmap

- [ ] Multi-factor authentication (MFA)
- [ ] Auditoría de logs de acceso
- [ ] Webhooks para eventos
- [ ] Rate limiting por usuario/API key
- [ ] Dashboard de uso para usuarios
- [ ] Notificaciones por email
- [ ] Integración con más OAuth providers
