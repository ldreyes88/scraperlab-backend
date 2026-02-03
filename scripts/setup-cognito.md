# AWS Cognito Setup - ScraperLab

## 1. Crear User Pool

### Paso 1: Configuración básica
```bash
aws cognito-idp create-user-pool \
  --pool-name ScraperLabUserPool \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --username-attributes email \
  --auto-verified-attributes email \
  --mfa-configuration OPTIONAL \
  --user-attribute-update-settings '{
    "AttributesRequireVerificationBeforeUpdate": ["email"]
  }' \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "name",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "role",
      "AttributeDataType": "String",
      "DeveloperOnlyAttribute": false,
      "Mutable": true,
      "Required": false
    }
  ]' \
  --region us-east-1
```

**Guardar el USER_POOL_ID del output.**

### Paso 2: Crear App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name ScraperLabWebClient \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --supported-identity-providers COGNITO Google Microsoft \
  --callback-urls https://scraperlab.com.co/callback http://localhost:5173/callback \
  --logout-urls https://scraperlab.com.co/logout http://localhost:5173/logout \
  --allowed-o-auth-flows code implicit \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --region us-east-1
```

**Guardar el CLIENT_ID y CLIENT_SECRET del output.**

### Paso 3: Crear Domain

```bash
aws cognito-idp create-user-pool-domain \
  --domain scraperlab-auth \
  --user-pool-id <USER_POOL_ID> \
  --region us-east-1
```

**El domain será: scraperlab-auth.auth.us-east-1.amazoncognito.com**

## 2. Configurar Google OAuth

### Paso 1: Google Cloud Console
1. Ir a https://console.cloud.google.com/
2. Crear proyecto "ScraperLab"
3. Habilitar Google+ API
4. Crear OAuth 2.0 Credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://scraperlab-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
5. Guardar Client ID y Client Secret

### Paso 2: Agregar Google Identity Provider a Cognito

```bash
aws cognito-idp create-identity-provider \
  --user-pool-id <USER_POOL_ID> \
  --provider-name Google \
  --provider-type Google \
  --provider-details '{
    "client_id": "<GOOGLE_CLIENT_ID>",
    "client_secret": "<GOOGLE_CLIENT_SECRET>",
    "authorize_scopes": "openid email profile"
  }' \
  --attribute-mapping '{
    "email": "email",
    "name": "name",
    "username": "sub"
  }' \
  --region us-east-1
```

## 3. Configurar Microsoft OAuth

### Paso 1: Azure AD Portal
1. Ir a https://portal.azure.com/
2. Azure Active Directory → App registrations → New registration
3. Nombre: "ScraperLab"
4. Redirect URI: `https://scraperlab-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
5. API permissions:
   - Microsoft Graph → openid, email, profile
6. Certificates & secrets → New client secret
7. Guardar Application (client) ID y Client Secret

### Paso 2: Agregar Microsoft Identity Provider a Cognito

```bash
aws cognito-idp create-identity-provider \
  --user-pool-id <USER_POOL_ID> \
  --provider-name Microsoft \
  --provider-type OIDC \
  --provider-details '{
    "client_id": "<MICROSOFT_CLIENT_ID>",
    "client_secret": "<MICROSOFT_CLIENT_SECRET>",
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

## 4. Variables de entorno

Agregar al archivo `.env`:

```bash
# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1
COGNITO_DOMAIN=scraperlab-auth.auth.us-east-1.amazoncognito.com

# Google OAuth (opcional, solo para backend si necesitas)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx

# Microsoft OAuth (opcional, solo para backend si necesitas)
MICROSOFT_CLIENT_ID=xxxxx
MICROSOFT_CLIENT_SECRET=xxxxx
```

## 5. Crear primer usuario Admin

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username admin@scraperlab.com.co \
  --user-attributes Name=email,Value=admin@scraperlab.com.co Name=custom:role,Value=admin \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --region us-east-1
```

## 6. Verificación

Para verificar que todo está configurado:

```bash
# Listar User Pools
aws cognito-idp list-user-pools --max-results 10 --region us-east-1

# Ver detalles del User Pool
aws cognito-idp describe-user-pool --user-pool-id <USER_POOL_ID> --region us-east-1

# Listar Identity Providers
aws cognito-idp list-identity-providers --user-pool-id <USER_POOL_ID> --region us-east-1
```

## URLs importantes

- **Hosted UI Login**: `https://scraperlab-auth.auth.us-east-1.amazoncognito.com/login?client_id=<CLIENT_ID>&response_type=code&redirect_uri=https://scraperlab.com.co/callback`
- **Google Login**: Agregar `&identity_provider=Google` a la URL de login
- **Microsoft Login**: Agregar `&identity_provider=Microsoft` a la URL de login

## Notas importantes

1. El atributo `custom:role` se usa para distinguir entre admin, user y api_user
2. Los tokens JWT incluyen este atributo en los claims
3. El refresh token tiene validez de 30 días por defecto
4. El access token tiene validez de 1 hora por defecto
5. Los OAuth providers redirigen automáticamente al callback configurado
