# Configuración de Google OAuth para ScraperLab

## 1. Crear Proyecto en Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear nuevo proyecto o seleccionar uno existente
3. Nombre del proyecto: `ScraperLab`

## 2. Habilitar Google+ API

1. En el menú lateral, ir a **APIs & Services** → **Library**
2. Buscar "Google+ API"
3. Click en **Enable**

## 3. Configurar OAuth Consent Screen

1. Ir a **APIs & Services** → **OAuth consent screen**
2. Seleccionar tipo de usuario:
   - **Internal**: Solo para usuarios de tu organización (Google Workspace)
   - **External**: Para cualquier usuario con cuenta de Google (recomendado)
3. Completar información requerida:
   - **App name**: ScraperLab
   - **User support email**: tu@email.com
   - **App logo**: (opcional) Logo de ScraperLab
   - **App domain**: scraperlab.com.co
   - **Authorized domains**: scraperlab.com.co
   - **Developer contact**: tu@email.com
4. Click en **Save and Continue**

### Scopes (Permisos)

5. En la sección **Scopes**, agregar los siguientes permisos:
   - `openid`
   - `profile`
   - `email`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. Click en **Save and Continue**

### Test Users (solo si es External en modo Testing)

7. Agregar usuarios de prueba si estás en modo Testing
8. Click en **Save and Continue**

## 4. Crear OAuth 2.0 Client ID

1. Ir a **APIs & Services** → **Credentials**
2. Click en **+ Create Credentials** → **OAuth client ID**
3. Seleccionar **Application type**: Web application
4. Configurar:
   - **Name**: ScraperLab Web Client
   - **Authorized JavaScript origins**:
     ```
     https://scraperlab.com.co
     http://localhost:5173
     ```
   - **Authorized redirect URIs**:
     ```
     https://scraperlab-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
     https://scraperlab.com.co/callback
     http://localhost:5173/callback
     ```
5. Click en **Create**

## 5. Guardar Credenciales

Después de crear, Google te mostrará:
- **Client ID**: xxxxx.apps.googleusercontent.com
- **Client Secret**: GOCSPX-xxxxx

**⚠️ IMPORTANTE**: Copia y guarda estas credenciales de forma segura.

## 6. Integrar con AWS Cognito

### Opción A: AWS CLI

```bash
aws cognito-idp create-identity-provider \
  --user-pool-id us-east-1_XXXXXXXXX \
  --provider-name Google \
  --provider-type Google \
  --provider-details '{
    "client_id": "TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "TU_GOOGLE_CLIENT_SECRET",
    "authorize_scopes": "openid email profile"
  }' \
  --attribute-mapping '{
    "email": "email",
    "name": "name",
    "username": "sub"
  }' \
  --region us-east-1
```

### Opción B: AWS Console

1. Ir a [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Seleccionar tu User Pool: `ScraperLabUserPool`
3. Ir a **Sign-in experience** → **Federated identity provider sign-in**
4. Click en **Add identity provider**
5. Seleccionar **Google**
6. Ingresar:
   - **Client ID**: tu Client ID de Google
   - **Client secret**: tu Client Secret de Google
   - **Authorized scopes**: `openid email profile`
7. **Attribute mapping**:
   - Cognito attribute `email` → Google attribute `email`
   - Cognito attribute `name` → Google attribute `name`
   - Cognito attribute `username` → Google attribute `sub`
8. Click en **Add identity provider**

## 7. Actualizar App Client en Cognito

1. En tu User Pool, ir a **App integration** → **App client list**
2. Seleccionar tu App Client: `ScraperLabWebClient`
3. Editar **Hosted UI settings**
4. En **Identity providers**, seleccionar:
   - ✅ Cognito User Pool
   - ✅ Google
5. Guardar cambios

## 8. Variables de Entorno

Agregar al archivo `.env` del backend:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

## 9. Testing

### URL de Login con Google

```
https://scraperlab-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize?client_id=YOUR_COGNITO_CLIENT_ID&response_type=code&scope=openid+email+profile&redirect_uri=http://localhost:5173/callback&identity_provider=Google
```

### Flujo de prueba:

1. Usuario hace click en "Continuar con Google" en `/login`
2. Frontend llama a `GET /api/auth/oauth/url?provider=Google&redirectUri=http://localhost:5173/callback`
3. Backend retorna la URL de OAuth de Cognito
4. Frontend redirige a esa URL
5. Usuario es redirigido a Google para autenticarse
6. Google redirige a Cognito con código de autorización
7. Cognito redirige a `/callback?code=XXXX`
8. Frontend llama a `POST /api/auth/oauth/callback` con el código
9. Backend intercambia código por tokens de Cognito
10. Usuario autenticado exitosamente

## 10. Troubleshooting

### Error: "redirect_uri_mismatch"

- Verificar que la redirect URI en Google Cloud Console coincida exactamente con la configurada en Cognito
- Las URIs son case-sensitive y deben incluir el protocolo (http/https)

### Error: "invalid_client"

- Verificar que el Client ID y Client Secret sean correctos
- Verificar que el Identity Provider esté habilitado en Cognito

### Error: "access_denied"

- Usuario canceló el login en Google
- Usuario no tiene permisos (si el app está en modo Internal)
- Verificar que los scopes solicitados sean los configurados

## 11. Publicar App (Opcional)

Si tu app es External y está en modo Testing, necesitarás publicarla:

1. En Google Cloud Console → **OAuth consent screen**
2. Click en **Publish App**
3. Completar el proceso de verificación de Google (puede tomar días)

Para desarrollo, puedes mantenerla en modo Testing y agregar usuarios de prueba.

## Referencias

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [AWS Cognito - Google Federation](https://docs.aws.amazon.com/cognito/latest/developerguide/google.html)
