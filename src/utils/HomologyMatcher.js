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
  // Excluimos explícitamente tokens de almacenamiento (como 512gb, 128gb, 1tb) y volumen (173l)
  const modelTokens = norm.split(' ').filter(token => {
    if (/^\d+(gb|tb|l|lt|lts|w|watts|pulg|pulgadas)$/.test(token)) {
      return false;
    }
    // Al menos 3 caracteres, contiene dígitos y letras
    return token.length >= 3 && /[0-9]/.test(token) && /[a-z]/.test(token);
  });
  if (modelTokens.length > 0) {
    attributes.models = modelTokens;
  }

  return attributes;
}

/**
 * Compara si dos tokens son equivalentes considerando plurales y singulares comunes en español (-s, -es).
 */
function areTokensEquivalent(t1 = '', t2 = '') {
  if (t1 === t2) return true;
  if (Math.abs(t1.length - t2.length) > 2) return false;

  const s1 = t1.endsWith('s') ? t1.slice(0, -1) : t1;
  const s2 = t2.endsWith('s') ? t2.slice(0, -1) : t2;
  if (s1 === s2 || s1 === t2 || t1 === s2) return true;

  const es1 = t1.endsWith('es') ? t1.slice(0, -2) : t1;
  const es2 = t2.endsWith('es') ? t2.slice(0, -2) : t2;
  if (es1 === es2 || es1 === t2 || t1 === es2) return true;

  return false;
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

  // 1.1 REGLA DE EXCLUSIÓN POR TIPO DE DISPOSITIVO CRUZADO
  // Familias incompatibles (si la base pertenece a una familia, el candidato no puede pertenecer a otra)
  const CROSS_DEVICE_FAMILIES = [
    { family: 'computadores', types: ['laptop', 'portatil', 'portátil', 'computador', 'computadores', 'macbook'] },
    { family: 'tablets', types: ['tablet', 'tablets', 'tab', 'ipad'] },
    { family: 'celulares', types: ['celular', 'celulares', 'smartphone', 'smartphones', 'telefono', 'teléfono', 'telefonos', 'teléfonos'] },
    { family: 'smartwatches', types: ['smartwatch', 'smartwatches', 'reloj inteligente'] },
    { family: 'audifonos', types: ['audifonos', 'audífonos', 'airpods', 'auriculares'] },
    { family: 'linea_blanca', types: ['nevera', 'neveras', 'refrigerador', 'refrigeradores', 'lavadora', 'lavadoras', 'secadora', 'secadoras'] }
  ];

  const baseCatClean = cleanString(base.category || '');
  const combinedBase = `${baseNorm} ${baseCatClean}`;

  for (const group of CROSS_DEVICE_FAMILIES) {
    const isBaseInFamily = group.types.some(t => new RegExp(`\\b${t}\\b`, 'i').test(combinedBase));
    if (isBaseInFamily) {
      // Si la base es de una familia (ej: celular), no puede aparecer una palabra de otra familia distinta (ej: tablet)
      for (const otherGroup of CROSS_DEVICE_FAMILIES) {
        if (otherGroup.family !== group.family) {
          for (const forbiddenType of otherGroup.types) {
            const forbiddenRegex = new RegExp(`\\b${forbiddenType}\\b`, 'i');
            if (forbiddenRegex.test(candNorm) && !forbiddenRegex.test(baseNorm)) {
              return {
                score: 0,
                isMatch: false,
                reasons: [`Descartado: tipo de producto no coincide (${group.family} vs ${forbiddenType})`]
              };
            }
          }
        }
      }
    }
  }

  // 1.2 REGLA DE SUB-MODELO (ej. Pro vs Pro Max, Plus vs Mini, Ultra vs Base)
  const SUB_MODELS = ['pro max', 'pro', 'max', 'plus', 'mini', 'ultra', 'fe'];
  const baseSubModels = SUB_MODELS.filter(sm => new RegExp(`\\b${sm}\\b`, 'i').test(baseNorm));
  const candSubModels = SUB_MODELS.filter(sm => new RegExp(`\\b${sm}\\b`, 'i').test(candNorm));

  if (baseSubModels.length > 0) {
    const baseBestSub = baseSubModels[0]; // ej: "pro max"
    const candBestSub = candSubModels[0] || '';
    if (baseBestSub !== candBestSub) {
      return {
        score: 0,
        isMatch: false,
        reasons: [`Descartado: variante de modelo no coincide (base=${baseBestSub} vs cand=${candBestSub || 'estándar'})`]
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

  // Modelo alfanumérico coincidente (o contenido, ej. "bu8000" dentro de "un55bu8000", o serie numérica compartida ej. 8000)
  if (baseAttrs.models && candAttrs.models) {
    const commonModels = baseAttrs.models.filter(m => 
      candAttrs.models.some(cm => {
        if (cm === m || cm.includes(m) || m.includes(cm)) return true;
        // Comparación de series numéricas de al menos 3 o 4 dígitos (ej. "8000" en "55u8000h" y "bu8000")
        const numM = m.match(/\d{3,}/);
        const numCm = cm.match(/\d{3,}/);
        return numM && numCm && numM[0] === numCm[0];
      })
    );
    if (commonModels.length > 0) {
      score += 35;
      reasons.push(`Modelo o serie coincidente: ${commonModels.join(', ')}`);
    }
  }

  // 4. MARCA
  const candBrand = cleanString(candidate.brand || candidate.brandName || '');
  if (base.brand) {
    const brandClean = cleanString(base.brand);
    if (brandClean && (candNorm.includes(brandClean) || candBrand.includes(brandClean))) {
      score += 20;
      reasons.push(`Marca coincidente: ${base.brand}`);
    }
  }

  // 5. SIMILITUD DE TOKENS (Jaccard / Coincidencia de Palabras)
  const stopWords = new Set(['de', 'la', 'el', 'en', 'para', 'con', 'y', 'los', 'las', 'un', 'una', 'frost', 'no', 'inferior', 'superior']);
  const baseTokens = baseNorm.split(' ').filter(t => t.length > 2 && !stopWords.has(t));
  const candTokens = new Set(candNorm.split(' ').filter(t => t.length > 2 && !stopWords.has(t)));

  let tokenMatchRatio = 0;
  if (baseTokens.length > 0) {
    let matchedTokens = 0;
    const candTokensArray = Array.from(candTokens);
    for (const token of baseTokens) {
      const found = candTokens.has(token) || candTokensArray.some(ct => areTokensEquivalent(token, ct));
      if (found) {
        matchedTokens++;
      }
    }
    tokenMatchRatio = matchedTokens / baseTokens.length;
    const tokenPoints = Math.round(tokenMatchRatio * 35);
    score += tokenPoints;
    reasons.push(`Coincidencia léxica: ${Math.round(tokenMatchRatio * 100)}% (+${tokenPoints} pts)`);
  }

  // 6. DETECCIÓN EN BÚSQUEDA ABIERTA (Live Search sin producto base en catálogo)
  // Cuando es una búsqueda directa del usuario (basePrice === 0 o sin marca base),
  // y todos los términos principales buscados están presentes en el título del candidato
  const isOpenSearch = (!basePrice || basePrice <= 0) && (!base.brand || base.brand.trim() === '');
  if (isOpenSearch && tokenMatchRatio >= 0.95 && baseTokens.length > 0) {
    // Si contiene el 100% de las palabras clave buscadas, se considera coincidencia directa
    score += 35;
    reasons.push('Búsqueda abierta: coincidencia total de términos de búsqueda (+35 pts)');
  }

  // Normalizar score entre 0 y 100
  const finalScore = Math.max(0, Math.min(100, score));
  // Si es búsqueda abierta con coincidencia completa, el umbral es más flexible (>= 50)
  const threshold = (isOpenSearch && tokenMatchRatio >= 0.95) ? 50 : 65;
  const isMatch = finalScore >= threshold; // Umbral de aceptación homóloga

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
