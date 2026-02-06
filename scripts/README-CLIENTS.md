# ScraperLab Clients - Guía de Configuración

Esta guía te ayudará a configurar y gestionar la funcionalidad de **Clientes** en ScraperLab.

## 📋 Tabla de Contenidos

- [¿Qué son los Clientes?](#qué-son-los-clientes)
- [Configuración Inicial](#configuración-inicial)
- [Estructura de un Cliente](#estructura-de-un-cliente)
- [Scripts Disponibles](#scripts-disponibles)
- [Gestión desde la UI](#gestión-desde-la-ui)
- [Ejemplos de Uso](#ejemplos-de-uso)

## ¿Qué son los Clientes?

Los **Clientes** en ScraperLab son entidades que agrupan usuarios y configuraciones específicas para diferentes tipos de operaciones de scraping. Permiten:

- Organizar usuarios por proyecto o empresa
- Configurar diferentes tipos de scraping (CSV, Product Monitoring, etc.)
- Controlar accesos y permisos
- Definir configuraciones de entrada/salida personalizadas
- Programar tareas automáticas

## Configuración Inicial

### 1. Crear la tabla en DynamoDB

```bash
cd scraperlab-backend
node scripts/createClientsTable.js
```

Este comando creará la tabla `ScraperLab-Clients` con:
- Partition Key: `clientId` (String)
- Billing Mode: PAY_PER_REQUEST

### 2. Inicializar clientes de ejemplo

```bash
node scripts/initializeClients.js
```

Esto creará dos clientes de ejemplo:
- **demo**: Cliente de prueba para CSV scraping
- **scraperlab**: Cliente interno para operaciones generales

### 3. Desplegar el backend

```bash
serverless deploy
```

O si estás en desarrollo local:

```bash
npm run dev
```

## Estructura de un Cliente

```javascript
{
  clientId: 'oferty',                    // ID único del cliente
  clientName: 'Oferty',                  // Nombre descriptivo
  clientType: 'product_monitoring',      // Tipo: 'product_monitoring' | 'csv_scraping'
  
  allowedUsers: [                        // Usuarios autorizados
    'admin@oferty.com',
    'user@oferty.com'
  ],
  
  dataSource: {                          // Configuración de entrada
    type: 'dynamodb',
    config: {
      tableName: 'Oferty-Products',
      queryType: 'product_marketplace'
    }
  },
  
  outputConfig: {                        // Configuración de salida
    type: 'dynamodb',
    tableName: 'Oferty-Products',
    updateStrategy: 'best_price'
  },
  
  scheduleConfig: {                      // Configuración de programación
    enabled: true,
    cronExpression: '0 */6 * * *',
    description: 'Cada 6 horas'
  },
  
  isActive: true,                        // Estado del cliente
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  
  metadata: {                            // Metadatos adicionales
    description: 'Cliente principal',
    version: '1.0'
  }
}
```

## Scripts Disponibles

### createClientsTable.js

Gestiona la tabla de DynamoDB:

```bash
# Crear la tabla
node scripts/createClientsTable.js create

# Ver información de la tabla
node scripts/createClientsTable.js describe

# Eliminar la tabla (CUIDADO!)
node scripts/createClientsTable.js delete-confirmed
```

### initializeClients.js

Gestiona los clientes:

```bash
# Crear clientes de ejemplo
node scripts/initializeClients.js init

# Listar clientes existentes
node scripts/initializeClients.js list

# Eliminar todos los clientes (CUIDADO!)
node scripts/initializeClients.js delete-all-confirmed
```

## Gestión desde la UI

### Acceder a la sección de Clientes

1. Inicia sesión como administrador
2. Ve a la sección **Admin**
3. Click en **Usuarios** en el menú lateral
4. Verás dos tabs: **Usuarios** y **Clientes**

### Crear un Cliente

1. Click en la tab **Clientes**
2. Click en **Nuevo Cliente**
3. Completa el formulario:
   - **Client ID**: Identificador único (ej: `oferty`, `cliente-x`)
   - **Nombre del Cliente**: Nombre descriptivo
   - **Tipo de Cliente**: Product Monitoring o CSV Scraping
   - **Descripción**: Información adicional
   - **Cliente Activo**: Estado inicial
4. Click en **Crear Cliente**

### Asignar Usuarios a un Cliente

1. En la lista de clientes, busca el cliente deseado
2. En la columna **Usuarios**, click en **Agregar usuario**
3. Selecciona el usuario que deseas asignar
4. Click en **Agregar**

### Remover Usuarios de un Cliente

1. En la lista de clientes, busca el cliente deseado
2. En la columna **Usuarios**, encuentra el usuario a remover
3. Click en el ícono **X** junto al email del usuario

## Ejemplos de Uso

### Ejemplo 1: Cliente Oferty

Cliente para monitoreo de productos y actualización de precios:

```javascript
{
  clientId: 'oferty',
  clientName: 'Oferty',
  clientType: 'product_monitoring',
  allowedUsers: [
    'admin@oferty.com',
    'system@oferty.com'
  ],
  dataSource: {
    type: 'dynamodb',
    config: {
      tableName: 'Oferty-Products',
      queryType: 'product_marketplace'
    }
  },
  outputConfig: {
    type: 'dynamodb',
    tableName: 'Oferty-Products',
    updateStrategy: 'best_price'
  },
  scheduleConfig: {
    enabled: true,
    cronExpression: '0 */6 * * *'
  },
  isActive: true
}
```

### Ejemplo 2: Cliente Dichter-Neira

Cliente para scraping desde archivos CSV:

```javascript
{
  clientId: 'dichter-neira',
  clientName: 'Dichter Neira',
  clientType: 'csv_scraping',
  allowedUsers: [
    'user@dichter-neira.com'
  ],
  dataSource: {
    type: 'csv',
    config: {
      acceptedFormats: ['csv', 'txt'],
      maxFileSize: 10485760 // 10 MB
    }
  },
  outputConfig: {
    type: 's3',
    bucket: 'dichter-neira-results',
    format: 'json',
    includeMetadata: true
  },
  scheduleConfig: {
    enabled: false
  },
  isActive: true
}
```

## API Endpoints

### GET /api/clients
Obtener todos los clientes

### GET /api/clients/:clientId
Obtener un cliente específico

### POST /api/clients
Crear un nuevo cliente

### PUT /api/clients/:clientId
Actualizar un cliente

### DELETE /api/clients/:clientId
Eliminar un cliente

### POST /api/clients/:clientId/users
Agregar usuario a un cliente

### DELETE /api/clients/:clientId/users/:userEmail
Remover usuario de un cliente

### PUT /api/clients/:clientId/toggle
Cambiar estado activo/inactivo

## Permisos

Todas las operaciones con clientes requieren:
- JWT válido
- Rol de **admin**

## Solución de Problemas

### Error: Tabla no existe

```bash
node scripts/createClientsTable.js create
```

### Error: No se pueden agregar usuarios

Verifica que:
1. El usuario existe en la tabla `ScraperLab-Users`
2. El email es correcto
3. El usuario no está ya asignado al cliente

### Error: No puedo ver la sección de Clientes

Verifica que:
1. Estás autenticado como admin
2. El backend está desplegado con la última versión
3. La variable de entorno `CLIENTS_TABLE_NAME` está configurada

## Variables de Entorno

Asegúrate de tener estas variables en tu `.env`:

```bash
CLIENTS_TABLE_NAME=ScraperLab-Clients
AWS_REGION=us-east-1
```

## Siguientes Pasos

- [ ] Implementar filtros de clientes por usuario en operaciones de scraping
- [ ] Agregar métricas y estadísticas por cliente
- [ ] Implementar límites de uso por cliente
- [ ] Agregar webhooks para notificaciones por cliente
