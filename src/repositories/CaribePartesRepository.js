// src/repositories/CaribePartesRepository.js
const { dynamoDB, TABLES } = require('../config/database');
const { ScanCommand, BatchWriteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class CaribePartesRepository {
  /**
   * Carga masiva por lotes de 25 items en DynamoDB
   */
  static async batchWrite(items = []) {
    const TABLE_NAME = TABLES.CARIBE_PARTES_PRODUCTS;
    const CHUNK_SIZE = 25;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const putRequests = chunk.map(item => ({
        PutRequest: {
          Item: item
        }
      }));

      let params = {
        RequestItems: {
          [TABLE_NAME]: putRequests
        }
      };

      let retries = 0;
      do {
        const response = await dynamoDB.send(new BatchWriteCommand(params));
        const unprocessed = response.UnprocessedItems?.[TABLE_NAME];
        if (unprocessed && unprocessed.length > 0) {
          retries++;
          await new Promise(res => setTimeout(res, 200 * retries));
          params = {
            RequestItems: {
              [TABLE_NAME]: unprocessed
            }
          };
        } else {
          break;
        }
      } while (retries < 5);
    }
  }

  /**
   * Búsqueda por código exacto o limpio
   */
  static async getByCode(code) {
    if (!code) return [];
    const clean = code.replace(/[^a-zA-Z0-9]/g, '');
    const TABLE_NAME = TABLES.CARIBE_PARTES_PRODUCTS;

    try {
      const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `PART#${clean}`,
          ':sk': 'METADATA'
        }
      }));
      return result.Items || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Normaliza y obtiene la raíz (lema) en español
   */
  static normalizeAndStem(word) {
    if (!word) return '';
    let w = word.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (w.endsWith('as') || w.endsWith('os') || w.endsWith('es')) {
      if (w.endsWith('es')) w = w.slice(0, -2);
      else w = w.slice(0, -1);
    }
    return w;
  }

  /**
   * Extrae los términos vehiculares y de repuesto con alta prioridad semántica
   */
  static extractMeaningfulTerms(text) {
    const conversationalNoise = new Set([
      'cuanto', 'cuanta', 'cuantos', 'cuantas', 'salen', 'sale', 'vale', 'valen',
      'cuesta', 'cuestan', 'precio', 'costo', 'valor', 'buenas', 'tardes', 'dias',
      'noches', 'hola', 'amigo', 'favor', 'porfa', 'tienes', 'tienen', 'habra',
      'hay', 'necesito', 'busco', 'para', 'con', 'del', 'los', 'las', 'un', 'una',
      'unos', 'unas', 'que', 'como', 'donde', 'cuando', 'quien', 'por', 'sobre'
    ]);

    const words = (text || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !conversationalNoise.has(w));

    return Array.from(new Set(words.map(w => this.normalizeAndStem(w)).filter(w => w.length >= 2)));
  }

  /**
   * Búsqueda inteligente iterando páginas completas hasta recolectar candidatos relevantes
   */
  static async searchProducts({ query = '', vehicle = '', partType = '', limit = 5 }) {
    const TABLE_NAME = TABLES.CARIBE_PARTES_PRODUCTS;

    // Extraer términos significativos del query, vehicle y partType
    const fullText = `${query} ${vehicle} ${partType}`;
    const terms = this.extractMeaningfulTerms(fullText);

    if (terms.length === 0) {
      return [];
    }

    // 1. Si uno de los tokens parece código de producto directo
    const rawTokens = fullText.split(/\s+/).map(t => t.replace(/[^a-zA-Z0-9]/g, ''));
    for (const raw of rawTokens) {
      if (raw.length >= 5 && /\d/.test(raw)) {
        const directMatches = await this.getByCode(raw);
        if (directMatches.length > 0) {
          return directMatches;
        }
      }
    }

    // 2. Priorizar los 2 términos más distintivos (ej: 'pastilla', 'logan')
    // Los vehículos y partes automotrices comunes tienen la mayor prioridad
    const autoKeywords = new Set([
      'pastilla', 'freno', 'filtro', 'rotula', 'amortiguador', 'tijera', 'buje', 'balinera',
      'disco', 'correa', 'bomba', 'bobina', 'bujia', 'aceite', 'llanta', 'empaque',
      'duster', 'logan', 'sandero', 'hilux', 'prado', 'onix', 'spark', 'aveo', 'sail',
      'tucson', 'sportage', 'picanto', 'rio', 'kwid', 'stepway', 'cx5', 'mazda', 'renault',
      'chevrolet', 'toyota', 'hyundai', 'kia', 'nissan'
    ]);

    // Ordenar términos: los automotrices van primero
    terms.sort((a, b) => {
      const aIsAuto = autoKeywords.has(a) ? 1 : 0;
      const bIsAuto = autoKeywords.has(b) ? 1 : 0;
      return bIsAuto - aIsAuto;
    });

    const keyTerms = terms.slice(0, 2);

    const filterExpressions = keyTerms.map((term, idx) => `contains(searchText, :term${idx})`);
    const expressionAttributeValues = {};
    keyTerms.forEach((term, idx) => {
      expressionAttributeValues[`:term${idx}`] = term;
    });

    const candidates = [];
    let lastEvaluatedKey = undefined;

    try {
      do {
        const params = {
          TableName: TABLE_NAME,
          FilterExpression: filterExpressions.join(' AND '),
          ExpressionAttributeValues: expressionAttributeValues
        };
        if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;

        const result = await dynamoDB.send(new ScanCommand(params));
        if (result.Items && result.Items.length > 0) {
          candidates.push(...result.Items);
          if (candidates.length >= 25) break;
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      // Si no hubo coincidencia con AND y hay más de 1 término
      if (candidates.length === 0 && keyTerms.length > 1) {
        lastEvaluatedKey = undefined;
        do {
          const params = {
            TableName: TABLE_NAME,
            FilterExpression: filterExpressions.join(' OR '),
            ExpressionAttributeValues: expressionAttributeValues
          };
          if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;

          const result = await dynamoDB.send(new ScanCommand(params));
          if (result.Items && result.Items.length > 0) {
            candidates.push(...result.Items);
            if (candidates.length >= 25) break;
          }
          lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);
      }

      return this.rankAndSort(candidates, terms, limit);
    } catch (error) {
      console.error('[CaribePartesRepository] Error en búsqueda:', error);
      return [];
    }
  }

  /**
   * Ordena los resultados por relevancia y disponibilidad
   */
  static rankAndSort(items, terms, limit = 5) {
    const scored = items.map(item => {
      let score = 0;
      const text = (item.searchText || '');
      const code = (item.codigoLimpio || '').toLowerCase();

      terms.forEach(term => {
        if (code === term) score += 30;
        else if (code.includes(term)) score += 15;
        if (text.includes(term)) score += 10;
      });

      if (item.stockTotal > 0) score += 5; // Bonus stock disponible
      return { item, score };
    });

    const uniqueMap = new Map();
    scored.sort((a, b) => b.score - a.score);

    for (const s of scored) {
      if (!uniqueMap.has(s.item.codigo)) {
        uniqueMap.set(s.item.codigo, s.item);
      }
      if (uniqueMap.size >= limit) break;
    }

    return Array.from(uniqueMap.values());
  }
}

module.exports = CaribePartesRepository;
