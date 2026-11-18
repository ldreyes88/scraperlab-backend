/**
 * Utilitario de scoring y homologación lógica para Hunter
 * Determina si un producto encontrado en un marketplace es homólogo al producto base.
 */

// Palabras de ruido o accesorios que descalifican inmediatamente
const ACCESSORY_KEYWORDS = [
  'funda', 'forro', 'protector', 'repuesto', 'accesorio', 'accesorios', 'soporte',
  'cable', 'cargador', 'adaptador', 'filtro', 'manual', 'tapa', 'bandeja', 'repisa',
  'control remoto', 'bateria', 'estuche', 'vidrio templado', 'mica', 'correa', 'manilla',
  'motor', 'tubo', 'manguera', 'resistencia', 'termostato', 'valvula', 'empaque'
];

/**
 * Normaliza cadenas de texto eliminando acentos, caracteres especiales y puntuación.
 */
function cleanString(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae especificaciones numéricas clave (ej. 173 litros, 128 gb, 55 pulgadas, 4k, etc.)
 */
function extractAttributes(text = '') {
  const norm = cleanString(text);
  const attributes = {};

  // Capacidad de almacenamiento o memoria (GB / TB)
  const memMatch = norm.match(/(\d+)\s*(gb|tb)\b/);
  if (memMatch) attributes.storage = `${memMatch[1]}${memMatch[2]}`;

  // Volumen / Capacidad (Litros / Lts / L)
  const volMatch = norm.match(/(\d+)\s*(litros|litro|lts|lt|l)\b/);
  if (volMatch) attributes.volume = `${volMatch[1]}l`;

  // Pulgadas (pantallas / televisores)
  const inchMatch = norm.match(/(\d+)\s*(pulgadas|pulgada|pulg)\b/);
  if (inchMatch) attributes.inches = `${inchMatch[1]}`;

  // Potencia (Watts / W)
  const wattMatch = norm.match(/(\d+)\s*(watts|watt|w)\b/);
  if (wattMatch) attributes.watts = `${wattMatch[1]}w`;

  // Identificadores alfanuméricos de modelo (ej. VT40SPM, ERTS17G2HKS, S24, A16, etc.)
  const modelTokens = norm.split(' ').filter(token => {
    // Al menos 3 caracteres, contiene dígitos y letras
    return token.length >= 3 && /[0-9]/.test(token) && /[a-z]/.test(token);
  });
  if (modelTokens.length > 0) {
    attributes.models = modelTokens;
  }

  return attributes;
}

/**
 * Calcula un score de 0 a 100 de compatibilidad entre el producto base y el candidato.
 * 
 * @param {Object} base - { name, price, brand, category }
 * @param {Object} candidate - { title/name, price, marketplace }
 * @returns {Object} { score: number, isMatch: boolean, reasons: string[] }
 */
function calculateHomologyScore(base = {}, candidate = {}) {
  const baseName = base.name || '';
  const candName = candidate.title || candidate.name || '';
  const baseNorm = cleanString(baseName);
  const candNorm = cleanString(candName);

  const reasons = [];

  // 1. REGLA DE EXCLUSIÓN INMEDIATA: Accesorios o Repuestos
  // Si el candidato tiene palabra de accesorio y el base NO la tiene en su nombre
  for (const acc of ACCESSORY_KEYWORDS) {
    const accRegex = new RegExp(`\\b${acc}\\b`, 'i');
    if (accRegex.test(candNorm) && !accRegex.test(baseNorm)) {
      return {
        score: 0,
        isMatch: false,
        reasons: [`Descartado: contiene palabra de accesorio/repuesto ("${acc}")`]
      };
    }
  }

  // 2. REGLA DE EXCLUSIÓN POR PRECIO:
  // Si el precio del candidato es menor al 25% o mayor al 350% del producto base (cuando basePrice existe y es razonable > 10.000 COP)
  const basePrice = Number(base.price || base.currentPrice || base.originalPrice || 0);
  const candPrice = Number(candidate.price || candidate.currentPrice || 0);

  if (basePrice > 10000 && candPrice > 0) {
    const ratio = candPrice / basePrice;
    if (ratio < 0.25) {
      return {
        score: 10,
        isMatch: false,
        reasons: [`Descartado: precio anormalmente bajo (${candPrice} vs base ${basePrice})`]
      };
    }
    if (ratio > 3.5) {
      return {
        score: 15,
        isMatch: false,
        reasons: [`Descartado: precio anormalmente alto (${candPrice} vs base ${basePrice})`]
      };
    }
  }

  let score = 0;

  // 3. ATRIBUTOS NUMÉRICOS TÉCNICOS (Volumen, Almacenamiento, Pulgadas)
  const baseAttrs = extractAttributes(baseName);
  const candAttrs = extractAttributes(candName);

  // Almacenamiento (GB/TB)
  if (baseAttrs.storage && candAttrs.storage) {
    if (baseAttrs.storage === candAttrs.storage) {
      score += 25;
      reasons.push(`Almacenamiento idéntico: ${baseAttrs.storage}`);
    } else {
      score -= 40; // Penalización severa por variante de capacidad distinta
      reasons.push(`Almacenamiento no coincide: base=${baseAttrs.storage} vs cand=${candAttrs.storage}`);
    }
  }

  // Capacidad de volumen (Litros)
  if (baseAttrs.volume && candAttrs.volume) {
    if (baseAttrs.volume === candAttrs.volume) {
      score += 25;
      reasons.push(`Volumen idéntico: ${baseAttrs.volume}`);
    } else {
      score -= 35;
      reasons.push(`Volumen no coincide: base=${baseAttrs.volume} vs cand=${candAttrs.volume}`);
    }
  }

  // Pulgadas
  if (baseAttrs.inches && candAttrs.inches) {
    if (baseAttrs.inches === candAttrs.inches) {
      score += 25;
      reasons.push(`Pulgadas idénticas: ${baseAttrs.inches}"`);
    } else {
      score -= 35;
      reasons.push(`Pulgadas no coinciden: base=${baseAttrs.inches} vs cand=${candAttrs.inches}`);
    }
  }

  // Modelo alfanumérico coincidente
  if (baseAttrs.models && candAttrs.models) {
    const commonModels = baseAttrs.models.filter(m => candAttrs.models.includes(m));
    if (commonModels.length > 0) {
      score += 35;
      reasons.push(`Modelo exacto encontrado: ${commonModels.join(', ')}`);
    }
  }

  // 4. MARCA
  if (base.brand) {
    const brandClean = cleanString(base.brand);
    if (brandClean && candNorm.includes(brandClean)) {
      score += 20;
      reasons.push(`Marca coincidente: ${base.brand}`);
    }
  }

  // 5. SIMILITUD DE TOKENS (Jaccard / Coincidencia de Palabras)
  const stopWords = new Set(['de', 'la', 'el', 'en', 'para', 'con', 'y', 'los', 'las', 'un', 'una', 'frost', 'no', 'inferior', 'superior']);
  const baseTokens = baseNorm.split(' ').filter(t => t.length > 2 && !stopWords.has(t));
  const candTokens = new Set(candNorm.split(' ').filter(t => t.length > 2 && !stopWords.has(t)));

  if (baseTokens.length > 0) {
    let matchedTokens = 0;
    for (const token of baseTokens) {
      if (candTokens.has(token)) {
        matchedTokens++;
      }
    }
    const tokenMatchRatio = matchedTokens / baseTokens.length;
    const tokenPoints = Math.round(tokenMatchRatio * 35);
    score += tokenPoints;
    reasons.push(`Coincidencia léxica: ${Math.round(tokenMatchRatio * 100)}% (+${tokenPoints} pts)`);
  }

  // Normalizar score entre 0 y 100
  const finalScore = Math.max(0, Math.min(100, score));
  const isMatch = finalScore >= 65; // Umbral de aceptación homóloga

  return {
    score: finalScore,
    isMatch,
    reasons
  };
}

module.exports = {
  calculateHomologyScore,
  extractAttributes,
  cleanString
};
