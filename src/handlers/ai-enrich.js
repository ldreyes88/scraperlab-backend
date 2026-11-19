const AIService = require('../services/AIService');

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
Actúa como Arquitecto de Datos e Ingeniero de Catálogo experto de Oferty.
Tu objetivo es analizar un producto existente que fue capturado de forma preliminar y enriquecerlo/recomponerlo al estándar estricto de Oferty.

# DATOS DEL PRODUCTO A ANALIZAR
- Nombre recibido: "${prodName}"
- Marca actual: "${prodBrand}"
- Categoría actual: "${prodCategory}"
- Imagen/URL contexto: "${prodImage}"
- Contexto de tiendas/precios: "${mpSummary}"

# REGLAS DEL ESTÁNDAR OFERTY
1. FAMILIA ('family'):
   - 'familyName': Nombre comercial base limpio de la línea o modelo SIN capacidades, colores ni variantes (ej: "Nevera Electrolux Frost ERB163HB", "iPhone 16 Pro Max", "Samsung Galaxy S24 Ultra", "Lavadora LG Carga Frontal 22kg").
   - 'brand': Marca oficial (ej: "Electrolux", "Samsung", "Apple", "LG").
   - 'category': Subcategoría oficial (Ver listado abajo).
   - 'parentCategory': Categoría principal ("Tecnologia", "Electrodomesticos", "Moda").
   - 'genericSpecs': Ficha técnica común y compartida por TODOS los productos de la familia con LLAVES EN MINÚSCULAS (ej: procesador, garantia, tecnologia, tipo_congelador, etc.).
   - 'variantFields': Array en MINÚSCULAS con los atributos que varían entre productos de la familia (ej: ["color", "capacidad"] o ["color", "storage", "ram"]).
   - REGLA DE EXCLUSIÓN: Ningún campo de 'variantFields' puede estar en 'genericSpecs'.

2. PRODUCTO ('product'):
   - 'name': Formato estricto de Oferty: "{Familia} {Capacidad/Talla} - {Color}". Si no aplica color o capacidad, usar el nombre comercial limpio completo.
   - 'category': Misma subcategoría oficial de la familia.
   - 'parentCategory': Misma categoría principal.
   - 'brand': Marca oficial.
   - 'brandName': Marca oficial.
   - 'description': Descripción comercial atractiva de 1 o 2 oraciones resaltando sus beneficios y especificaciones principales en Colombia.
   - 'variantType': Array en minúsculas idéntico a las llaves de 'variantSpecs' (ej: ["capacidad", "color"]).
   - 'variantSpecs': Objeto que contiene ÚNICAMENTE las especificaciones diferenciales de este producto en particular con LLAVES EN MINÚSCULAS (ej: { "capacidad": "173 litros", "color": "Negro" }).
   - 'specs': Ficha técnica integral (unión de 'genericSpecs' y 'variantSpecs') con todas las LLAVES EN MINÚSCULAS y valores precisos.

# LISTADO OFICIAL DE CATEGORÍAS
1. Tecnologia (parentCategory: "Tecnologia"): "Celulares", "Computadores", "Tablets", "Tecnologia-Accesorios"
2. Electrodomesticos (parentCategory: "Electrodomesticos"): "Televisores", "Neveras", "Lavadoras", "Aires-Acondicionados", "Pequenos-Electrodomesticos"
3. Moda (parentCategory: "Moda"): "Infantil", "Dama", "Caballero", "Calzado"

# FORMATO DE RESPUESTA
Responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "family": {
    "familyName": "...",
    "brand": "...",
    "category": "...",
    "parentCategory": "...",
    "variantFields": [...],
    "genericSpecs": { ... }
  },
  "product": {
    "name": "...",
    "category": "...",
    "parentCategory": "...",
    "brand": "...",
    "brandName": "...",
    "description": "...",
    "variantType": [...],
    "variantSpecs": { ... },
    "specs": { ... }
  }
}`;

    const enrichedResult = await AIService.generateJSON(prompt, 'gemini-flash-lite-latest', { temperature: 0.3 });

    return res.json({
      success: true,
      message: 'Producto enriquecido exitosamente con Gemini',
      data: enrichedResult
    });

  } catch (error) {
    console.error('[AIEnrichHandler] Error enriqueciendo producto con Gemini:', error);
    next(error);
  }
};
