# Configuración de Microsoft OAuth para ScraperLab

## 1. Crear App Registration en Azure Portal

1. Ir a [Azure Portal](https://portal.azure.com/)
2. Buscar "Azure Active Directory" o "Microsoft Entra ID"
3. En el menú lateral, ir a **App registrations**
4. Click en **+ New registration**

## 2. Configurar App Registration

### Basic Information

- **Name**: ScraperLab
- **Supported account types**: Seleccionar según necesidad:
  - **Single tenant**: Solo usuarios de tu organización
  - **Multitenant**: Usuarios de cualquier organización Azure AD
  - **Multitenant and personal Microsoft accounts**: Cualquier usuario (recomendado)
  - **Personal Microsoft accounts only**: Solo cuentas personales

### Redirect URI

- **Platform**: Web
- **Redirect URI**:
  ```
  https://scraperlab-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
  ```

3. Click en **Register**

## 3. Configurar Redirect URIs Adicionales

1. Una vez creada la app, ir a **Authentication** en el menú lateral
2. En la sección **Web** → **Redirect URIs**, agregar:
   ```
   https://scraperlab.com.co/callback
   http://localhost:5173/callback
   ```
3. En **Front-channel logout URL** (opcional):
   ```
   https://scraperlab.com.co/logout
   ```
4. Click en **Save**

## 4. Configurar Permisos (API Permissions)

1. En el menú lateral, ir a **API permissions**
2. Click en **+ Add a permission**
3. Seleccionar **Microsoft Graph**
4. Seleccionar **Delegated permissions**
5. Agregar los siguientes permisos:
   - `openid`
   - `email`
   - `profile`
   - `User.Read`
6. Click en **Add permissions**
7. (Opcional) Click en **Grant admin consent for [tu organización]** si tienes permisos de admin

## 5. Crear Client Secret

1. En el menú lateral, ir a **Certificates & secrets**
2. En la tab **Client secrets**, click en **+ New client secret**
3. Configurar:
   - **Description**: ScraperLab Production
   - **Expires**: Seleccionar duración (recomendado: 24 months)
4. Click en **Add**
5. **⚠️ IMPORTANTE**: Copia el **Value** del secret INMEDIATAMENTE
   - Este valor solo se muestra una vez
   - Si lo pierdes, tendrás que crear uno nuevo

## 6. Obtener Application (Client) ID y Tenant ID

1. En **Overview** de tu App Registration, encontrarás:
   - **Application (client) ID**: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   - **Directory (tenant) ID**: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

**Para multitenant apps**, usar `common` en lugar del Tenant ID específico.

## 7. Integrar con AWS Cognito

### Opción A: AWS CLI

```bash
aws cognito-idp create-identity-provider \
  --user-pool-id us-east-1_XXXXXXXXX \
  --provider-name Microsoft \
  --provider-type OIDC \
  --provider-details '{
    "client_id": "TU_MICROSOFT_CLIENT_ID",
    "client_secret": "TU_MICROSOFT_CLIENT_SECRET",
    "authorize_scopes": "openid email profile",
    "oidc_issuer": "https://login.microsoftonline.com/common/v2.0",
    "attributes_request_method": "GET"
  }' \
  --attribute-mapping '{
    "email": "email",
    "name": "name",
    "username": "sub"
  }' \
  --region us-east-1
```

**Nota sobre `oidc_issuer`:**
- Para multitenant: `https://login.microsoftonline.com/common/v2.0`
- Para single tenant: `https://login.microsoftonline.com/{TENANT_ID}/v2.0`
- Para solo cuentas personales: `https://login.microsoftonline.com/consumers/v2.0`

### Opción B: AWS Console

1. Ir a [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Seleccionar tu User Pool: `ScraperLabUserPool`
3. Ir a **Sign-in experience** → **Federated identity provider sign-in**
4. Click en **Add identity provider**
5. Seleccionar **OpenID Connect (OIDC)**
6. Configurar:
   - **Provider name**: Microsoft
   - **Client ID**: tu Application (client) ID de Azure
   - **Client secret**: tu Client Secret de Azure
   - **Authorized scopes**: `openid email profile`
   - **Issuer URL**: `https://login.microsoftonline.com/common/v2.0`
   - **Attributes request method**: GET
7. **Attribute mapping**:
   - Cognito attribute `email` → OIDC attribute `email`
   - Cognito attribute `name` → OIDC attribute `name`
   - Cognito attribute `username` → OIDC attribute `sub`
8. Click en **Create provider**

## 8. Actualizar App Client en Cognito

1. En tu User Pool, ir a **App integration** → **App client list**
2. Seleccionar tu App Client: `ScraperLabWebClient`
3. Editar **Hosted UI settings**
4. En **Identity providers**, seleccionar:
   - ✅ Cognito User Pool
   - ✅ Microsoft
5. Guardar cambios

## 9. Variables de Entorno

Agregar al archivo `.env` del backend:

```bash
# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=tu-client-secret-aqui
MICROSOFT_TENANT_ID=common  # o tu tenant ID específico
```

## 10. Testing

### URL de Login con Microsoft

```
https://scraperlab-auth.auth.us-east-1.amazoncognito.com/oauth2/authorize?client_id=YOUR_COGNITO_CLIENT_ID&response_type=code&scope=openid+email+profile&redirect_uri=http://localhost:5173/callback&identity_provider=Microsoft
```

### Flujo de prueba:

1. Usuario hace click en "Continuar con Microsoft" en `/login`
2. Frontend llama a `GET /api/auth/oauth/url?provider=Microsoft&redirectUri=http://localhost:5173/callback`
3. Backend retorna la URL de OAuth de Cognito
4. Frontend redirige a esa URL
5. Usuario es redirigido a Microsoft para autenticarse
6. Microsoft redirige a Cognito con código de autorización
7. Cognito redirige a `/callback?code=XXXX`
8. Frontend llama a `POST /api/auth/oauth/callback` con el código
9. Backend intercambia código por tokens de Cognito
10. Usuario autenticado exitosamente

## 11. Troubleshooting

### Error: "AADSTS50011: The redirect URI specified does not match"

- Verificar que la redirect URI en Azure coincida exactamente con la configurada en Cognito
- Las URIs son case-sensitive y deben incluir el protocolo (http/https)

### Error: "AADSTS65005: Invalid resource"

- Verificar que los scopes solicitados sean válidos
- Verificar que los permisos estén configurados en Azure AD

### Error: "AADSTS7000218: The request body must contain the following parameter: 'client_assertion'"

- Verificar que el Client Secret sea correcto
- Verificar que no haya expirado el Client Secret

### Error: "AADSTS50105: User not assigned to a role"

- Solo aplica para apps con asignación de usuarios requerida
- Ir a **Enterprise Applications** en Azure AD
- Buscar tu app y asignar usuarios/grupos

## 12. Configuración Avanzada (Opcional)

### Asignación de Usuarios

1. Ir a **Azure Active Directory** → **Enterprise applications**
2. Buscar "ScraperLab"
3. Ir a **Properties**
4. **Assignment required**: Yes/No
   - **Yes**: Solo usuarios asignados pueden acceder
   - **No**: Cualquier usuario del tenant puede acceder
5. Para asignar usuarios, ir a **Users and groups** → **Add user/group**

### Custom Claims

1. En **App registrations** → tu app → **Token configuration**
2. Click en **Add optional claim**
3. Seleccionar tipo de token (ID, Access, SAML)
4. Agregar claims adicionales según necesidad

## 13. Renovar Client Secret

Antes de que expire tu Client Secret (recibirás notificaciones por email):

1. Ir a **Certificates & secrets**
2. Crear un nuevo Client Secret
3. Actualizar la variable de entorno con el nuevo secret
4. Actualizar la configuración en Cognito
5. Una vez verificado que funciona, eliminar el secret antiguo

## Referencias

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [AWS Cognito - OIDC Identity Providers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-idp.html)
- [Microsoft Graph API Permissions](https://docs.microsoft.com/en-us/graph/permissions-reference)
