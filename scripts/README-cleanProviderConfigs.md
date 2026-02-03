# Script de Limpieza de Provider Configs

## Propósito

Este script limpia los `providerConfig` de los dominios existentes en la base de datos, removiendo valores por defecto antiguos que ahora son opcionales.

## Problema que Resuelve

Anteriormente, el sistema guardaba valores por defecto en `providerConfig` como:
- `render: true`
- `premium: false`
- `country_code: "us"`
- `device_type: "desktop"`
- `keep_headers: false`

Estos valores ahora deberían ser completamente opcionales. Si no están configurados explícitamente, no deberían existir en la configuración.

## Qué Hace el Script

1. Lee todos los dominios de la base de datos
2. Para cada dominio, limpia su `providerConfig`:
   - Remueve campos vacíos (`""`, `null`, `undefined`)
   - Remueve valores que eran defaults antiguos:
     - `country_code: ""` o `country_code: "us"`
     - `device_type: "desktop"`
     - `render: true`
     - `premium: false`
     - `keep_headers: false`
     - `wait: 0`
3. Actualiza los dominios en la base de datos
4. Muestra un reporte de cambios

## Cómo Ejecutar

### Desde el directorio del backend:

```bash
cd scraperlab-backend
node scripts/cleanProviderConfigs.js
```

## Ejemplo de Output

```
🔍 Obteniendo todos los dominios...
✅ Se encontraron 3 dominios

📝 Actualizando: pequenomundo.com
   Antes: {
     "country_code": "",
     "device_type": "desktop",
     "premium": false,
     "render": true,
     "keep_headers": false
   }
   Después: {}

✓ example.com - Ya está limpio

==================================================
✅ Migración completada
   - Actualizados: 1
   - Sin cambios: 2
   - Total: 3
==================================================

✨ Script completado exitosamente
```

## Resultado Esperado

Después de ejecutar el script:

### Antes (Base de Datos):
```json
{
  "domainId": "pequenomundo.com",
  "providerId": "scraperapi",
  "providerConfig": {
    "country_code": "",
    "device_type": "desktop",
    "premium": false,
    "render": true,
    "keep_headers": false
  }
}
```

### Después (Base de Datos):
```json
{
  "domainId": "pequenomundo.com",
  "providerId": "scraperapi",
  "providerConfig": {}
}
```

### En el Frontend:
- Los checkboxes aparecerán **desmarcados** (no configurados)
- Al hacer scraping, NO se enviarán parámetros adicionales al provider
- Solo se enviará `api_key` y `url`

## Valores que SÍ se Mantienen

El script solo remueve valores por defecto. Si tienes valores configurados explícitamente que NO son defaults, se mantienen:

**Se mantienen:**
- `render: false` (porque false no es el default antiguo)
- `premium: true` (porque true no es el default antiguo)
- `country_code: "co"` (porque "co" no es el default antiguo)
- `device_type: "mobile"` (porque "mobile" no es el default)
- `wait: 5000` (porque 5000 no es 0)
- `wait_for_selector: ".price"` (porque no está vacío)

## Seguridad

- El script es **idempotente**: puedes ejecutarlo múltiples veces sin problemas
- No elimina dominios, solo limpia sus `providerConfig`
- Hace backup implícito en DynamoDB (versionado automático si está habilitado)
- Muestra los cambios antes de aplicarlos

## Verificación Post-Migración

Después de ejecutar el script:

1. **En el Frontend** (`/admin/domains`):
   - Abre la configuración de un dominio
   - Verifica que los checkboxes de los atributos estén desmarcados
   - Los únicos marcados deberían ser los que configuraste explícitamente

2. **Al hacer Scraping**:
   - Revisa los logs del backend
   - Deberías ver: `[ScraperAPI] providerConfig recibido: {}`
   - Y los parámetros enviados solo deberían ser `api_key` y `url`

## Troubleshooting

### Error: "Cannot find module"
```bash
# Asegúrate de estar en el directorio correcto
cd scraperlab-backend

# Instala dependencias si es necesario
npm install
```

### Error: "SCRAPER_API_KEY no configurado"
```bash
# Asegúrate de tener el archivo .env con las variables de entorno
cp .env.example .env
# Edita .env y agrega tus credenciales
```

### No ve cambios en el frontend
```bash
# Limpia la caché del navegador
# O usa Ctrl+Shift+R (o Cmd+Shift+R en Mac) para recargar sin caché
```

## Próximos Pasos

Una vez ejecutado el script:

1. ✅ Los dominios existentes estarán limpios
2. ✅ El frontend mostrará correctamente los checkboxes desmarcados
3. ✅ Solo se enviarán al provider los parámetros que configures explícitamente
4. ✅ Ahorrarás costos al no usar parámetros premium innecesarios
