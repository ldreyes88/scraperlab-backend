// scraperlab-backend/src/strategies/domain/automercado.cr/AutoMercadoSearchSpecificStrategy.js

const BaseDomainStrategy = require('../BaseDomainStrategy');
const cheerio = require('cheerio');

/**
 * Estrategia para AutoMercado Costa Rica
 * Busca productos y valida el primer resultado contra criterios de factura
 */
class AutoMercadoSearchSpecificStrategy extends BaseDomainStrategy {
  async scrape(url, domainConfig = {}) {
    // Extraer parámetros de la URL (pasados desde el cliente)
    const urlObj = new URL(url);
    const searchTerm = urlObj.searchParams.get('q');          // "SALCHICHA SUST BEY"
    const expectedWeight = urlObj.searchParams.get('weight'); // "400 g"
    const expectedPrice = urlObj.searchParams.get('price');   // "10950"
    
    console.log('[AutoMercado] Iniciando búsqueda:');
    console.log(`  Término: "${searchTerm}"`);
    console.log(`  Peso esperado: ${expectedWeight}`);
    console.log(`  Precio esperado: ₡${expectedPrice}`);
    
    try {
      // 1. Construir URL de búsqueda SOLO con el parámetro 'q'
      // AutoMercado NO acepta parámetros weight y price en la URL
      const searchUrl = `${urlObj.origin}${urlObj.pathname}?q=${encodeURIComponent(searchTerm)}`;
      console.log(`[AutoMercado] URL de búsqueda: ${searchUrl}`);
      
      // 2. Obtener HTML de búsqueda usando la configuración de BD
      // Si no hay providerConfig, se usarán los defaults del provider
      const html = await this.fetchHtml(searchUrl, domainConfig.providerConfig || {});
      
      const $ = cheerio.load(html);
      
      // 2. Obtener los primeros 5 resultados
      const productCards = $('.card-product').slice(0, 10);
      
      if (productCards.length === 0) {
        throw new Error('No se encontraron resultados de búsqueda');
      }
      
      console.log(`[AutoMercado] Encontrados ${productCards.length} resultados para analizar`);
      
      // 3. Analizar cada producto y calcular su score
      const candidates = [];
      
      productCards.each((index, element) => {
        const card = $(element);
        
        // Extraer datos del producto
        const title = card.find('.title-product').text().trim();
        const priceText = card.find('.text-currency.h5-am').text().trim();
        const weightText = card.find('.text-subtitle.med-gray-text').text().trim();
        const productUrl = card.find('.title-product').attr('href');
        const imageUrl = card.find('.img-product img').attr('src');
        
        // Limpiar precio: "₡10,950" → 10950
        const actualPrice = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
        
        // Calcular score de validación
        const validation = this.validateFirstResult({
          title,
          actualPrice,
          weightText
        }, {
          searchTerm,
          expectedWeight,
          expectedPrice: parseInt(expectedPrice) || 0
        });
        
        console.log(`[AutoMercado] Resultado #${index + 1}:`);
        console.log(`  Título: ${title}`);
        console.log(`  Precio: ₡${actualPrice}`);
        console.log(`  Peso: ${weightText}`);
        console.log(`  Score: ${validation.scoreTotal}/100 (${validation.confidence})`);
        
        candidates.push({
          title,
          actualPrice,
          weightText,
          productUrl,
          imageUrl,
          validation,
          index: index + 1
        });
      });
      
      // 4. Ordenar por score descendente y tomar el mejor
      candidates.sort((a, b) => b.validation.scoreTotal - a.validation.scoreTotal);
      const bestMatch = candidates[0];
      
      console.log('\n[AutoMercado] Mejor match seleccionado:');
      console.log(`  Posición original: #${bestMatch.index}`);
      console.log(`  Título: ${bestMatch.title}`);
      console.log(`  Score Total: ${bestMatch.validation.scoreTotal}/100 (${bestMatch.validation.confidence})`);
      console.log(`  - Similitud texto: ${bestMatch.validation.textScore}/35`);
      console.log(`  - Match gramaje: ${bestMatch.validation.weightMatch ? '✓' : '✗'} (${bestMatch.validation.weightScore}/35)`);
      console.log(`  - Match precio: ${bestMatch.validation.priceMatch ? '✓' : '✗'} (${bestMatch.validation.priceScore}/30)`);
      
      // 5. Determinar si el match es aceptable (umbral mínimo: 60)
      const success = bestMatch.validation.scoreTotal >= 60;
      
      if (!success) {
        console.warn('[AutoMercado] ⚠️ Score bajo, match no confiable');
      }
      
      // 6. Retornar resultado con score
      return this.formatSearchSpecificResponse({
        success,
        marketplace: 'AutoMercado',
        currentPrice: bestMatch.actualPrice,
        originalPrice: bestMatch.actualPrice,
        title: bestMatch.title,
        image: bestMatch.imageUrl || '',
        productUrl: bestMatch.productUrl ? `https://automercado.cr${bestMatch.productUrl}` : '',
        method: `Top-5-Best-Match (Score: ${bestMatch.validation.scoreTotal}, Position: #${bestMatch.index})`,
        url,
        metadata: {
          validation: bestMatch.validation,
          searchCriteria: {
            searchTerm,
            expectedWeight,
            expectedPrice
          },
          analyzedResults: candidates.length,
          allCandidates: candidates.map(c => ({
            position: c.index,
            title: c.title,
            price: c.actualPrice,
            score: c.validation.scoreTotal
          }))
        }
      });
      
    } catch (error) {
      console.error('[AutoMercado] Error:', error.message);
      return this.formatSearchSpecificResponse({
        success: false,
        marketplace: 'AutoMercado',
        error: error.message,
        method: 'Error',
        url
      });
    }
  }

  /**
   * Validación de primer resultado con 3 criterios
   * @returns {Object} - { scoreTotal, textScore, weightScore, priceScore, confidence }
   */
  validateFirstResult(actual, expected) {
    // 1. SIMILITUD DE TEXTO (35 puntos)
    const textScore = this.calculateTextSimilarity(
      expected.searchTerm || '',
      actual.title || ''
    );
    
    // 2. MATCH DE GRAMAJE (35 puntos)
    const weightValidation = this.validateWeight(
      actual.weightText || '',
      expected.expectedWeight || ''
    );
    
    // 3. MATCH DE PRECIO (30 puntos)
    const priceValidation = this.validatePrice(
      actual.actualPrice || 0,
      expected.expectedPrice || 0
    );
    
    // Score total
    const scoreTotal = textScore + weightValidation.score + priceValidation.score;
    
    // Determinar nivel de confianza
    let confidence = 'BAJA';
    if (scoreTotal >= 80) confidence = 'ALTA';
    else if (scoreTotal >= 60) confidence = 'MEDIA';
    
    return {
      scoreTotal: Math.round(scoreTotal),
      textScore: Math.round(textScore),
      weightScore: Math.round(weightValidation.score),
      weightMatch: weightValidation.match,
      priceScore: Math.round(priceValidation.score),
      priceMatch: priceValidation.match,
      confidence
    };
  }

  /**
   * 1. Similitud de texto (con manejo de abreviaciones)
   * Retorna score sobre 35 puntos
   */
  calculateTextSimilarity(searchTerm, productTitle) {
    const normalized1 = this.normalizeText(searchTerm);
    const normalized2 = this.normalizeText(productTitle);
    
    // Dividir en palabras
    const words1 = normalized1.split(/\s+/).filter(w => w.length > 0);
    const words2 = normalized2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0) return 0;
    
    // Contar coincidencias
    let matches = 0;
    for (const word1 of words1) {
      // Buscar coincidencia exacta o parcial
      const found = words2.some(word2 => 
        word2.includes(word1) || 
        word1.includes(word2) || 
        this.areSimilarWords(word1, word2)
      );
      if (found) matches++;
    }
    
    // Porcentaje de coincidencia sobre 35 puntos
    const similarity = matches / words1.length;
    return similarity * 35;
  }

  /**
   * Normalizar texto (expandir abreviaciones comunes de AutoMercado)
   */
  normalizeText(text) {
    let normalized = text.toLowerCase().trim();
    
    // Diccionario de abreviaciones de facturas de AutoMercado
    const abbreviations = {
      'sust': 'sustentable',
      'bey': 'beyond',
      'sazuc': 'sazón',
      'c.cola': 'coca cola',
      'c cola': 'coca cola',
      'tof': 'tofu',
      'susi': 'sushi',
      'bev': 'beverage',
      'lav': 'lavador',
      'cre': 'cremoso',
      'lim': 'limón',
      'axio': 'axion',
      'beyo': 'bimbo',
      'ener': 'energizante',
      'monstrum': 'monster',
      'elect': 'eléctrico',
      'hid': 'hidratante',
      'ama': 'amarillo',
      'manteq': 'mantequilla',
      'dp': 'dos pinos',
      'gas': 'gaseosa',
      'nat': 'natural',
      'cristal': 'cristal'
    };
    
    // Expandir abreviaciones
    Object.keys(abbreviations).forEach(abbr => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      normalized = normalized.replace(regex, abbreviations[abbr]);
    });
    
    return normalized;
  }

  /**
   * Verificar si dos palabras son similares (para typos o variantes)
   */
  areSimilarWords(word1, word2) {
    // Palabras muy cortas deben ser iguales
    if (word1.length <= 3 || word2.length <= 3) {
      return word1 === word2;
    }
    
    // Calcular distancia de Levenshtein
    const maxLen = Math.max(word1.length, word2.length);
    const distance = this.levenshteinDistance(word1, word2);
    
    // Permitir hasta 20% de diferencia
    return distance / maxLen <= 0.2;
  }

  /**
   * 2. Validación de gramaje
   * Retorna { match: boolean, score: number (0-35) }
   */
  validateWeight(actualWeightText, expectedWeight) {
    if (!expectedWeight || !actualWeightText) {
      return { match: false, score: 0 };
    }
    
    // Extraer valor numérico y unidad del texto actual
    // "bandeja 400 g" → 400, "g"
    const actualMatch = actualWeightText.match(/(\d+)\s*(g|kg|ml|l|unid?)/i);
    if (!actualMatch) {
      return { match: false, score: 0 };
    }
    
    const actualValue = parseInt(actualMatch[1]);
    const actualUnit = actualMatch[2].toLowerCase();
    
    // Extraer valor esperado
    // "400 g" → 400, "g"
    const expectedMatch = expectedWeight.match(/(\d+)\s*(g|kg|ml|l|unid?)/i);
    if (!expectedMatch) {
      return { match: false, score: 0 };
    }
    
    const expectedValue = parseInt(expectedMatch[1]);
    const expectedUnit = expectedMatch[2].toLowerCase();
    
    // Las unidades deben coincidir
    if (actualUnit !== expectedUnit) {
      return { match: false, score: 0 };
    }
    
    // Calcular diferencia porcentual
    const diff = Math.abs(actualValue - expectedValue);
    const percentDiff = expectedValue > 0 ? diff / expectedValue : 1;
    
    // Match exacto = 35 puntos
    if (diff === 0) {
      return { match: true, score: 35 };
    }
    
    // Tolerancia de ±10%
    if (percentDiff <= 0.10) {
      // 30-35 puntos según cercanía
      const score = 35 - (percentDiff * 50);
      return { match: true, score: Math.max(30, score) };
    }
    
    // Fuera de tolerancia pero cercano (±20%)
    if (percentDiff <= 0.20) {
      const score = 20 - (percentDiff * 50);
      return { match: false, score: Math.max(0, score) };
    }
    
    // Muy diferente
    return { match: false, score: 0 };
  }

  /**
   * 3. Validación de precio
   * Retorna { match: boolean, score: number (0-30) }
   */
  validatePrice(actualPrice, expectedPrice) {
    if (!expectedPrice || !actualPrice) {
      return { match: false, score: 0 };
    }
    
    // Calcular diferencia porcentual
    const diff = Math.abs(actualPrice - expectedPrice);
    const percentDiff = expectedPrice > 0 ? diff / expectedPrice : 1;
    
    // Match exacto = 30 puntos
    if (diff === 0) {
      return { match: true, score: 30 };
    }
    
    // Tolerancia de ±5% (por promociones, cambios de precio)
    if (percentDiff <= 0.05) {
      const score = 30 - (percentDiff * 100);
      return { match: true, score: Math.max(25, score) };
    }
    
    // ±10% = score reducido pero aceptable
    if (percentDiff <= 0.10) {
      const score = 25 - (percentDiff * 100);
      return { match: false, score: Math.max(15, score) };
    }
    
    // ±20% = score muy bajo
    if (percentDiff <= 0.20) {
      const score = 15 - (percentDiff * 50);
      return { match: false, score: Math.max(0, score) };
    }
    
    // Fuera de tolerancia
    return { match: false, score: 0 };
  }

  /**
   * Distancia de Levenshtein (para similitud de palabras)
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,  // substitution
            matrix[i][j - 1] + 1,      // insertion
            matrix[i - 1][j] + 1       // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = AutoMercadoSearchSpecificStrategy;
