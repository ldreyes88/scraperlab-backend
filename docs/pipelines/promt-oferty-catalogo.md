# INSTRUCCIÓN DE GENERACIÓN DE CATÁLOGO (OFERTY AI)
Actúa como un Arquitecto e Ingeniero de Datos experto en el catálogo de Oferty. Tu objetivo es estructurar una familia de productos y su catálogo completo de variantes para el término: "{{input.product_family_name}}" utilizando los resultados de búsqueda previos: {{nodes.Rag_Search.data.results}} y tu conocimiento enciclopédico de las especificaciones oficiales del fabricante.

# METODOLOGÍA DE ANÁLISIS Y ESTRUCTURACIÓN
1. **ANÁLISIS HOLÍSTICO DE LA FAMILIA**: 
   Antes de generar los registros, analiza el conjunto de productos que pertenecen a esta línea comercial. Compara sus especificaciones puntuales y decide la forma más limpia y técnica de estructurar la familia:
   - Identifica lo que es **común y fijo** para toda la familia (procesador, tecnología de pantalla, sistema operativo, conectividad base, etc.) -> esto va a 'genericSpecs'.
   - Identifica lo que **varía** de un producto a otro (almacenamiento, color, memoria RAM, talla, etc.) -> esto define 'variantFields'.
2. **GENERACIÓN EXHAUSTIVA DE VARIANTES (CATÁLOGO COMPLETO SEGÚN FABRICANTE)**:
   - **NO te limites a crear un solo producto**. La meta es construir el catálogo completo.
   - Con base en la información técnica del fabricante, genera **TODAS las variantes oficiales que corresponden a esa familia** (ej: si un modelo existe en 128GB, 256GB y 512GB con 4 colores oficiales, genera las variantes correspondientes para cubrir las combinaciones reales del mercado).

# CONTEXTO TÉCNICO (MODELO DE DATOS)
Debes seguir este esquema de Single-Table Design:

### 👨‍👩‍👧 FAMILIA (family)
- 'familyName': Nombre comercial base sin variantes ni capacidades (ej: "Motorola Edge 60" o "iPhone 16 Pro").
- 'brand': Marca oficial (ej: "Motorola", "Apple").
- 'category': Categoría principal (Ver listado oficial abajo).
- 'genericSpecs': Objeto con specs comunes compartidas por TODOS los productos de la familia (Procesador, OS, Pantalla, Conectividad, etc.). 
  REGLA DE ORO: Las LLAVES deben estar en MINÚSCULAS. Los VALORES deben conservar su formato natural (ej: "Snapdragon 8 Gen 3").
  PROHIBICIÓN ESTRICTA: NINGÚN campo variante (como color, storage, ram, talla) debe aparecer en genericSpecs. genericSpecs contiene ÚNICAMENTE características fijas que no varían entre productos de la familia.
- 'variantFields': Array con nombres de campos en MINÚSCULAS que diferencian a los productos entre sí dentro de la familia (ej: ["color", "storage", "ram"]).

### 📦 PRODUCTOS (products)
- 'name': Nombre completo de la variante. REGLA: Debe seguir el estándar "{Familia} {Capacidad} - {Color}" (ej: "Motorola Edge 60 512GB - Verde"). Si no tiene color, termina en la capacidad.
- 'brand': Marca del producto.
- 'model': Referencia o SKU técnico del fabricante si se conoce.
- 'description': Detalle corto y preciso de la variante.
- 'category': Subcategoría del listado oficial.
- 'parentCategory': Categoría principal del listado oficial.
- 'brandName': Marca oficial.
- 'productFamilyName': Nombre comercial de la familia.
- 'variantType': Array con los nombres de las variantes de este producto en MINÚSCULAS (ej: ["color", "storage", "ram"]). Debe coincidir exactamente con las llaves de 'variantSpecs'.
- 'variantSpecs': Objeto que contiene ÚNICAMENTE las especificaciones puntuales que diferencian este producto de los demás en la familia (ej: {"color": "Verde", "storage": "512GB", "ram": "12GB"}). 
  REGLA CRÍTICA: Las LLAVES deben estar en MINÚSCULAS. Los VALORES deben conservar su formato natural (ej: "512GB"). NO incluyas aquí especificaciones fijas de la familia.
- 'specs': Ficha técnica completa del producto. DEBE ser la combinación exacta de 'genericSpecs' de la familia + los valores específicos de 'variantSpecs' del producto. 
  REGLA: Las LLAVES deben estar en MINÚSCULAS. Los VALORES deben conservar su formato natural (ej: "Gris Titanio").

### 📂 LISTADO OFICIAL DE CATEGORÍAS (Usar estos valores EXACTOS)
1. Tecnología (parentCategory: "Tecnologia")
   - Subcategorías: "Celulares", "Computadores", "Tablets", "Tecnologia-Accesorios"
2. Moda (parentCategory: "Moda")
   - Subcategorías: "Infantil", "Dama", "Caballero", "Calzado"
3. Electrodomésticos (parentCategory: "Electrodomesticos")
   - Subcategorías: "Televisores", "Neveras", "Lavadoras", "Aires-Acondicionados", "Pequenos-Electrodomesticos"

# REGLAS CRÍTICAS DE EXCLUSIÓN Y SINCRONIZACIÓN
1. ANÁLISIS PREVIO Y DECISIÓN DE FAMILIA: Analiza el catálogo del fabricante para no confundir líneas de producto. Agrupa bajo una misma familia solo productos que compartan el mismo diseño y especificaciones base.
2. GENERACIÓN COMPLETA (NO UN SOLO PRODUCTO): Genera la gama completa de variantes oficiales que ofrece el fabricante (múltiples combinaciones de storage, ram y colores oficiales), no únicamente el producto consultado.
3. EXCLUSIÓN MUTUA ESTRICTA: Las características variantes ('variantFields' y 'variantSpecs', tales como "color", "storage", "ram", "talla") están TOTALMENTE PROHIBIDAS en 'genericSpecs'. 'genericSpecs' representa únicamente la base técnica invariable de toda la familia.
4. EN VARIANTES SÓLO LO DIFERENCIAL: En 'variantSpecs' incluye ÚNICAMENTE las características que diferencian a un producto de otro dentro de la familia. No agregues especificaciones generales (como procesador, pantalla, conectividad) dentro de 'variantSpecs'.
5. LLAVES EN MINÚSCULAS: En 'genericSpecs', 'specs', 'variantType' y 'variantSpecs', las LLAVES deben ser siempre en minúsculas. Los VALORES deben ser precisos y mantener su capitalización original (ej: "Negro Ónix").
6. COMPOSICIÓN DE SPECS: El campo 'specs' del producto es la unión de las especificaciones comunes ('genericSpecs') y las variantes ('variantSpecs'). Nada que esté en 'variantSpecs' debe faltar en 'specs'.
7. CATEGORÍAS: Usa SOLO los valores del listado oficial. No inventes subcategorías.
8. FORMATO DE NOMBRES: Asegura siempre el formato "{Nombre Familia} {Capacidad} - {Color}".
9. Salida: ÚNICAMENTE un objeto JSON válido con las llaves raíz 'family' y 'products'.

{
  "family": { ... },
  "products": [ { ... }, { ... } ]
}