/**
 * Utilidades para el manejo de monedas y precios internacionales
 */

// Configuración de formatos de moneda por país
const CURRENCY_CONFIG = {
  'CO': { thousand: '.', decimal: ',', multiplier: 1, precision: 0, currency: 'COP' }, // Colombia
  'CR': { thousand: '.', decimal: ',', multiplier: 1, precision: 0, currency: 'CRC' }, // Costa Rica
  'CL': { thousand: '.', decimal: ',', multiplier: 1, precision: 0, currency: 'CLP' }, // Chile
  'MX': { thousand: ',', decimal: '.', multiplier: 1, precision: 2, currency: 'MXN' }, // México
  'US': { thousand: ',', decimal: '.', multiplier: 1, precision: 2, currency: 'USD' }, // USA
  'AR': { thousand: '.', decimal: ',', multiplier: 1, precision: 2, currency: 'ARS' }, // Argentina
  'PE': { thousand: ',', decimal: '.', multiplier: 1, precision: 2, currency: 'PEN' }, // Perú
  'GLOBAL': { thousand: '.', decimal: ',', multiplier: 1, precision: 0, currency: 'COP' } // Fallback
};

/**
 * Obtiene la configuración de moneda basada en el país o dominio
 */
function getCurrencyConfig(countryCode, url = '') {
  let code = countryCode?.toUpperCase();

  // Si no viene país, intentar deducir por el TLD del dominio
  if (!code && url) {
    if (url.includes('.com.co')) code = 'CO';
    else if (url.includes('.cr')) code = 'CR';
    else if (url.includes('.cl')) code = 'CL';
    else if (url.includes('.mx')) code = 'MX';
    else if (url.includes('.com.ar')) code = 'AR';
    else if (url.includes('.pe')) code = 'PE';
  }

  return CURRENCY_CONFIG[code] || CURRENCY_CONFIG['GLOBAL'];
}

/**
 * Limpia precios (retorna el valor en unidades o centavos según config)
 */
function cleanPrice(val, countryCode = 'CO', url = '') {
  if (val === undefined || val === null || val === '') return 0;
  
  // Configuración específica para el país
  const config = getCurrencyConfig(countryCode, url);

  // Si ya es un número
  if (typeof val === 'number') {
    return Math.round(val * config.multiplier);
  }

  let str = val.toString().trim();
  
  // 1. Limpieza agresiva de basura (emojis, textos extras)
  str = str.replace(/[^\d.,]/g, '');

  // 2. Normalización basada en la configuración del país
  let normalized = str;
  if (config.thousand === '.' && config.decimal === ',') {
    // Formato Europeo/Latam: 1.299,00
    if (str.includes('.') && str.includes(',')) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      // Solo coma: verificamos si parece decimal (2 dígitos)
      const parts = str.split(',');
      if (parts[1] && parts[1].length === 2) normalized = str.replace(',', '.');
      else normalized = str.replace(',', ''); // Eran miles
    } else if (str.includes('.')) {
      // Solo punto: en este formato suelen ser miles, pero verificamos si parece decimal
      const parts = str.split('.');
      const lastPart = parts[parts.length - 1];
      
      // CASO ESPECIAL COLOMBIA / AMBIGUO: 
      // Si hay múltiples puntos y el último bloque tiene exactamente 2 dígitos (ej: 2.185.500.48)
      // es MUY probable que el último punto sea un decimal (estilo US) o ruido de centavos/descuentos.
      if (parts.length > 2 && lastPart.length === 2) {
        const thousandPart = parts.slice(0, -1).join('');
        normalized = `${thousandPart}.${lastPart}`;
      }
      // Caso estándar: Si hay exactamente 1 o 2 dígitos después del único punto
      else if (parts.length === 2 && lastPart.length <= 2) {
        normalized = str; // Es decimal
      } else {
        normalized = str.replace(/\./g, ''); // Son miles o formato inconsistente
      }
    }
  } else {
    // Formato Americano: 1,299.00
    if (str.includes(',') && str.includes('.')) {
      normalized = str.replace(/,/g, '');
    } else if (str.includes('.')) {
      // Solo punto: verificamos si parece decimal
      const parts = str.split('.');
      if (parts[1] && parts[1].length === 2) normalized = str;
      else normalized = str.replace(/\./g, '');
    } else if (str.includes(',')) {
      normalized = str.replace(/,/g, '');
    }
  }

  // 3. Conversión final
  const num = parseFloat(normalized);
  if (isNaN(num)) return 0;
  
  return Math.round(num * config.multiplier);
}

module.exports = {
  CURRENCY_CONFIG,
  getCurrencyConfig,
  cleanPrice
};
