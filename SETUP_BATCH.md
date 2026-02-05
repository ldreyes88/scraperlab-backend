# Setup: Batch Processing & Process-Detail Table

## Resumen

Este documento describe los pasos necesarios para configurar la funcionalidad de procesamiento en batch (archivos CSV) y la nueva tabla `Process-Detail` en DynamoDB.

## Cambios Implementados

### Backend

1. **Nueva tabla DynamoDB**: `ScraperLab-Process-Detail`
2. **Nuevos campos en tabla Process**: `processType`, `userId`, `userEmail`, `totalUrls`, `successCount`, `failedCount`, `status`
3. **Nuevos repositorios y servicios**: ProcessDetailRepository, métodos batch en ProcessService
4. **Nuevos endpoints**:
   - `POST /api/scrape/batch/create` - Crear proceso batch
   - `GET /api/process/:processId/details` - Obtener detalles de batch

### Frontend

1. **Refactorización de Process.jsx**: Ahora con sistema de tabs
2. **Nuevos componentes**:
   - `ProcessesTable.jsx` - Tabla de procesos con columnas de tipo y usuario
   - `BatchManagement.jsx` - Gestión de batches con upload CSV
   - `BatchDetailsModal.jsx` - Modal para ver detalles paginados
3. **Nueva dependencia**: `papaparse` para parsing CSV

## Pasos de Instalación

### 1. Crear tabla DynamoDB

Ejecutar el script de creación de tabla:

```bash
cd scraperlab-backend
node createProcessDetailTable.js
```

El script creará la tabla `ScraperLab-Process-Detail` con:
- **Partition Key**: `detailId` (String)
- **GSI**: `processId-timestamp-index` 
  - Partition Key: `processId` (String)
  - Sort Key: `timestamp` (String)

### 2. Actualizar variables de entorno

Agregar en tu archivo `.env` del backend:

```bash
PROCESS_DETAIL_TABLE_NAME=ScraperLab-Process-Detail
```

### 3. Instalar dependencias frontend

```bash
cd scraperlab-web
npm install papaparse
```

### 4. Desplegar cambios

**Backend:**
```bash
cd scraperlab-backend
serverless deploy
```

**Frontend:**
```bash
cd scraperlab-web
npm run build
# Desplegar según tu estrategia (S3, Vercel, etc.)
```

## Uso

### 1. Procesamiento Batch desde UI

1. Ir a la página "Gestión de Procesos"
2. Seleccionar tab "Gestión Batch"
3. Subir archivo CSV con formato:
   ```csv
   url,scrapeType
   https://example.com/product1,detail
   https://example.com/search?q=term,search
   ```
4. Hacer click en "Procesar Batch"
5. Ver progreso en la lista de batches recientes

### 2. Procesamiento Batch desde API

```bash
curl -X POST https://api.scraperlab.com/api/scrape/batch/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {"url": "https://example.com/product1", "scrapeType": "detail"},
      {"url": "https://example.com/product2", "scrapeType": "detail"}
    ]
  }'
```

### 3. Ver detalles de un Batch

En la UI:
1. En la tabla de procesos, hacer click en cualquier proceso tipo "Batch"
2. Se abrirá un modal con todos los detalles paginados
3. Puedes filtrar por éxito/error
4. Exportar resultados a CSV

Por API:
```bash
curl -X GET https://api.scraperlab.com/api/process/PROCESS_ID/details?page=1&limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Formato CSV

El archivo CSV debe tener al menos una columna `url`. Opcionalmente puede incluir `scrapeType`:

**Formato mínimo:**
```csv
url
https://example.com/product1
https://example.com/product2
```

**Formato completo:**
```csv
url,scrapeType
https://example.com/product1,detail
https://example.com/search?q=laptop,search
https://example.com/category/electronics,searchSpecific
```

**Tipos de scraping válidos:**
- `detail` (default) - Página de detalle de producto
- `search` - Página de búsqueda
- `searchSpecific` - Búsqueda específica

**Límites:**
- Máximo 1000 URLs por batch
- El procesamiento es asíncrono

## Estructura de Datos

### Tabla Process (actualizada)

```javascript
{
  logId: "uuid",              // PK
  processId: "uuid",          // Alias de logId
  processType: "simple|batch", // NUEVO
  userId: "user-id",          // NUEVO
  userEmail: "user@email.com", // NUEVO
  
  // Para procesos simples:
  url: "https://...",
  domainId: "example.com",
  success: true,
  
  // Para batches:
  totalUrls: 100,            // NUEVO
  successCount: 95,          // NUEVO
  failedCount: 5,            // NUEVO
  status: "completed",       // NUEVO: pending|processing|completed|failed
  
  timestamp: "2024-01-01T00:00:00.000Z",
  ttl: 1234567890
}
```

### Tabla Process-Detail (nueva)

```javascript
{
  detailId: "uuid",           // PK
  processId: "uuid",          // FK a Process, GSI
  url: "https://...",
  domainId: "example.com",
  scraperProvider: "ScraperAPI",
  scrapeType: "detail",
  success: true,
  responseTime: 1234,
  error: "...",               // Si falla
  data: {...},                // Resultado del scraping
  timestamp: "2024-01-01T00:00:00.000Z",
  ttl: 1234567890
}
```

## Migración de Datos Existentes

Los procesos existentes en la tabla Process seguirán funcionando normalmente. Se les asignará automáticamente:
- `processType: 'simple'`
- `userId: null` (hasta que el usuario haga una nueva consulta autenticado)

No se requiere migración de datos.

## Troubleshooting

### Error: "Table not found"

Asegúrate de que la tabla `ScraperLab-Process-Detail` existe en DynamoDB:
```bash
aws dynamodb describe-table --table-name ScraperLab-Process-Detail
```

### Error al parsear CSV

El archivo CSV debe:
- Usar codificación UTF-8
- Tener headers en la primera línea
- Incluir al menos la columna `url`

### Batch no se procesa

Verifica los logs de Lambda:
```bash
serverless logs -f api --tail
```

## Próximos Pasos

- [ ] Integrar con AWS SQS para procesamiento de colas
- [ ] Agregar notificaciones cuando un batch termine
- [ ] Implementar reintentos automáticos para URLs fallidas
- [ ] Dashboard de estadísticas por batch

## Soporte

Para reportar issues o sugerencias, contactar al equipo de desarrollo.
