# Resumen: Implementación del Pipeline "Monitor Supernotariado"

Este documento resume todos los cambios, mejoras y resolución de problemas realizados durante la creación del pipeline de monitoreo para la Superintendencia de Notariado y Registro.

## 1. El Objetivo
Crear un pipeline (`monitor-supernotariado`) que reciba un número de turno, consulte la API pública del Supernotariado, extraiga los datos del trámite y envíe una notificación enriquecida a Telegram.

## 2. Mejoras en el Backend (Core & Estrategias)

### A. Nueva Estrategia: `DirectAPIStrategy` (Costo $0)
Se creó e implementó un nuevo proveedor (`providerId: 'api'`) diseñado para hacer peticiones directas sin pasar por proxies costosos.
*   **Bypass de SSL:** El portal del Supernotariado tiene un certificado SSL mal configurado. Modificamos `BaseStrategy.js` y `DirectAPIStrategy.js` para inyectar un `httpsAgent` con `rejectUnauthorized: false`, permitiendo que Axios ignore el error de certificado y logre la conexión.
*   **Parseo Automático de JSON:** Se mejoró `DirectAPIStrategy` para que, si detecta una respuesta JSON, utilice la configuración de mapeo del dominio (`jsonPath`) para asignar las llaves originales (ej. `entidad`) a las variables estándar del sistema (`title`) y agrupar el resto en variables adicionales.
*   **Estructura Compatible:** Se ajustó la respuesta final de la estrategia para encapsular los datos dentro de un objeto `details`. Esto garantiza la compatibilidad con las rutas que espera el motor del pipeline (ej. `.data.details.ciudad`).

### B. Motor del Pipeline (`PipelineService.js`)
*   **Resolución Recursiva de Variables:** El nodo `API_REQUEST` (usado para notificar a Telegram) enviaba el cuerpo del mensaje (JSON) sin procesar las variables como `{{nodes.scrape-api.data.details.title}}`. Se actualizó `resolveTemplate()` para que recorra de manera recursiva objetos y arrays, reemplazando las variables correctamente en cualquier nivel de profundidad.
*   **Detección de Éxito Mejorada:** Se ajustó la lógica en la ejecución de los nodos para que valide no solo si el servicio de scraping finalizó sin errores de red, sino también si la extracción interna fue exitosa (`data.success !== false`), evitando "falsos positivos" de ejecución en caso de fallo en el parseo.
*   **Retorno Completo del Nodo:** Se corrigió `handleScrapeDetail` para que devuelva el objeto completo del resultado (en lugar de solo la propiedad `.data`), permitiendo que el motor identifique correctamente la bandera `success`.

### C. Automatización de Configuración
*   Se actualizó el script `scripts/seed_supernotariado.js` para que registre automáticamente el Provider `api` en DynamoDB antes de crear el Dominio y el Pipeline, resolviendo el error de "Provider api no encontrado".

## 3. Mejoras en el Frontend (UX/UI)

### A. Nuevo Modal Inteligente (`RunPipelineModal.jsx`)
*   Se eliminó el feo `window.prompt` nativo del navegador.
*   Se creó un modal estético y premium que lee el primer nodo (`TRIGGER`) del pipeline y detecta automáticamente qué parámetro necesita pedir al usuario (ej. `turno` para Supernotariado, o `productName` para otros).
*   Ofrece ejemplos de valores rápidos y un toggle para introducir JSON avanzado si se desea.

### B. Consola de Ejecución en Tiempo Real (`ExecutionConsole.jsx`)
*   Se creó una consola que hace polling (cada 2 segundos) para mostrar el progreso de los nodos del pipeline paso a paso.
*   **Inspección de Errores:** Se añadió una sección expandible de "Ver Log Técnico" para visualizar el error crudo si un nodo falla.
*   **Inspección de Datos:** Se implementó una vista para examinar el JSON real extraído por un nodo (`output`) cuando este es exitoso, facilitando mucho el debugging y mapeo de variables.

## 4. Estado Actual
*   El pipeline puede llegar al portal, saltar la restricción SSL, y obtener los datos en crudo (JSON).
*   Telegram está conectado exitosamente (tras iniciar el chat con el bot) y recibe peticiones.
*   **Falta/Pendiente:** Si bien el sistema ya recibe el JSON del Supernotariado, las etiquetas en Telegram no se están traduciendo correctamente debido a desajustes finales entre los nombres de las llaves del JSON crudo y el `jsonPath` que configuramos. Con la consola de ejecución en el frontend y el log de `output`, es cuestión de ajustar las llaves de acceso para que cuadren.  
