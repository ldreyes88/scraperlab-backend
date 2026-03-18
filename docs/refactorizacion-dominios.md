# Refactorización de Estrategias de Extracción Modular

Se ha implementado un nuevo **Pipeline de Extracción Modular** que permite a los administradores configurar no solo qué métodos de extracción están activos, sino también el **orden de prioridad** en el que se ejecutan.

## 1. Pipeline de Extracción Modular

A diferencia de la implementación anterior, el sistema ahora intenta extraer datos siguiendo una secuencia definida por el usuario. Esto permite optimizar el scraping según la estructura de cada dominio.

### Configuración del Orden y Estado
En el panel de dominios, ahora existe una sección denominada **"Pipeline de Extracción Modular"**:
- **Habilitar/Deshabilitar:** Mediante los checkboxes laterales se puede activar o desactivar cada estrategia individualmente.
- **Prioridad Dinámica:** Mediante las flechas de orden (arriba/abajo), se define la secuencia de ejecución. El sistema siempre intentará extraer la información usando la estrategia de **Prioridad 1** primero, y así sucesivamente.
- **Selectores CSS con Control:** Ahora los selectores CSS también forman parte del pipeline y pueden ser desactivados o movidos de prioridad.

### 2. Estrategias Disponibles

- **JSON-LD (Schema.org):** Extrae datos estructurados siguiendo rutas personalizadas (ej. `price`, `offers.price`).
- **Next.js Data (__NEXT_DATA__):** Extrae del estado interno de aplicaciones Next.js usando rutas por puntos (ej. `props.pageProps.product.price`).
- **Scripts (Regex Patterns):** Busca valores específicos usando expresiones regulares dentro de las etiquetas `<script>`.
- **Meta Tags (OG, Twitter):** **Automática.** Extrae de etiquetas OpenGraph y Twitter Cards estándar. No requiere configuración manual de rutas.
- **Selectores CSS (DOM):** Selectores tradicionales para el HTML visible (ej. `#total-price`, `.product-title`).

---

### 3. Interfaz de Usuario Dinámica
La interfaz se ha optimizado para reflejar la prioridad configurada:
- **Orden de Paneles:** Las secciones de configuración (Rutas JSON-LD, Rutas Next.js, Selectores CSS) aparecen en el mismo orden que se definió en el pipeline.
- **Sección Informativa Meta Tags:** Se incluyó un panel que explica la naturaleza automática de los Meta Tags, eliminando la duda sobre la falta de campos de entrada.

---

## Cambios Técnicos Realizados

### Backend
- **BaseDomainStrategy.js**: Métodos estandarizados para cada tecnología (`extractJSONLD`, `extractNextData`, `extractMeta`, `extractFromScripts`).
- **GenericDynamicStrategy.js**: El método `scrape` ahora itera sobre `domainConfig.strategyOrder`, respetando los flags `useJsonLd`, `useNextData`, `useScripts`, `useMeta` y el nuevo `useCss`.
- **DomainConfigService.js**: Persistencia de todos los nuevos flags y el array de orden.

### Frontend
- **Domains.jsx**: 
  - Implementación de la lista reordenable con helpers de estado (`moveStrategy`).
  - Renderizado dinámico de las secciones de configuración basado en `formData.strategyOrder`.
  - Normalización de datos en `openModal` para manejar valores por defecto en dominios antiguos.

---

## 4. Guía de Migración (Ejemplo: Falabella)

Para migrar un dominio con lógica hardcoded (como `FalabellaDetailStrategy.js`) al sistema modular, sigue estos pasos:

### Paso A: Configuración en el Panel Admin
1.  Busca el dominio `falabella.com.co`.
2.  **Pipeline**: Activa `NextData` y `Selectores CSS`. Pon `NextData` en Prioridad 1.
3.  **Rutas Next.js**:
    -   Precio Actual: `props.pageProps.productData.prices[0].eventPrice`
    -   Precio Original: `props.pageProps.productData.prices[0].normalPrice`
4.  **Selectores CSS**:
    -   Precio Actual: `li[data-event-price], .prices-0 .primary`
    -   Precio Original: `li[data-normal-price], .prices-1 .primary`
    -   Título: `h1`
5.  **Guardar**.

### Paso B: Actualización de StrategyFactory.js

```diff
- const FalabellaDetailStrategy = require('./domain/falabella.com.co/FalabellaDetailStrategy');
- const AlkostoDetailStrategy = require('./domain/alkosto.com/AlkostoDetailStrategy');
+ // Clases eliminadas en favor de GenericDynamicStrategy

  getStrategy(domain, type) {
-   if (domain === 'falabella.com.co') return new FalabellaDetailStrategy();
-   if (domain === 'alkosto.com') return new AlkostoDetailStrategy();
+   if (['falabella.com.co', 'alkosto.com'].includes(domain)) {
+     return new GenericDynamicStrategy();
+   }
  }
```

---

## 5. Guía de Migración (Ejemplo: Alkosto)

Para migrar `alkosto.com`, configuramos el pipeline para priorizar el DataLayer inyectado en scripts, con fallback a JSON-LD y CSS.

### Paso A: Configuración en el Panel Admin
1.  Busca el dominio `alkosto.com`.
2.  **Pipeline**: Activa `Scripts`, `JSON-LD` y `Selectores CSS`.
    *   **IMPORTANTE**: Activa **Render (JavaScript)** en la configuración del Provider para este dominio, ya que Alkosto usa carga dinámica para el título y el precio.
    *   Prioridad 1: **Scripts** (Busca el objeto `GAProductData`)
    *   Prioridad 2: **JSON-LD**
    *   Prioridad 3: **Selectores CSS**
3.  **Scripts (Regex Patterns)**:
    *   Precio Actual: `price:"(\d+)"`
    *   Precio Original: `previousPrice:"(\d+)"`
4.  **Rutas JSON-LD**:
    *   Precio Actual: `offers.price`
    *   Precio Original: `offers.highPrice`
5.  **Selectores CSS**:
    *   Precio Actual: `.price, .alk-main-price`
    *   Precio Original: `.before-price__basePrice`
    *   Título: `.js-main-title`
6.  **Guardar**.

---

## Resultados de Verificación
El pipeline ha sido validado mediante scripts de prueba:
1. **JSON-LD Extraction** -> ✓ PASÓ
2. **NextData Extraction** -> ✓ PASÓ
3. **Meta Tags Extraction** -> ✓ PASÓ
4. **Custom Script Regex** -> ✓ PASÓ

---

---

## 6. Guía de Migración (Ejemplo: MercadoLibre)

Para migrar `mercadolibre.com.co`, configuramos el pipeline para usar Scripts como fuente primaria (Melidata/Preloaded State) y fallback en JSON-LD y Selectores CSS.

### Paso A: Configuración en el Panel Admin
1.  Busca el dominio `mercadolibre.com.co`.
2.  **Pipeline**: Activa `Scripts`, `JSON-LD` y `Selectores CSS`.
    *   Prioridad 1: **Scripts**
    *   Prioridad 2: **JSON-LD**
    *   Prioridad 3: **Selectores CSS**
3.  **Scripts (Regex Patterns)**:
    *   Precio Actual (1): `"price":\s*(\d+(?:\.\d+)?)`
    *   Precio Actual (2): `(?<!"original_)"value":\s*(\d+(?:\.\d+)?)`
    *   Precio Original: `"original_(?:price|value)":\s*(\d+(?:\.\d+)?)`
4.  **Selectores CSS**:
    *   Precio Actual: `.ui-pdp-price__second-line .andes-money-amount__fraction, .price-tag-fraction, [class*="price"] [class*="fraction"]`
    *   Precio Original: `.ui-pdp-price__original-value .andes-money-amount__fraction, .price-tag-line-through .andes-money-amount__fraction, [class*="original"] [class*="fraction"]`
    *   Título: `h1.ui-pdp-title`
5.  **Guardar**.

### Paso B: Actualización de StrategyFactory.js
Se elimina la referencia al archivo hardcoded para que entre en el flujo de `GenericDynamicStrategy`.

```diff
- const MercadoLibreDetailStrategy = require('./domain/mercadolibre.com.co/MercadoLibreDetailStrategy');
...
  static domainStrategiesByType = {
-    'mercadolibre.com.co': {
-      detail: MercadoLibreDetailStrategy,
-      default: MercadoLibreDetailStrategy
-    },
```
---

## Próximos Pasos recomendados
1. **Migración:** Ejecutar `scripts/migrateToDynamic.js` para que todos los dominios adopten la nueva estructura modular.
2. **Limpieza:** Una vez migrado a `GenericDynamicStrategy`, puedes eliminar los archivos `.js` antiguos de la carpeta `domain/`.
