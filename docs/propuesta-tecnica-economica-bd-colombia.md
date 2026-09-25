# PROPUESTA TÉCNICO-ECONÓMICA

**Servicio Especializado de Relevamiento, Extracción, Procesamiento y Estructuración de Procesos de Contratación Pública en SECOP II para el Sector Salud y Dispositivos Médicos**

---

| **Información del Documento** | **Detalle** |
| :--- | :--- |
| **Cliente:** | **BD Colombia (Becton, Dickinson and Company)** |
| **Atención:** | **Mauricio Colmenares** — Comprador Hub Andino (Purchasing) |
| **Email:** | Mauricio.Colmenares@bd.com |
| **Dirección:** | Calle 97 # 23 - 60, Bogotá D.C., Colombia |
| **Proveedor:** | **ScraperLab Soluciones Tecnológicas** |
| **Líder Técnico / Contacto:** | **Luis Reyes** — Arquitecto de Soluciones Cloud & IA |
| **Fecha de Presentación:** | 22 de Septiembre de 2026 |
| **Vigencia de la Oferta:** | 45 días calendario |
| **Código de Referencia:** | `PROP-2026-BD-SECOP2-001` |

---

## 1. CARTA DE PRESENTACIÓN Y ENTENDIMIENTO DE LA NECESIDAD

Estimado Mauricio y equipo de Compras Hub Andino de BD Colombia:

En **ScraperLab** agradecemos la oportunidad de presentar nuestra propuesta técnico-económica para el suministro, estructuración y analítica continua de los procesos de contratación pública publicados en **SECOP II**, con enfoque focalizado en el **sector salud, dispositivos médicos e insumos hospitalarios**.

### Entendimiento del Desafío
Comprendemos que para **BD (Becton Dickinson)**, líder global en tecnología médica, el monitoreo del mercado público colombiano no puede limitarse a una visión macroscópica de los procesos licitatorios. La inteligencia comercial y competitiva estratégica exige llegar a la máxima granularidad: **el renglón o ítem adjudicado**.

Actualmente, las bases de datos abiertas tradicionales solo exponen metadatos generales (cuantías globales, entidades y adjudicatarios totales), mientras que la información crítica —tales como **marcas ofertadas, precios unitarios, especificaciones técnicas y adjudicación por renglón**— se encuentra dispersa y embebida en miles de documentos no estructurados (pliegos, anexos técnicos en PDF, ofertas económicas y resoluciones de adjudicación).

Nuestra propuesta combina:
1. **Acceso directo y masivo a fuentes oficiales de SECOP II** vía interfaces programáticas (API SODA).
2. **Motor de Inteligencia Artificial Multimodal (Google Gemini / LLMs avanzados)** con visión documental y OCR de alta resolución para la extracción automatizada renglón por renglón.
3. **Infraestructura Cloud Serverless elástica en AWS** diseñada para soportar sin fricción la ingesta histórica de 24 meses y la actualización mensual recurrente.
4. **Entrega de datos listos para consumo empresarial** (Excel, CSV y modelado tabular para PowerBI / Tableau).

---

## 2. RESPUESTA EXPLÍCITA AL CRITERIO DE EVALUACIÓN OBLIGATORIO (SECCIÓN 3)

> **Pregunta Formulada por BD Colombia:**  
> *«¿La solución propuesta permite extraer automáticamente información a nivel de renglón/producto desde los documentos adjuntos asociados al proceso SECOP (tales como PDFs, anexos técnicos y ofertas económicas), incluyendo cantidades, marcas, precios unitarios y adjudicaciones, o únicamente consulta información disponible en los campos estructurados de las bases de datos públicas de SECOP? (Favor especificar la tecnología utilizada: OCR, LLMs, arquitecturas de IA, etc., en caso de realizar lectura documental).»*

### **Respuesta Oficial:**

**SÍ, nuestra solución permite extraer de forma 100% automatizada la información a nivel de renglón/producto directamente desde los documentos adjuntos asociados a los procesos de SECOP II (PDFs, hojas de cálculo en Excel, anexos técnicos, actas de evaluación y ofertas económicas), y NO se limita a la consulta de campos estructurados.**

#### Especificación Tecnológica del Motor de Lectura Documental:
Nuestra arquitectura implementa un **Pipeline Documental Inteligente (IDP - Intelligent Document Processing)** compuesto por:

1. **Clasificación y Triaje Documental Automático:** El motor inspecciona los anexos del expediente en SECOP II y clasifica automáticamente los tipos de archivo prioritarios: *Anexo Técnico*, *Oferta Económica Presentada*, *Informe Final de Evaluación* y *Resolución/Acta de Adjudicación*.
2. **Modelos de Lenguaje Multimodales de Última Generación (Google Gemini 2.5 Flash / Pro):** 
   - A diferencia de los OCR tradicionales basados en reglas rígidas de coordenadas (que fallan cuando el formato de la tabla cambia entre entidades), utilizamos LLMs multimodales con compresión semántica y espacial.
   - Estos modelos leen nativamente páginas completas de PDFs (tanto nativos digitales como escaneados de alta resolución), comprenden relaciones complejas entre columnas heterogéneas, filas combinadas y notas al pie, e interpretan el contexto de adjudicación.
3. **Capa de OCR Complementaria con Preprocesamiento de Imagen:** Para documentos escaneados de baja calidad o firmas superpuestas, aplicamos filtros de binarización y normalización geométrica previos a la inferencia del modelo de lenguaje.
4. **Esquema de Salida Estricto (Structured JSON Enforcement):** El modelo devuelve exclusivamente esquemas normalizados y validados por tipado de datos estricto (`JSON Schema`), garantizando que cada renglón contenga:
   - `numero_renglon`
   - `descripcion_producto`
   - `codigo_unspsc_renglon`
   - `especificaciones_tecnicas`
   - `cantidad_solicitada` y `unidad_medida`
   - `marca_ofertada`
   - `precio_unitario_ofertado`
   - `cantidad_adjudicada`
   - `valor_total_adjudicado`
   - `adjudicatario_renglon`

---

## 3. ALCANCE TÉCNICO DETALLADO DE LA SOLUCIÓN

### 3.1. Carga Histórica (24 Meses)
- **Cobertura Temporal:** Últimos 24 meses completos contados a partir de la fecha de inicio del servicio.
- **Filtros Sectoriales:** Filtrado por códigos UNSPSC aplicables al sector salud, con foco primordial en:
  - **Segmento 42:** Equipo médico, accesorios y suministros (jeringas, catéteres, equipos de infusión, sistemas de recolección de fluidos, agujas, apósitos, etc.).
  - **Segmento 51:** Medicamentos y productos farmacéuticos asociados.
  - **Segmento 41:** Equipo de laboratorio y diagnóstico in vitro.
  - Palabras clave y entidades de salud de interés acordadas previamente con BD Colombia.
- **Volumen Estimado:** Extracción estimada de entre 6.000 y 14.000 procesos licitatorios del sector salud en Colombia, procesando la documentación relevante para la reconstrucción granular de renglones.

### 3.2. Actualización Periódica Mensual
- **Frecuencia:** Ejecución mensual automatizada durante los primeros 5 días hábiles de cada mes.
- **Monitoreo Integral:**
  - Nuevos procesos publicados en el periodo.
  - Cambios de estado en procesos en curso (de *Convocado* a *Presentación de ofertas*, *Evaluación*, *Adjudicado* o *Desierto*).
  - Publicación de nuevas adiciones, modificaciones contractuales y actas de adjudicación definitivas.

### 3.3. Modelo de Datos y Atributos Capturados

| Nivel de Información | Campos Incluidos en el Modelo |
| :--- | :--- |
| **Nivel Proceso (Macro)** | • ID Único de Proceso (SECOP II)<br>• Referencia del Proceso / Número de Convocatoria<br>• Entidad Contratante y NIT<br>• Ubicación (Departamento, Municipio)<br>• Modalidad de Contratación (Licitación Pública, Selección Abreviada, Subasta, etc.)<br>• Objeto Contractual<br>• Código UNSPSC Principal y Familia<br>• Fechas Clave (Publicación, Cierre de Ofertas, Fecha de Adjudicación)<br>• Cuantía / Presupuesto Oficial Estimado<br>• Estado Actual del Proceso<br>• Oferente(s) Ganador(es) Global(es)<br>• Valor Total Adjudicado del Proceso<br>• Enlace Directo (URL Trazable) al Proceso en SECOP II |
| **Nivel Renglón / Producto (Micro)** | • Número de Renglón / Ítem / Lote<br>• Descripción detallada del producto licitado<br>• Código UNSPSC a nivel de producto<br>• Unidad de Medida (Caja, Unidad, Kit, Frasco, etc.)<br>• Cantidad Solicitada por la Entidad<br>• Especificaciones Técnicas Clave<br>• **Marca Ofertada / Fabricante Reportado**<br>• **Precio Unitario Ofertado**<br>• **Cantidad Adjudicada**<br>• **Valor Total Adjudicado del Renglón**<br>• Proveedor Adjudicado específico del renglón<br>• Documento Fuente del que se extrajo (nombre de archivo PDF/Excel y página/referencia) |

---

## 4. METODOLOGÍA ETL Y ARQUITECTURA TECNOLÓGICA

Nuestra solución opera sobre la plataforma **ScraperLab**, una arquitectura serverless desacoplada alojada en **Amazon Web Services (AWS)** y orquestada con nodos modulares:

```
               ┌────────────────────────────────────────────────────────┐
               │         FUENTES PÚBLICAS SECOP II (COLOMBIA)           │
               │  - API SODA / datos.gov.co (Metadatos Estructurados)   │
               │  - Repositorio Documental Jaggaer/SECOP (PDF / Excel)  │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
     [ NODO 1: TRIGGER & INGESTA ]
     Cron Programado Mensual / Batch Histórico
     Filtros UNSPSC Salud (Segmentos 42, 51, 41)
                                          │
                                          ▼
     [ NODO 2: ORQUESTADOR BATCH SQS ]
     Buffer desacoplado en AWS SQS para procesamiento paralelo masivo
     Control de concurrencia y tolerancia a fallos (DLQ)
                                          │
                                          ▼
     [ NODO 3: DESCARGA Y TRIAGE DOCUMENTAL ]
     Inspección de anexos: Anexos Técnicos, Ofertas Económicas y Actas
     Almacenamiento transitorio seguro en AWS S3 cifrado
                                          │
                                          ▼
     [ NODO 4: MOTOR DE EXTRACCIÓN CON IA (GEMINI MULTIMODAL) ]
     Lectura de tablas de PDFs y Excels con Vision LLM
     Parsing renglón a renglón hacia JSON estructurado
                                          │
                                          ▼
     [ NODO 5: CONTROL DE CALIDAD Y NORMALIZACIÓN (QA ENGINE) ]
     Verificación de consistencia aritmética (Cant × Unitario = Total)
     Validación de marcas, normalización de unidades y cálculo de confidence score
                                          │
                                          ▼
     [ NODO 6: PERSISTENCIA Y EXPORTACIÓN EMPRESARIAL ]
     Base de Datos DynamoDB / Repositorio S3
     Generación de entregables en Excel (.xlsx) y CSV (.csv)
     Conector OData / REST API directo para PowerBI y Tableau
```

### Componentes de Infraestructura:
1. **AWS SQS + Lambda Workers (Batch Processing):** Permite procesar los 24 meses históricos de forma asíncrona, procesando múltiples licitaciones en paralelo sin riesgo de caídas de sesión ni demoras manuales.
2. **Google Cloud Generative AI (Gemini 2.5 Flash / Pro):** Modelos optimizados para procesamiento masivo de tokens con latencia ultra-baja y precisión en transcripción de tablas numéricas.
3. **AWS S3 con Cifrado SSE-S3:** Repositorio seguro para almacenamiento de los entregables y respaldos de los documentos procesados.
4. **DynamoDB:** Base de datos NoSQL de alta velocidad que almacena el histórico con llaves de partición por entidad, fecha y proceso para consultas inmediatas.

---

## 5. CONTROL DE CALIDAD, TRAZABILIDAD Y PRECISIÓN DE DATOS

Para garantizar la fiabilidad requerida por BD Colombia, implementamos un **Sistema de Auditoría y Aseguramiento de Calidad de Datos (QA Engine)**:

1. **Regla de Consistencia Aritmética:** Cada renglón extraído es sometido a validación matemática automática:  
   $$\text{Cantidad Adjudicada} \times \text{Precio Unitario} \approx \text{Valor Total Adjudicado}$$  
   Si se detecta discrepancia superior a tolerancias de redondeo, el registro es marcado para revisión.
2. **Reconciliación de Cuantía Global:** La suma de los renglones adjudicados se concilia contra el valor de adjudicación global registrado en la cabecera de SECOP II.
3. **Score de Precisión y Trazabilidad (*Data Lineage*):** Cada renglón incluye metadatos de trazabilidad:
   - Nombre exacto del archivo adjunto origen.
   - Número de página o sección del documento de donde se obtuvo.
   - Indicador de confianza del modelo (`confidence_score`: Alto / Medio / Manual Check).
4. **Informe de Cobertura y Métricas:** En cada entrega mensual se suministra un reporte de salud del dato:
   - Porcentaje de procesos adjudicados con desglose documental exitoso (>95%).
   - Procesos donde la entidad no publicó anexo económico o fue declarado desierto.
   - Total de renglones procesados y marcas catalogadas.

---

## 6. FACILIDAD DE INTEGRACIÓN CON HERRAMIENTAS DE BI (POWERBI / TABLEAU)

Nuestra entrega no consiste en datos crudos o desordenados; estructuramos la información siguiendo las mejores prácticas de analítica de datos:
- **Estructura Tabular Normalizada:** El dataset se entrega en formato relacional (Tabla de Procesos vinculada por `Proceso_ID` a la Tabla de Renglones), facilitando modelos de datos tipo *Star Schema* en PowerBI o Tableau.
- **Campos Numéricos y Fechas Tipificadas:** Todos los montos son entregados en números limpios (sin signos de pesos, comas de texto o espacios), y las fechas en estándar internacional ISO `YYYY-MM-DD`.
- **Conectividad Flexible:**
  - **Archivos Planos:** Consumo directo mediante carpetas compartidas o sincronizadas en OneDrive/SharePoint/S3.
  - **Endpoint API / Conector Web:** Capacidad de habilitar un endpoint REST con autenticación segura para que el equipo de BI de BD pueda actualizar sus dashboards con un solo clic (*Refresh Data*).

---

## 7. CUMPLIMIENTO LEGAL Y TRATAMIENTO DE DATOS (LEY 1581 DE 2012)

La solución cumple estrictamente con el marco legal colombiano:
- **Naturaleza Pública de la Información:** Toda la información procesada proviene de **SECOP II**, la cual ostenta carácter de información pública y abierta conforme a la **Ley 1712 de 2014** (Ley de Transparencia y del Derecho de Acceso a la Información Pública Nacional) y las directrices de Colombia Compra Eficiente.
- **Ley 1581 de 2012 (Habeas Data):** En caso de identificarse datos personales de proponentes personas naturales (números de cédula, correos personales o firmas), la plataforma implementa filtros de anonimización y enmascaramiento donde corresponda.
- **Seguridad y Confidencialidad Corporativa:** ScraperLab suscribe acuerdos de confidencialidad (NDA) estrictos. Los datos recopilados, modelos de interés y métricas extraídas son de uso exclusivo y propiedad de BD Colombia, procesados en entornos cloud privados y cifrados en tránsito (TLS 1.3) y en reposo (AES-256).

---

## 8. PROPUESTA ECONÓMICA Y DESGLOSE DE COSTOS

Presentamos un esquema comercial transparente, predecible y sin sorpresas, dividido en fase de implementación/histórico y operación recurrente:

### 8.1. Desglose Comercial

| Concepto | Descripción | Tipo de Cobro | Valor (COP) |
| :--- | :--- | :---: | :---: |
| **Fase 1: Implementación & Carga Histórica (24 Meses)** | • Configuración de la infraestructura cloud y pipelines de extracción.<br>• Mapeo de taxonomía UNSPSC y reglas de negocio para BD Colombia.<br>• Ingesta masiva de los 24 meses históricos de SECOP II.<br>• Extracción documental de renglones vía IA multimodal.<br>• Limpieza, homologación y entrega de la base consolidada inicial.<br>• Configuración del modelo de datos para PowerBI / Tableau. | **Único (One-Off)** | **$ 18.500.000 COP** |
| **Fase 2: Operación, Mantenimiento y Actualización Mensual** | • Monitoreo continuo de nuevos procesos y cambios de estado en SECOP II.<br>• Extracción mensual de documentos y renglones.<br>• Entrega recurrente mensual de datos consolidados (primeros 5 días hábiles).<br>• Mantenimiento preventivo y correctivo ante cambios de interfaz en SECOP.<br>• Soporte técnico prioritario y emisión de informes de cobertura mensual.<br>• **Incluye bolsa de consumo de tokens de IA para procesamiento documental recurrente estándar.** | **Mensual Recurrente** | **$ 4.200.000 COP / mes** |

> [!NOTE]
> **Transparencia en Costos Variables de IA (Tokens):**
> Gracias a la optimización de nuestra arquitectura con modelos *Gemini Flash Multimodal*, el costo variable de procesamiento por token es extremadamente eficiente. 
> - **El valor mensual recurrente ya incluye la totalidad del consumo de tokens necesario para el volumen mensual habitual de contratación en el sector salud en Colombia.**
> - BD Colombia no recibirá cobros variables imprevistos por consumo de IA durante la operación regular.

### 8.2. Opciones de Facturación y Vigencia
- **Precios en Pesos Colombianos (COP).** No incluyen IVA (si aplica según régimen tributario).
- **Forma de Pago Carga Histórica:** 50% contra orden de servicio / inicio de actividades y 50% contra entrega a satisfacción de la base de 24 meses.
- **Forma de Pago Mensualidad:** Mes vencido contra entrega de reporte mensual.
- **Vigencia de la Oferta:** 45 días calendario a partir de la fecha de presentación.

---

## 9. CRONOGRAMA DE IMPLEMENTACIÓN Y TIEMPOS

El proyecto está diseñado para ejecutarse en un plazo ágil de **cuatro (4) semanas calendario** para la disponibilidad total del histórico:

| Semana | Hitos de Implementación | Entregable Asociado |
| :---: | :--- | :--- |
| **Semana 1** | • Kick-off técnico y alineación de códigos UNSPSC y marcas foco.<br>• Despliegue de pipelines de ingesta en ambiente de producción.<br>• Pruebas de extracción de documentos muestra de SECOP II. | Documento de Especificación y Diccionario de Datos acordado. |
| **Semana 2** | • Ejecución de la ingesta masiva de los 24 meses (API SODA).<br>• Clasificación de anexos técnicos y ofertas económicas en cola SQS.<br>• Inferencia masiva con motor de IA documental. | Reporte preliminar de cobertura de procesos detectados. |
| **Semana 3** | • Ejecución del motor de control de calidad (QA Engine).<br>• Normalización de marcas, cantidades y precios unitarios.<br>• Verificación cruzada y muestreo estadístico de precisión. | Muestra de validación del 10% del dataset con equipo BD. |
| **Semana 4** | • Entrega final de la **Base de Datos Histórica (24 Meses)** en Excel y CSV.<br>• Entrega de Informe de Cobertura y Metodología ETL.<br>• Activación del pipeline recurrente para la primera actualización mensual. | **Entregable Final Fase 1 + Puesta en Producción.** |

---

## 10. EXPERIENCIA Y CREDENCIALES DE SCRAPERLAB

**ScraperLab** es una plataforma tecnológica especializada en extracción de datos a escala, automatización de flujos de scraping corporativo y procesamiento inteligente de documentos públicos y privados:
- **Experiencia en Portales Gubernamentales:** Experiencia demostrada en plataformas estatales colombianas (incluyendo interacción con APIs de Datos Abiertos y portales de entidades de control y seguimiento como Supernotariado y entidades públicas).
- **Procesamiento Masivo y Resiliencia:** Arquitectura cloud que procesa cientos de miles de registros y peticiones semanales mediante rotación inteligente y procesamiento serverless.
- **Especialistas en IA Generativa Aplicada:** Implementación práctica de modelos de lenguaje multimodales de última generación integrados a flujos productivos de negocio, reduciendo en un 90% el tiempo manual de digitación y extracción de documentos licitatorios.

---

## 11. ENTREGABLES FORMALES COMPROMETIDOS

Al finalizar la implementación y en cada ciclo mensual, BD Colombia recibirá:
1. **Archivo Maestro de Procesos y Renglones (.xlsx / .csv):** Base limpia con la totalidad de campos definidos en la Sección 3.
2. **Plantilla Conectora de PowerBI / Tableau (.pbit / archivo modelo):** Modelo de datos preconfigurado con relaciones y métricas básicas (gasto por marca, precios promedio unitarios, entidades con mayor volumen de compra).
3. **Informe Metodológico de Extracción y Calidad de Información:** Documento técnico que detalla la cobertura alcanzada, trazabilidad de fuentes y tasas de precisión obtenidas.
4. **Repositorio Documental Digital (Opcional):** Acceso a los documentos originales descargados de SECOP II asociados a cada adjudicación.

---

**Presentado por:**

**Luis Reyes**  
Arquitecto de Soluciones Cloud & IA  
*ScraperLab Soluciones Tecnológicas*  
Email: ldreyes@scraperlab.com.co  
Bogotá D.C., Colombia  
