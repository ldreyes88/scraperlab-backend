# Gestión de Pipelines y Nodos Modulares

Este documento describe la arquitectura de automatización de ScraperLab, basada en un motor de ejecución de flujos (Pipelines) compuesto por piezas reutilizables (Nodos).

---

## 🏗️ Arquitectura General

El sistema se divide en dos grandes conceptos:

1.  **Librería de Nodos (Catálogo)**: Definiciones genéricas de "qué hacer" (ej: "Extraer detalles de Amazon", "Enviarle un prompt a Gemini"). Se guardan en la tabla `ScraperLab-Nodes`.
2.  **Pipelines (Instancias)**: Flujos específicos compuestos por una secuencia de nodos. Un pipeline decide el "orden" y los "datos" que fluyen entre nodos. Se guardan en la tabla `ScraperLab-Pipelines`.

### Flujo de Datos
Cada ejecución genera un objeto `state` que contiene:
*   `input`: Datos iniciales enviados al iniciar el pipeline.
*   `nodes`: Resultados acumulados de cada nodo ejecutado indexados por su `id`.
    *   Ejemplo: `state.nodes.start.result` o `state.nodes["node-ai"].summary`.

---

## 🧩 Tipos de Nodos y Configuración

Todos los nodos deben tener al menos:
*   `id`: Identificador único dentro del pipeline (ej: `extract-prices`).
*   `type`: El tipo de lógica a ejecutar.
*   `config`: Objeto con los parámetros específicos del nodo.
*   `next`: `id` del siguiente nodo a ejecutar (o `null` para finalizar).

### 1. TRIGGER
Punto de entrada. Captura los datos iniciales.
*   **Config**: `{ "inputType": "product_name" }`
*   **Dato de salida**: El objeto `input` completo.

### 2. AI_PROMPT (Agente Inteligente)
Utiliza modelos de lenguaje para procesar información.
*   **Config**:
    *   `model`: Modelo a usar (ej: `gemini-1.5-flash`).
    *   `promptTemplate`: Texto con variables tipo `{{input.field}}` o `{{nodes.id_anterior.field}}`.
    *   `isJson`: `true` si se espera una respuesta estructurada.
*   **Dato de salida**: El texto o JSON generado por la IA.

### 3. SCRAPE_SEARCH (Búsqueda Multidominio)
Busca un producto en varios marketplaces a la vez.
*   **Config**:
    *   `domainIds`: Lista de dominios (ej: `["amazon.com", "mercadolibre.com.co"]`).
    *   `queryTemplate`: Término de búsqueda dinámico.
    *   `limit`: Máximo de resultados por dominio.
*   **Dato de salida**: Array de resultados con títulos, precios y URLs.

### 4. SCRAPE_DETAIL (Extracción de Detalles)
Extrae información completa de una URL específica.
*   **Config**:
    *   `urlTemplate`: URL dinámica (ej: `{{nodes.search.first_result.url}}`).
*   **Dato de salida**: Objeto con los detalles scrapeados según el dominio.

### 5. DATA_MAPPING (Transformación)
Reorganiza datos para el siguiente paso o resultado final.
*   **Config**:
    *   `mapping`: Objeto donde las keys son el nuevo nombre y los valores son templates (ej: `{ "precio_final": "{{nodes.ai.price}} USD" }`).

### 6. SAVE_RESULT (Finalización)
Marca el fin del flujo y persiste/retorna el resultado final.
*   **Config**: 
    *   `dataTemplate`: Qué dato específico guardar como resultado del pipeline.

### 7. API_REQUEST (Integración Externa)
Realiza peticiones HTTP a servidores externos o servicios propios.
*   **Config**: 
    *   `url`: URL destino (soporta templates).
    *   `method`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
    *   `bodyTemplate`: JSON para el cuerpo de la petición (POST/PUT/PATCH).
    *   `headers`: Objeto de cabeceras dinámicas.

---

## 📎 Resolución de Variables (Templates)

El motor utiliza el motor de templates `{{ }}` para inyectar datos dinámicamente en cualquier campo de la configuración:

| Origen | Sintaxis | Ejemplo |
| :--- | :--- | :--- |
| Entrada Inicial | `{{input.campo}}` | `{{input.product_name}}` |
| Nodo Anterior | `{{nodes.id_del_nodo.campo}}` | `{{nodes.scraper.results[0].price}}` |
| Proceso Global | `{{config.STAGE}}` | `{{config.STAGE}}` |

---

## 🤖 Instrucciones para el Agente AI

Cuando el usuario pida un **nuevo Pipeline** o una **funcionalidad específica**:

1.  **Analiza la funcionalidad**: Identifica qué pasos se requieren (Trigger -> Búsqueda -> Análisis -> Guardado).
2.  **Verifica la Librería**: Busca si ya existen nodos genéricos que cumplan la función.
3.  **Genera el JSON**: Crea el objeto del Pipeline vinculando los nodos mediante la propiedad `next`.
4.  **Propón la Config**: Si un nodo requiere un prompt de IA, genera un `promptTemplate` efectivo que use los datos de los nodos anteriores satisfactoriamente.

### Ejemplo de Solicitud de Generación:
> "Crea un pipeline que reciba el nombre de un celular, lo busque en MercadoLibre y decida con Gemini si el precio es una buena oferta comparado con el promedio".

**Respuesta Esperada del Agente:**
Generación de un objeto Pipeline con:
*   `start` (TRIGGER)
*   `search` (SCRAPE_SEARCH con domainIds=["mercadolibre.com.co"])
*   `ai-eval` (AI_PROMPT que reciba la lista de `search` y retorne un boolean `isGoodOffer`)
*   `end` (SAVE_RESULT)
