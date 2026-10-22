# Idioma y Tono
- Responde SIEMPRE en Español, a menos que se indique lo contrario.
- Mantén un tono técnico, amigable y profesional. Sé conciso pero exhaustivo en las explicaciones.

# Comportamiento y Autonomía
- Leer solo archivos relevantes para el cambio solicitado.
- **Búsqueda Eficiente:** Antes de navegar manualmente, usa `grep_search` para localizar definiciones de funciones, constantes o rutas específicas. No adivines ubicaciones.
- PRIORIZA la lectura de archivos necesarios para entender el contexto antes de proponer cambios.
- **Mapa de Ruta:** Consulta siempre `package.json` para entender dependencias y scripts antes de sugerir cambios en el entorno.
- **Estructura y Arquitectura:** Para cambios estructurales, refactors o nuevas estrategias/endpoints, consulta siempre `scraperlab-backend-structure.txt` y `scraperlab-backend-arquitecture.txt` para respetar la arquitectura local.
- Realizar cambios puntuales y quirúrgicos en lugar de refactors masivos no pedidos.
- Evitar repetir contexto ya dicho por el usuario.
- No pidas confirmación para comandos de "lectura" o "diagnóstico" (`ls`, `cat`, `grep`, `npm list`, `git status`, `.env`, archivos de texto, etc.) sobre todo si se incluyen en el prompt o chat.
- Solicita aprobación únicamente para comandos que realicen cambios destructivos o de alto impacto (`npm install`, `rm`, `git pull`, etc.).
- Si una solución requiere múltiples pasos, presenta un plan antes de ejecutar el primero.

# Depliegues y Git
- NUNCA realices despliegues a producción por tu cuenta; los despliegues se gestionan exclusivamente mediante GitHub Actions.

# Estándares de Código (Node.js & Express / Lambda)
- Usa JavaScript moderno (ES6+, Node >= 22) y principios de Clean Code.
- Flujo de Arquitectura en Capas:
  - `src/handlers/`: Controladores HTTP, validación de request y formateo de respuestas.
  - `src/services/`: Lógica de negocio y orquestación de operaciones de scraping y procesos.
  - `src/repositories/`: Acceso a datos y operaciones con DynamoDB.
  - `src/strategies/`: Patrón Strategy para proveedores externos (`ScraperAPIStrategy`, `OxylabsStrategy`) y dominios específicos (`BaseDomainStrategy`, `Falabella`, `Exito`, `MercadoLibre`).
  - `src/middleware/`: Manejo global de errores (`errorHandler.js`), CORS y middlewares.
  - `src/utils/`: Helpers reutilizables, formateo estándar (`response.js`) y utilidades de tiempo (`time.js`).
- Mantén el código modular, desacoplado, reutilizable y documentado (JSDoc) donde aporte valor real.

# Manejo de Calidad
- Implementa siempre validaciones de entrada y manejo de errores (try-catch defensivo) con logs limpios e informativos.
- Formateo estándar de respuestas HTTP y códigos de estado adecuados.
- Antes de dar por terminada una tarea, verifica que el código y sintaxis sean válidos y sin errores.
- Al crear o eliminar archivos, mantén actualizados `scraperlab-backend-structure.txt` y `scraperlab-backend-arquitecture.txt`.
