/**
 * Sanitizador de inputs de facturas de AutoMercado
 * Extrae: término de búsqueda, gramaje y precio
 */
class AutoMercadoInputSanitizer {
  /**
   * Extrae solo el nombre del producto, sin gramaje ni precio
   * @param {string} receiptLine - Línea de factura completa
   * @returns {Object} - { searchTerm, weight, weightValue, unit, price, original }
   * 
   * @example
   * Input: "SALCHICHA SUST BEY 400 g  10.950,00 G"
   * Output: {
   *   searchTerm: "SALCHICHA SUST BEY",
   *   weight: "400 g",
   *   weightValue: 400,
   *   unit: "g",
   *   price: 10950,
   *   original: "SALCHICHA SUST BEY 400 g  10.950,00 G"
   * }
   */
  static sanitize(receiptLine) {
    let text = receiptLine.trim();
    
    // 1. Extraer precio (al final, antes de "G" o solo)
    // Patrones: "10.950,00 G", "10.950", "10950", "1.560,00 G", "5000 G"
    const priceMatch = text.match(/(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*G?\s*$/i);
    let price = 0;
    
    if (priceMatch) {
      // Remover todos los separadores
      let priceStr = priceMatch[1].replace(/[.,]/g, '');
      
      // Si el número original tenía puntos/comas, verificar si son decimales
      if (priceMatch[1].includes(',') || priceMatch[1].includes('.')) {
        const parts = priceMatch[1].split(/[.,]/);
        // Si la última parte tiene 2 dígitos, son decimales
        if (parts[parts.length - 1].length === 2) {
          priceStr = priceStr.slice(0, -2);
        }
      }
      
      price = parseInt(priceStr) || 0;
      
      // Remover precio del texto
      text = text.substring(0, priceMatch.index).trim();
    }
    
    // 2. Extraer gramaje/volumen al final
    // Patrones: "400 g", "2500 ml", "115 g", "1000 ml"
    const weightMatch = text.match(/(\d+)\s*(g|kg|ml|l|unid?)\s*$/i);
    let weight = null;
    let weightValue = null;
    let unit = null;
    
    if (weightMatch) {
      weightValue = parseInt(weightMatch[1]);
      unit = weightMatch[2].toLowerCase();
      weight = `${weightValue} ${unit}`;
      
      // Remover gramaje del texto
      text = text.replace(weightMatch[0], '').trim();
    }
    
    // 3. El texto restante es el término de búsqueda
    const searchTerm = text.trim();
    
    return {
      searchTerm,      // "SALCHICHA SUST BEY"
      weight,          // "400 g"
      weightValue,     // 400
      unit,            // "g"
      price,           // 10950
      original: receiptLine
    };
  }

  /**
   * Validar que el input tiene los datos mínimos necesarios
   */
  static validate(sanitized) {
    const errors = [];
    
    if (!sanitized.searchTerm || sanitized.searchTerm.length < 3) {
      errors.push('El término de búsqueda es muy corto o está vacío');
    }
    
    if (!sanitized.weight) {
      errors.push('No se detectó gramaje/volumen');
    }
    
    if (!sanitized.price || sanitized.price === 0) {
      errors.push('No se detectó precio válido');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Crear URL de búsqueda con parámetros
   */
  static buildSearchUrl(sanitized, baseUrl = 'https://automercado.cr/buscar') {
    const params = new URLSearchParams({
      q: sanitized.searchTerm,
      weight: sanitized.weight || '',
      price: sanitized.price || ''
    });
    
    return `${baseUrl}?${params.toString()}`;
  }
}

module.exports = AutoMercadoInputSanitizer;
