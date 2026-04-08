// scraperlab-backend/src/strategies/domain/BaseDomainStrategy.js

const cheerio = require('cheerio');
const { nowColombiaISO } = require('../../utils/time');
const { cleanPrice, getCurrencyConfig } = require('../../utils/currency');

class BaseDomainStrategy {
  constructor(providerStrategy) {
    if (this.constructor === BaseDomainStrategy) {
      throw new Error('BaseDomainStrategy es abstracta y no puede ser instanciada');
    }
    
    this.provider = providerStrategy;
    this.providerName = providerStrategy.providerName;
  }

  /**
   * Método principal que deben implementar las estrategias de dominio
   */
  async scrape(url, domainConfig = {}) {
    throw new Error('El método scrape() debe ser implementado por la estrategia de dominio');
  }

  /**
   * Helper para obtener HTML usando el provider configurado
   * Este método adapta la interfaz de batch-process a scraperlab-backend
   * SOLO incluye en providerConfig los parámetros que se pasan explícitamente
   */
  async fetchHtml(url, options = {}) {

    // SOLO incluir parámetros que están explícitamente definidos en options
    const providerConfig = {};
    
    if (options.render !== undefined) providerConfig.render = options.render;
    if (options.premium !== undefined) providerConfig.premium = options.premium;
    if (options.ultra_premium !== undefined) providerConfig.ultra_premium = options.ultra_premium;
    if (options.device_type !== undefined) providerConfig.device_type = options.device_type;
    if (options.wait !== undefined && options.wait > 0) providerConfig.wait = options.wait;
    if (options.wait_for_selector !== undefined && options.wait_for_selector !== null) {
      providerConfig.wait_for_selector = options.wait_for_selector;
    }
    if (options.headers !== undefined && options.headers !== null) providerConfig.headers = options.headers;
    if (options.country_code !== undefined) providerConfig.country_code = options.country_code;
    if (options.session_number !== undefined) providerConfig.session_number = options.session_number;
    if (options.keep_headers !== undefined) providerConfig.keep_headers = options.keep_headers;

    const domainConfig = {
      providerConfig,
      scraperConfig: {} // No necesitamos selectores para estrategias custom
    };

    // Usar el provider para hacer scraping genérico y obtener el HTML
    const response = await this.provider.scrape(url, domainConfig);
    
    // El provider retorna HTML cuando no hay selectores definidos
    // Necesitamos acceder al HTML crudo
    const html = response.rawHtml || response;

    // Verificar si estamos bloqueados antes de retornar
    if (this.isBlocked(html)) {
      throw new Error(`Acceso bloqueado por el dominio (Captcha/Bot Detection)`);
    }

    return html;
  }

  /**
   * Detecta si el HTML recibido indica un bloqueo o captcha
   */
  isBlocked(html) {
    if (!html || typeof html !== 'string') return false;
    
    // 0. Limpiar HTML de scripts para evitar falsos positivos
    // (Ej: scripts de shoplift que mencionan "blocked" o "g-recaptcha")
    const cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Patrones específicos de captchas y retos de bots
    const specificPatterns = [
      'nav-header-captcha', 'challenge-form', 'robot_check', 
      'cf-challenge', 'g-recaptcha', 'captcha-delivery',
      'protection by cloudflare', 'access denied'
    ];

    const lowerHtml = cleanHtml.toLowerCase();
    
    // 1. Verificar patrones específicos (alta confianza)
    if (specificPatterns.some(pattern => lowerHtml.includes(pattern))) {
      return true;
    }

    // 2. Verificar palabra 'blocked' pero de forma restrictiva para evitar falsos positivos
    // e.g. en el título o en encabezados principales
    if (/<title>[^<]*blocked[^<]*<\/title>/i.test(cleanHtml) || 
        /<h1[^>]*>[^<]*blocked[^<]*<\/h1>/i.test(cleanHtml)) {
      return true;
    }

    return false;
  }

  /**
   * Helper para obtener un valor de un objeto usando una ruta de puntos (punto-notación)
   * soporta arreglos ej: "props.pageProps.product.prices[0].price"
   */
  getValueByPath(obj, path) {
    if (!path || !obj) return null;
    
    // Convertir arreglos [n] a .n para facilitar el split
    const cleanPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = cleanPath.split('.');
    
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    return current;
  }

  /**
   * Extrae datos usando JSON-LD (Schema.org)
   */
  extractJSONLD($, config = {}) {
    const data = {};
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonData = JSON.parse($(el).html());
        
        const searchProduct = (obj) => {
          if (!obj || typeof obj !== 'object') return;

          if (obj['@type'] === 'Product' || (Array.isArray(obj['@type']) && obj['@type'].includes('Product'))) {
            if (obj.name && !data.title) data.title = obj.name;
            if (obj.image && !data.image) {
              data.image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
              if (typeof data.image === 'object') data.image = data.image.url || data.image['@id'];
            }
            
            if (obj.offers) {
              const allOffers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
              
              const offerPrices = [];
              const offerHighPrices = [];
              const offerListPrices = [];

              for (const offer of allOffers) {
                // 1. Si hay rutas personalizadas en config, usarlas
                if (config.pricePath) {
                  const customPrice = this.getValueByPath(offer, config.pricePath);
                  if (customPrice && !data.currentPrice) data.currentPrice = customPrice;
                }

                if (config.originalPricePath) {
                  const customOriginalPrice = this.getValueByPath(offer, config.originalPricePath);
                  if (customOriginalPrice && !data.originalPrice) data.originalPrice = customOriginalPrice;
                }

                // 2. Recolectar valores para lógica de fallback inteligente
                const p = parseFloat(offer.price || offer.lowPrice);
                if (!isNaN(p)) offerPrices.push(p);

                const hp = parseFloat(offer.highPrice);
                if (!isNaN(hp)) offerHighPrices.push(hp);

                const lp = parseFloat(offer.listPrice);
                if (!isNaN(lp)) offerListPrices.push(lp);
              }

              // Fallbacks si no se encontró con rutas personalizadas
              if (!data.currentPrice && offerPrices.length > 0) {
                data.currentPrice = Math.min(...offerPrices);
              }

              if (!data.originalPrice) {
                // Prioridad 1: listPrice (Común en VTEX/Exito)
                if (offerListPrices.length > 0) {
                  data.originalPrice = Math.max(...offerListPrices);
                } 
                // Prioridad 2: highPrice (Si es mayor al current)
                else if (offerHighPrices.length > 0) {
                  const maxHp = Math.max(...offerHighPrices);
                  if (maxHp > (data.currentPrice || 0)) {
                    data.originalPrice = maxHp;
                  }
                }
                // Prioridad 3: Heurística de múltiples ofertas (Común en Falabella donde el segundo offer es el original)
                else if (offerPrices.length > 1) {
                  const maxP = Math.max(...offerPrices);
                  const minP = Math.min(...offerPrices);
                  if (maxP > minP) {
                    data.originalPrice = maxP;
                  }
                }
              }
            }
          }

          if (Array.isArray(obj)) {
            obj.forEach(searchProduct);
          } else {
            Object.values(obj).forEach(val => {
              if (val && typeof val === 'object') searchProduct(val);
            });
          }
        };

        searchProduct(jsonData);
      } catch (e) {}
    });
    return data;
  }

  /**
   * Extrae datos de Meta Tags (OpenGraph, Twitter, etc)
   */
  extractMeta($) {
    const data = {};
    
    // Precios
    data.currentPrice = $('meta[property="product:price:amount"]').attr('content') ||
                       $('meta[property="og:price:amount"]').attr('content') ||
                       $('meta[name="twitter:data1"]').attr('content');
    
    data.originalPrice = $('meta[property="product:price:listPrice"]').attr('content') ||
                        $('meta[property="og:price:standard_amount"]').attr('content');

    // Título
    data.title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text().trim();

    // Imagen
    data.image = $('meta[property="og:image"]').attr('content') ||
                $('meta[name="twitter:image"]').attr('content');

    return data;
  }

  /**
   * Extrae datos de Next.js __NEXT_DATA__
   */
  extractNextData($, config = {}) {
    const nextData = $('#__NEXT_DATA__').html();
    if (!nextData) return {};

    try {
      const json = JSON.parse(nextData);
      
      // 1. Intentar con ruta personalizada si existe
      let product = null;
      if (config.productPath) {
        product = this.getValueByPath(json, config.productPath);
      }

      // 2. Fallback a rutas conocidas si no hay personalizada o no funcionó
      if (!product) {
        product = json.props?.pageProps?.productData || 
                  json.props?.pageProps?.initialState?.product?.detail;
      }
      
      if (product) {
        const data = {};
        
        // Título
        const titlePath = config.titlePath || 'name';
        const title = this.getValueByPath(product, titlePath);
        if (title) data.title = title;
        
        // Precios
        const pricePath = config.pricePath;
        if (pricePath) {
          // Intentar primero RELATIVO al producto
          data.currentPrice = this.getValueByPath(product, pricePath);
          
          // FALLBACK: Si no encontró nada y parece una ruta ABSOLUTA (empieza por props o query)
          // o simplemente si falló, intentamos contra el JSON raíz
          if (!data.currentPrice && (pricePath.startsWith('props') || pricePath.startsWith('query'))) {
            data.currentPrice = this.getValueByPath(json, pricePath);
          }
        }

        if (!data.currentPrice && product.prices && product.prices.length > 0) {
          const p = product.prices[0];
          data.currentPrice = p.eventPrice || p.price?.[0] || p.currentPrice;
        }

        const originalPricePath = config.originalPricePath;
        if (originalPricePath) {
          // Intentar primero RELATIVO al producto
          data.originalPrice = this.getValueByPath(product, originalPricePath);
          
          // FALLBACK: Misma lógica para precio original
          if (!data.originalPrice && (originalPricePath.startsWith('props') || originalPricePath.startsWith('query'))) {
            data.originalPrice = this.getValueByPath(json, originalPricePath);
          }
        }

        if (!data.originalPrice && product.prices && product.prices.length > 0) {
          const p = product.prices[0];
          data.originalPrice = p.normalPrice || p.listPrice || p.originalPrice;
        }

        // Imagen
        const imagePath = config.imagePath || 'images[0].url';
        const image = this.getValueByPath(product, imagePath);
        if (image) data.image = image;
        
        return data;
      }
    } catch (e) {}
    return {};
  }

  /**
 * Extrae datos de scripts usando expresiones regulares
 */
extractFromScripts($, patterns = []) {
  const data = {};
  const defaultPatterns = [
    { key: 'currentPrice', regex: /["']?price["']?\s*:\s*["']?(\d+(?:\.\d+)?)/ },
    { key: 'originalPrice', regex: /["']?(?:original|list|previous)Price["']?\s*:\s*["']?(\d+(?:\.\d+)?)/ },
    { key: 'title', regex: /["']?name["']?\s*:\s*["']?([^"']+)["']?/ }
  ];

  // Convertir strings de regex a objetos RegExp si vienen de la DB
  const customPatterns = patterns.map(p => {
    if (typeof p.regex === 'string') {
      try {
        return { ...p, regex: new RegExp(p.regex) };
      } catch (e) {
        console.error(`Regex inválido: ${p.regex}`, e.message);
        return null;
      }
    }
    return p;
  }).filter(Boolean);

  const scripts = $('script').map((i, el) => $(el).html()).get().filter(c => c && c.length > 10);

  // 1. Intentar primero con patrones CUSTOM en TODOS los scripts
  customPatterns.forEach(p => {
    for (const content of scripts) {
      const match = content.match(p.regex);
      if (match) {
        let value = match[1];
        // Aplicar divisor si existe (útil para precios en centavos como Shopify/VTEX)
        if (p.divisor && !isNaN(value)) {
          value = parseFloat(value) / p.divisor;
        }
        data[p.key] = value;
        break; // Encontrado para esta clave custom, pasar a la siguiente
      }
    }
  });

  // 2. Llenar los vacíos con patrones DEFAULT
  defaultPatterns.forEach(p => {
    if (data[p.key]) return; // Ya lo encontramos con un patrón custom
    for (const content of scripts) {
      const match = content.match(p.regex);
      if (match) {
        let value = match[1];
        // Aplicar divisor si existe en el patrón default (aunque por ahora no hay)
        if (p.divisor && !isNaN(value)) {
          value = parseFloat(value) / p.divisor;
        }
        data[p.key] = value;
        break;
      }
    }
  });

  return data;
}

  /**
   * Helper para extraer datos usando los selectores definidos en la configuración del dominio
   * Esto permite que la estrategia sea dinámica y se adapte a cambios en la BD sin tocar el código
   */
  applySelectors($, selectors = {}, url = '') {
    const data = { url };

    if (!selectors || Object.keys(selectors).length === 0) return data;

    // 1. Si los selectores están agrupados en un sub-objeto 'css', usarlos
    const cssSelectors = selectors.css || selectors;

    // Helper para obtener texto del primer elemento que no esté vacío
    // Prioriza atributos sobre el texto directo para evitar ruidos de concatenación (ej: descuentos)
    const getFirstNonEmpty = (selector) => {
      if (!selector) return null;
      let text = '';
      $(selector).each((i, el) => {
        const item = $(el);
        
        // 1. Intentar extraer de atributos comunes de precio si existen
        const attrVal = item.attr('data-event-price') || 
                        item.attr('data-price') || 
                        item.attr('data-normal-price') ||
                        item.attr('content') || 
                        item.attr('value');
        
        if (attrVal && !text) {
          text = attrVal.trim();
        }
        
        // 2. Si no hay atributo, usar el texto plano
        if (!text) {
          const val = item.text().trim();
          if (val) {
            text = val;
          }
        }
      });
      return text || null;
    };

    // 2. Extraer campos estándar
    if (cssSelectors.priceSelector || cssSelectors.price) {
      data.currentPrice = getFirstNonEmpty(cssSelectors.priceSelector || cssSelectors.price);
    }
    
    if (cssSelectors.originalPriceSelector || cssSelectors.originalPrice) {
      data.originalPrice = getFirstNonEmpty(cssSelectors.originalPriceSelector || cssSelectors.originalPrice);
    }

    if (cssSelectors.titleSelector || cssSelectors.title) {
      data.title = getFirstNonEmpty(cssSelectors.titleSelector || cssSelectors.title);
    }

    if (cssSelectors.imageSelector || cssSelectors.image) {
      const imgSelector = cssSelectors.imageSelector || cssSelectors.image;
      $(imgSelector).each((i, el) => {
        if (data.image) return;
        const imgEl = $(el);
        data.image = imgEl.attr('src') || 
                     imgEl.attr('data-src') ||
                     imgEl.attr('data-original') ||
                     imgEl.attr('data-lazy-src');
      });
    }

    if (cssSelectors.availabilitySelector || cssSelectors.availability) {
      data.availability = getFirstNonEmpty(cssSelectors.availabilitySelector || cssSelectors.availability);
    }

    return data;
  }

  /**
   * Fusiona datos extraídos por lógica específica con datos extraídos por selectores
   * Priorizando la lógica específica pero llenando vacíos con los selectores
   */
  mergeExternalData(specificData, selectorData) {
    const merged = { ...selectorData, ...specificData };
    
    // Si la lógica específica no obtuvo precios pero los selectores sí, los usamos
    if (!merged.currentPrice && selectorData.currentPrice) merged.currentPrice = selectorData.currentPrice;
    if (!merged.originalPrice && selectorData.originalPrice) merged.originalPrice = selectorData.originalPrice;
    
    // Llenar metadatos adicionales que las estrategias hardcoded suelen omitir
    if (!merged.title && selectorData.title) merged.title = selectorData.title;
    if (!merged.image && selectorData.image) merged.image = selectorData.image;
    
    return merged;
  }

  /**
   * Formatea la respuesta según el formato de oferty
   * Mantiene compatibilidad con el formato original
   * Usado para tipo: detail (página de producto individual)
   */
  formatResponse({
    success,
    marketplace,
    currentPrice = 0,
    originalPrice = 0,
    method = 'N/A',
    error = null,
    url = '',
    details = {} // Permitir pasar un objeto de datos extraído dinámicamente
  }) {
    // Extraer país de la configuración si existe
    const country = details.country || details.countryCode || null;
    const currencyConfig = getCurrencyConfig(country, url);

    // Si se pasa un objeto details, priorizar sus valores
    const finalPrice = details.currentPrice || currentPrice;
    const finalOriginalPrice = details.originalPrice || originalPrice || finalPrice;

    const finalCurrent = cleanPrice(finalPrice, country, url);
    const finalOriginal = cleanPrice(finalOriginalPrice, country, url);

    // Validación de seguridad: Si el precio subió más del 100% respecto al original (o un umbral definido),
    // es probable que sea un error de scraping (como un 0 extra)
    const maxIncrease = details.maxPriceIncrease || 2.0; // Default 100% (x2)
    if (success && finalOriginal > 0 && finalCurrent > finalOriginal * maxIncrease) {
      return {
        success: false,
        marketplace: marketplace || details.marketplace,
        error: `Precio sospechoso: incremento > ${Math.round((maxIncrease - 1) * 100)}% (${finalCurrent} vs ${finalOriginal})`,
        metadata: {
          method,
          timestamp: nowColombiaISO(),
          url,
          suspiciousPrice: true
        }
      };
    }

    // Validación de seguridad: Precio absurdo (bajó demasiado)
    // Se dispara si el precio es < 5% del original y el original es > 1000
    const minRatio = details.minPriceRatio || 0.05;
    if (success && finalOriginal > 1000 && finalCurrent < finalOriginal * minRatio) {
      return {
        success: false,
        marketplace: marketplace || details.marketplace,
        error: `Precio sospechoso (Absurdo): bajó > ${Math.round((1 - minRatio) * 100)}% (${finalCurrent} vs ${finalOriginal})`,
        metadata: {
          method,
          timestamp: nowColombiaISO(),
          url,
          suspiciousPrice: true,
          absurdPrice: true
        }
      };
    }

    return {
      success,
      marketplace: marketplace || details.marketplace,
      prices: {
        current: finalCurrent,
        original: finalOriginal,
        discount_percentage: finalOriginal > finalCurrent
          ? Math.round((1 - (finalCurrent / finalOriginal)) * 100)
          : 0,
        currency: details.currency || currencyConfig.currency || 'COP'
      },
      details: {
        title: details.title || '',
        url: details.url || url,
        image: details.image || ''
      },
      metadata: {
        method,
        timestamp: nowColombiaISO(),
        url
      },
      error
    };
  }

  /**
   * Formatea la respuesta para búsquedas generales (lista de productos)
   * Usado para tipo: search
   */
  formatSearchResponse({
    success,
    marketplace,
    results = [],
    method = 'CSS-Selectors',
    error = null,
    url = ''
  }) {
    return {
      success,
      scrapeType: 'search',
      marketplace,
      results: results.map(item => ({
        title: item.title || '',
        currentPrice: cleanPrice(item.currentPrice || 0, item.country || null, url),
        originalPrice: cleanPrice(item.originalPrice || item.currentPrice || 0, item.country || null, url),
        url: item.url || '',
        image: item.image || '',
        availability: item.availability !== false
      })),
      metadata: {
        totalResults: results.length,
        resultsExtracted: results.length,
        method,
        timestamp: nowColombiaISO(),
        url
      },
      error
    };
  }

  /**
   * Formatea la respuesta para búsqueda específica (primer resultado con datos completos)
   * Usado para tipo: searchSpecific
   */
  formatSearchSpecificResponse({
    success,
    marketplace,
    currentPrice = 0,
    originalPrice = 0,
    title = '',
    image = '',
    productUrl = '',
    method = 'Search-First-Result',
    error = null,
    url = '',
    details = {}
  }) {
    const country = details.country || details.countryCode || null;
    const finalCurrent = cleanPrice(currentPrice, country, url);
    const finalOriginal = cleanPrice(originalPrice || currentPrice, country, url);
    const currencyConfig = getCurrencyConfig(country, url);

    return {
      success,
      scrapeType: 'searchSpecific',
      marketplace,
      product: {
        title,
        image,
        url: productUrl
      },
      prices: {
        current: finalCurrent,
        original: finalOriginal,
        discount_percentage: finalOriginal > finalCurrent
          ? Math.round((1 - (finalCurrent / finalOriginal)) * 100)
          : 0,
        currency: currencyConfig.currency || 'COP'
      },
      metadata: {
        method,
        timestamp: nowColombiaISO(),
        searchUrl: url
      },
      error
    };
  }

  /**
   * Limpia precios (delegado a utilidad)
   */
  cleanPrice(val, countryCode, url) {
    return cleanPrice(val, countryCode, url);
  }
}

module.exports = BaseDomainStrategy;