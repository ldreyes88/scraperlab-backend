# Plan: Nodo de Scraping Residencial (Windows)

Este plan detalla cómo sustituir el uso de ScraperAPI por un nodo doméstico en Windows, aprovechando una conexión residencial real para evitar bloqueos en sitios como Mercado Libre.

## User Review Required

> [!IMPORTANT]
> **Conectividad:** Se requiere la instalación de **Tailscale** en el PC de Windows y en el servidor de producción. Esto crea una red segura (Mesh VPN) sin necesidad de abrir puertos en el router.

> [!WARNING]
> **Persistencia:** El PC en Windows debe estar configurado para "Nunca Dormir" (Never Sleep) o usar herramientas como `Coffee.exe` o `PowerToys Awake` para asegurar disponibilidad 24/7.

## Cambios Propuestos

### 1. [NUEVO] Componente: Home Scraper Node (Windows)
Este servicio correrá en tu PC de casa y será el encargado de navegar por las webs.

#### [NEW] `scraper-node/server.js` (Estructura Sugerida)
Un servidor Express que expone un endpoint `/fetch`.
- **Motor:** Playwright con `playwright-extra-plugin-stealth`.
- **Evasión:** Rotación de User-Agents y emulación de hardware real.
- **Salida:** Retorna el HTML puro (o capturas de pantalla si es necesario).

### 2. [MODIFICAR] Componente: scraperlab-backend (Producción)
Actualizar los servicios que hoy usan ScraperAPI para que apunten al nodo residencial.

#### [MODIFY] Estrategia de Dominios (ej. `mercadolibre.com.co.md`)
- Cambiar el proveedor de `scraperapi` a `home-node`.
- Ajustar la lógica de peticiones para usar la IP privada de Tailscale.

## Flujo de Trabajo (Workflow)

1. **Paso 1 (Red):** Instalar Tailscale en ambos extremos y verificar ping.
2. **Paso 2 (Windows):** Clonar/Crear el servicio de Node.js en Windows e instalar Playwright.
3. **Paso 3 (Producción):** Implementar un "Fallback": Si el nodo residencial no responde, usar ScraperAPI como respaldo.

## Open Questions

> [!CAUTION]
> **Volumen de Datos:** ¿Cuántas peticiones estimas hacer al día? Si el volumen es muy alto (>10,000 requests/día), tu ISP (Claro, Tigo, Movistar, etc.) podría marcar el tráfico como inusual.

1. **¿Prefieres que el servidor de Windows use Docker o Node.js directo?** (Node.js directo suele ser más fácil para manejar Playwright en Windows).
2. **¿Quieres autenticación simple (API Key)?** Aunque Tailscale ya es seguro, siempre es bueno que el servidor de Windows pida un "token" para procesar la petición.

## Plan de Verificación

### Pruebas Automatizadas
- `curl -X POST http://[IP-WINDOWS]:3000/fetch -d "url=https://www.google.com"`
- Validar que el HTML contenga los elementos esperados.

### Verificación Manual
- Realizar un scrapeo de Mercado Libre desde la Mac (usando la IP del Windows) y confirmar que no sale un CAPTCHA.
- Verificar que el PC de Windows se mantiene estable después de 1 hora de uso.
