# Especificación Técnica: Configuración de Dominios y Providers

Este documento sirve como la **Fuente de Verdad (Source of Truth)** para la creación y gestión de dominios y providers en ScraperLab. Está diseñado para que cualquier agente de IA pueda entender la estructura de datos y los requisitos necesarios para configurar nuevos servicios.

---

## 1. Providers (Proveedores)

Un Provider es un servicio externo (API o IA) que ejecuta la extracción de datos.

### Estructura del Objeto Provider
| Campo | Tipo | Descripción | Ejemplo |
|:---|:---|:---|:---|
| `providerId` | String | Identificador único (Requerido) | `"scraperapi"`, `"gemini-ai"` |
| `name` | String | Nombre legible | `"ScraperAPI V2"` |
| `description` | String | Descripción del servicio | `"API de scraping con rotación"` |
| `type` | String | `API` (Scraping) o `AI` (Gemini/LLM) | `"API"` |
| `enabled` | Boolean | Estado del provider | `true` |
| `baseUrl` | String | URL base del servicio | `https://api.scraperapi.com` |
| `authType` | String | `api_key`, `bearer`, `basic`, `none` | `"api_key"` |
| `apiKey` | String | Token o llave de acceso | `"YOUR_SECRET_KEY"` |
| `rateLimit` | Object | Límites: `requestsPerSecond`, `maxConcurrent` | `{ "requestsPerSecond": 5 }` |
| `pricing` | Object | `costPerRequest` (Number), `currency` (String) | `{ "costPerRequest": 0.005 }` |
| `configSchema` | Object | **Crucial:** Define qué campos se pueden configurar a nivel de Dominio. | Ver abajo |

### Config Schema del Provider
Define el esquema JSON de los parámetros que el dominio pasará al provider.
```json
{
  "render": {
    "type": "boolean",
    "label": "Renderizar JS",
    "default": true,
    "description": "Activa el renderizado de JS"
  },
  "ultra_premium": {
    "type": "boolean",
    "label": "Proxies Premium",
    "default": false
  }
}
```

---

## 2. Dominios

Un Dominio contiene la lógica específica de extracción para un sitio web o servicio.

### Estructura Base
| Campo | Tipo | Descripción |
|:---|:---|:---|
| `domainId` | String | FQDN del sitio web (ID único) |
| `providerId` | String | ID del provider que usará este dominio |
| `countryCode` | String | Código ISO del país (ej. `CO`, `MX`, `ES`) |
| `enabled` | Boolean | Si el dominio está procesando tareas |
| `typeService` | Array | `["scraping"]` o `["ai"]` |
| `supportedTypes`| Array | Tipos soportados: `detail`, `search`, `searchSpecific` |

### Pipeline y Estrategias
El sistema usa un pipeline modular configurado por estos campos:
- `strategyOrder`: Array que define el orden de ejecución (ej. `["scripts", "jsonLd", "css", "meta", "nextData"]`).
- Flags de activación: `useCss`, `useJsonLd`, `useNextData`, `useMeta`, `useScripts` (todos Boolean).

### Configuración de Extracción (`scraperConfig`)
Los parámetros de extracción se dividen por tipo (`detail`, `search`, `searchSpecific`):

#### Detail / SearchSpecific
Agrupados por estrategia:
```json
"scraperConfig": {
  "detail": {
    "css": { "price": ".price", "title": "h1" },
    "nextData": { "productPath": "props.product" },
    "jsonLd": { "pricePath": "offers.price" },
    "scripts": [
      { "key": "price", "regex": "\"price\":\\s*(\\d+)" }
    ]
  }
}
```

#### Search
```json
"scraperConfig": {
  "search": {
    "containerSelector": ".item",
    "titleSelector": "h2",
    "scripts": []
  }
}
```

### Provider Config
Aquí se pasan los parámetros definidos en el `configSchema` del provider. No pueden definir globalmente :

> [!IMPORTANT]
> **Independencia de Configuración**: Las secciones `detail`, `search` y `searchSpecific` son **independientes**. No heredan automáticamente configuraciones de `detail` a menos que se definan globalmente en la raíz del objeto (fuera de las llaves específicas). Se recomienda definir explícitamente los parámetros por tipo para evitar efectos colaterales.

```json
"providerConfig": {
  "country_code": "co",
  "detail": {
    "device_type": "desktop"
  },
  "search": {
    "render": true,
    "premium": true
  }
}
```
*En este ejemplo, `detail` no envía `render` ni `premium` porque no los necesita para su estrategia (ej. usa JSON-LD). El sistema asume los valores por defecto del proveedor (normalmente `false`).*

> [!TIP]
> **Regla de Oro: Si no se necesita, no se envía.**
> Para mantener las configuraciones limpias y evitar cargos accidentales por servicios premium o renderizado, omite los campos `render`, `premium`, `ultra_premium`, etc., en las secciones donde no sean estrictamente obligatorios. No es necesario ponerlos en `false`; simplemente no los incluyas.

---

## 3. Guía para Agentes de IA: Cómo crear un Dominio

Al crear un nuevo dominio, sigue este "Checklist":

1.  **Identificar el ID:** Debe ser el dominio base (ej. `exito.com`).
2.  **Elegir Provider:** Seleccionar uno existente (ej. `scraperapi`).
3.  **Analizar Estrategias:**
    *   Si el sitio tiene `__NEXT_DATA__` en el HTML, prioriza `nextData`.
    *   Si tiene JSON-LD, configúralo como prioridad 1 o 2.
    *   Si es SPA, activa `render: true` en `providerConfig`.
4.  **Configurar Selectores:**
    *   Usa selectores CSS robustos.
    *   Define siempre el país (`countryCode`).
5.  **Definir Pipeline:** Asegúrate de que `strategyOrder` refleje las estrategias configuradas.

### Ejemplo Completo: MercadoLibre
```json
{
  "domainId": "mercadolibre.com.co",
  "providerId": "scraperapi",
  "countryCode": "CO",
  "enabled": true,
  "typeService": ["scraping"],
  "supportedTypes": ["detail", "search", "searchSpecific"],
  "strategyOrder": ["css", "scripts", "jsonLd", "meta"],
  "scraperConfig": {
    "detail": {
      "css": {
        "price": ".ui-pdp-price__current-price .andes-money-amount__fraction",
        "title": "h1.ui-pdp-title"
      }
    },
    "search": {
      "containerSelector": ".ui-search-layout__item, .poly-card",
      "titleSelector": ".poly-component__title, .ui-search-item__title, h2.ui-search-item__title",
      "priceSelector": ".poly-price__current .andes-money-amount__fraction, .ui-search-price__second-line .andes-money-amount__fraction",
      "urlSelector": "a.poly-component__title-link, a.ui-search-link",
      "imageSelector": ".poly-component__picture, .ui-search-result-image__element",
      "scripts": []
    },
    "searchSpecific": {
      "css": {
        "price": ".poly-price__current .andes-money-amount__fraction, .ui-search-price__second-line .andes-money-amount__fraction",
        "title": ".poly-component__title, .ui-search-item__title",
        "image": "img.poly-component__picture, img.ui-search-result-image__element",
        "url": "a.poly-component__title-link, a.ui-search-link"
      },
      "scripts": []
    }
  },
  "providerConfig": {
    "search": { "premium": true, "render": true, "country_code": "co" },
    "detail": { "premium": true, "render": true, "country_code": "inline" }
  }
}
```

---

## 4. Notas de Mantenimiento
- **Normalización:** Los datos en DynamoDB pueden venir con tipos (`{S: "..."}`). El backend y frontend manejan la normalización, pero al crear nuevos registros, prefiere JSON plano.
- **Custom Rate Limit:** Si el dominio requiere límites específicos, usa el campo `customRateLimit: { "requestsPerMinute": X, "cooldownSeconds": Y }`.
