const AIService = require('../services/AIService');

/**
 * Normaliza y sanea la respuesta JSON de Gemini asegurando exclusión mutua
 * y consistencia en los campos.
 */
function sanitizeEnrichedData(data) {
  if (!data || typeof data !== 'object') return data;

  const family = data.family || {};
  const product = data.product || {};

  // Forzar llaves en minúsculas en variantFields
  if (Array.isArray(family.variantFields)) {
    family.variantFields = family.variantFields.map(f => String(f).toLowerCase().trim());
  } else {
    family.variantFields = [];
  }

  // Normalizar llaves de genericSpecs a minúsculas
  if (family.genericSpecs && typeof family.genericSpecs === 'object') {
    const cleanGeneric = {};
    for (const [k, v] of Object.entries(family.genericSpecs)) {
      cleanGeneric[k.toLowerCase().trim()] = v;
    }
    // Exclusión mutua: eliminar de genericSpecs cualquier llave que esté en variantFields
    for (const vf of family.variantFields) {
      delete cleanGeneric[vf];
    }
    family.genericSpecs = cleanGeneric;
  } else {
    family.genericSpecs = {};
  }

  // Normalizar llaves de variantSpecs a minúsculas
  if (product.variantSpecs && typeof product.variantSpecs === 'object') {
    const cleanVariantSpecs = {};
    for (const [k, v] of Object.entries(product.variantSpecs)) {
      cleanVariantSpecs[k.toLowerCase().trim()] = v;
    }
    product.variantSpecs = cleanVariantSpecs;
  } else {
    product.variantSpecs = {};
  }

  // Sincronizar variantType con las llaves de variantSpecs
  product.variantType = Object.keys(product.variantSpecs);

  // Asegurar que variantFields de la familia contenga todos los campos de variantType
  const variantFieldsSet = new Set(family.variantFields);
  for (const vt of product.variantType) {
    variantFieldsSet.add(vt);
  }
  family.variantFields = Array.from(variantFieldsSet);

  // Normalizar y componer specs (genericSpecs + variantSpecs)
  const mergedSpecs = { ...family.genericSpecs };
  if (product.specs && typeof product.specs === 'object') {
    for (const [k, v] of Object.entries(product.specs)) {
      mergedSpecs[k.toLowerCase().trim()] = v;
    }
  }
  // Garantizar que todo variantSpecs esté presente en specs
  for (const [k, v] of Object.entries(product.variantSpecs)) {
    mergedSpecs[k] = v;
  }
  product.specs = mergedSpecs;

  // Sincronizar marcas y categorías
  product.brand = product.brand || family.brand;
  product.brandName = product.brandName || family.brand;
  product.category = product.category || family.category;
  product.parentCategory = product.parentCategory || family.parentCategory;
  product.productFamilyName = family.familyName;

  return { family, product };
}

/**
 * POST /api/ai/enrich-product
 * Recompone y estructura la familia y ficha técnica de un producto usando Gemini
 */
exports.enrichProduct = async (req, res, next) => {
  try {
    const { product, marketplaces = [] } = req.body;

    if (!product || (!product.name && !product.title)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el objeto product con al menos su nombre'
      });
    }

    const prodName = product.name || product.title;
    const prodBrand = product.brand || product.brandName || '';
    const prodCategory = product.category || 'Tecnologia';
    const prodImage = product.image || '';

    // Mapeo contextual de marketplaces para que Gemini tenga precios y URLs reales
    const mpSummary = Array.isArray(marketplaces) && marketplaces.length > 0
      ? marketplaces.map(m => `${m.name || m.marketplaceName || 'Tienda'}: $${m.currentPrice || m.price || 'N/A'} (${m.url || ''})`).join(' | ')
      : 'Sin datos adicionales de marketplaces';

    const prompt = `# ROL Y OBJETIVO
Actúa como un Arquitecto de Datos e Ingeniero de Catálogo experto de Oferty.
Tu objetivo es analizar un producto existente que fue capturado preliminarmente de un marketplace o catálogo, identificar su ficha técnica real del fabricante y RECOMPONERLO / ENRIQUECERLO al estándar estricto de Oferty.

# DATOS DEL PRODUCTO A ANALIZAR
- Nombre recibido en la tienda: "${prodName}"
- Marca informada: "${prodBrand}"
- Categoría informada: "${prodCategory}"
- Imagen/URL contexto: "${prodImage}"
- Contexto de tiendas/marketplaces: "${mpSummary}"

# REGLAS DE ESTRUCTURACIÓN Y NOMENCLATURA (ESTÁNDAR OFERTY)

### 👨‍👩‍👧 1. FAMILIA ('family')
- 'familyName': Nombre comercial base limpio de la línea o gama SIN capacidades de almacenamiento, memoria RAM, colores ni variantes.
  - Ejemplos correctos:
    * Computadores / Laptops: "MacBook Pro 14 pulgadas", "MacBook Air 13 pulgadas", "Dell XPS 13", "Lenovo ThinkPad X1 Carbon" (El tamaño de pantalla identifica la línea base, pero NO se incluyen chips como M4/M5, ni GB de RAM, ni almacenamiento, ni color).
    * Celulares: "iPhone 16 Pro Max", "Samsung Galaxy S24 Ultra", "Motorola Edge 50 Pro".
    * Electrodomésticos: "Nevera Electrolux Frost ERB163HB", "Lavadora LG Carga Frontal 22kg".
- 'brand': Marca oficial (ej: "Apple", "Samsung", "Motorola", "Electrolux", "Sony").
- 'category': Subcategoría oficial exacta del listado oficial.
- 'parentCategory': Categoría principal oficial ("Tecnologia", "Electrodomesticos", "Moda").
- 'genericSpecs': Ficha técnica común y compartida por TODOS los productos de esa familia con LLAVES EN MINÚSCULAS (ej: "procesador", "pantalla", "sistema_operativo", etc.).
  - Si una especificación es fija para toda la familia (por ejemplo, si toda la familia de este modelo usa el mismo procesador o pantalla), DEBE ir aquí.
- 'variantFields': Array con nombres de campos en MINÚSCULAS que diferencian a los productos dentro de la familia (ej: ["storage", "color"], ["color", "capacidad"], ["procesador", "storage", "color"]).
- REGLA DE EXCLUSIÓN MUTUA ESTRICTA: Ningún campo de 'variantFields' puede estar en 'genericSpecs'.

### 📦 2. PRODUCTO VARIANTE ('product')
- 'name': Nombre completo y preciso de la variante según la categoría.
  - REGLA PARA COMPUTADORES / LAPTOPS:
    * Formato: "{Familia} {Chip/Procesador} {Capacidad Almacenamiento} - {Color}"
    * Si la familia ya incluye el tipo de equipo, incluye el procesador/chip exacto de la variante:
      - Ejemplo: "MacBook Pro M5 14 pulgadas 512GB - Plata"
      - Ejemplo: "MacBook Pro M3 Pro 14 pulgadas 512GB - Negro Espacial"
      - Ejemplo: "MacBook Air M3 13 pulgadas 256GB - Medianoche"
    * NO amontones la RAM en el título (ej: NO pongas "16GB / 512GB"). El almacenamiento principal va en el título (ej: 512GB) y la RAM queda debidamente documentada en specs / variantSpecs.
  - REGLA PARA CELULARES Y TABLETS:
    * Formato: "{Familia} {Capacidad} - {Color}"
    * Ejemplo: "iPhone 16 Pro Max 256GB - Negro Titanio", "Samsung Galaxy S24 Ultra 512GB - Gris Titanio".
  - REGLA PARA ELECTRODOMÉSTICOS Y HOGAR:
    * Formato: "{Familia} {Capacidad} - {Color}" (o nombre técnico completo limpio).
- 'brand': Marca oficial.
- 'brandName': Marca oficial.
- 'model': Referencia técnica o SKU del fabricante si se deduce con certeza.
- 'description': Descripción comercial atractiva de 1 o 2 oraciones resaltando sus especificaciones principales y valor de mercado.
- 'category': Misma subcategoría oficial de la familia.
- 'parentCategory': Misma categoría principal.
- 'variantType': Array en minúsculas idéntico a las llaves de 'variantSpecs' (ej: ["storage", "color"] o ["procesador", "storage", "color"]).
- 'variantSpecs': Objeto que contiene ÚNICAMENTE las especificaciones diferenciales de este producto en particular con LLAVES EN MINÚSCULAS (ej: { "storage": "512GB", "color": "Plata" } o { "procesador": "Apple M5", "storage": "512GB", "color": "Plata" }).
  - REGLA CRÍTICA: NO incluyas aquí especificaciones que sean fijas en la familia.
- 'specs': Ficha técnica integral (unión de 'genericSpecs' y 'variantSpecs') con todas las LLAVES EN MINÚSCULAS y valores precisos (ej: "ram": "16GB", "storage": "512GB", "procesador": "Apple M5", "pantalla": "14.2 pulgadas Liquid Retina XDR", "color": "Plata").

### 📂 LISTADO OFICIAL DE CATEGORÍAS (Usar SOLO estos valores exactos)
1. Tecnologia (parentCategory: "Tecnologia"):
   - Subcategorías: "Celulares", "Computadores", "Tablets", "Tecnologia-Accesorios"
2. Electrodomesticos (parentCategory: "Electrodomesticos"):
   - Subcategorías: "Televisores", "Neveras", "Lavadoras", "Aires-Acondicionados", "Pequenos-Electrodomesticos"
3. Moda (parentCategory: "Moda"):
   - Subcategorías: "Infantil", "Dama", "Caballero", "Calzado"

# FORMATO DE RESPUESTA
Responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "family": {
    "familyName": "...",
    "brand": "...",
    "category": "...",
    "parentCategory": "...",
    "variantFields": ["storage", "color"],
    "genericSpecs": {
      "pantalla": "...",
      "sistema_operativo": "..."
    }
  },
  "product": {
    "name": "...",
    "category": "...",
    "parentCategory": "...",
    "brand": "...",
    "brandName": "...",
    "model": "...",
    "description": "...",
    "variantType": ["storage", "color"],
    "variantSpecs": {
      "storage": "512GB",
      "color": "Plata"
    },
    "specs": {
      "procesador": "...",
      "ram": "...",
      "storage": "512GB",
      "color": "Plata"
    }
  }
}`;

    const enrichedResult = await AIService.generateJSON(prompt, 'gemini-flash-lite-latest', { temperature: 0.2 });
    const cleanData = sanitizeEnrichedData(enrichedResult);

    return res.json({
      success: true,
      message: 'Producto enriquecido exitosamente con Gemini',
      data: cleanData
    });

  } catch (error) {
    console.error('[AIEnrichHandler] Error enriqueciendo producto con Gemini:', error);
    next(error);
  }
};
