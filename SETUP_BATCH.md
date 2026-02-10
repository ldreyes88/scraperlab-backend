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

Frontend (selecciona cliente + CSV)
  → batch-process /batch/upload-csv
    → CSVProcessorService (parsea + sube a S3)
    → BatchOrchestratorService (crea proceso + envía a SQS)
      → sqsWorker (consume de SQS, scrape cada URL)
        → scraperlab-backend API (/api/scrape)
          → Resultado guardado en ScraperLab-Process-Detail
