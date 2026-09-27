// scraperlab-backend/src/strategies/ScraperLabsApiStrategy.js

const BaseStrategy = require('./BaseStrategy');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

/**
 * ScraperLabsApiStrategy - Proveedor Propio de Scraping Serverless Headless de ScraperLabs
 * Ejecuta un navegador headless real en AWS Lambda usando @sparticuz/chromium y puppeteer-core.
 * Costo: ~$0 en proxies de terceros.
 * Soporta ejecución de JavaScript, SPAs, espera de selectores y cookies de sesión.
 */
class ScraperLabsApiStrategy extends BaseStrategy {
  constructor() {
    super('ScraperLabsApi');
  }

  /**
   * Determina la ruta del ejecutable de Chromium según el entorno (Lambda vs Local)
   */
  async getExecutablePath(chromium) {
    // 1. Si está en AWS Lambda
    if (process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT) {
      return await chromium.executablePath();
    }

    // 2. Si se configuró explícitamente en variables de entorno
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
      return process.env.CHROME_PATH;
    }

    // 3. Fallbacks locales según sistema operativo
    if (process.platform === 'darwin') {
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
      ];
      for (const p of macPaths) {
        if (fs.existsSync(p)) return p;
      }
    } else if (process.platform === 'win32') {
      const winPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
      ];
      for (const p of winPaths) {
        if (fs.existsSync(p)) return p;
      }
    } else if (process.platform === 'linux') {
      const linuxPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      for (const p of linuxPaths) {
        if (fs.existsSync(p)) return p;
      }
    }

    // Último recurso: intentar usar el binario de @sparticuz/chromium
    return await chromium.executablePath();
  }

  /**
   * Realiza el scraping usando Chromium Headless de ScraperLabs
   * @param {string} url - URL a navegar
   * @param {Object} domainConfig - Configuración del dominio y provider
   */
  async scrape(url, domainConfig = {}) {
    const { providerConfig = {}, selectors } = domainConfig;

    const chromiumMod = require('@sparticuz/chromium');
    const chromium = chromiumMod.default || chromiumMod;

    const isLambda = Boolean(process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT);
    const executablePath = await this.getExecutablePath(chromium);

    console.log(`[ScraperLabsApi] Navegando a: ${url} (Entorno: ${isLambda ? 'AWS Lambda' : 'Local'})`);

    const launchArgs = isLambda
      ? chromium.args
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote'
        ];

    let browser = null;
    let page = null;

    try {
      browser = await puppeteer.launch({
        args: launchArgs,
        defaultViewport: {
          width: parseInt(providerConfig.viewport_width || 1920, 10),
          height: parseInt(providerConfig.viewport_height || 1080, 10)
        },
        executablePath,
        headless: isLambda ? chromium.headless : true
      });

      page = await browser.newPage();

      // Configurar User-Agent realista
      const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
      await page.setUserAgent(providerConfig.userAgent || defaultUserAgent);

      // Inyectar headers si están definidos
      if (providerConfig.headers && Object.keys(providerConfig.headers).length > 0) {
        await page.setExtraHTTPHeaders(providerConfig.headers);
      }

      // Inyectar cookies de sesión si están definidas (útil para saltarse reCAPTCHA con sesión previa)
      if (Array.isArray(providerConfig.cookies) && providerConfig.cookies.length > 0) {
        await page.setCookie(...providerConfig.cookies);
      }

      // Optimización de rendimiento: bloquear imágenes/medios para ahorrar ancho de banda y memoria
      const shouldBlockImages = providerConfig.block_images !== false;
      if (shouldBlockImages) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (['image', 'media', 'font'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
      }

      // Timeout configurable (default 35s)
      const timeout = parseInt(providerConfig.timeout || process.env.HTTP_TIMEOUT || 35000, 10);
      const waitUntil = providerConfig.waitUntil || 'domcontentloaded';

      // Navegar a la URL objetivo
      await page.goto(url, { waitUntil, timeout });

      // Esperar selector específico si está configurado
      if (providerConfig.wait_for_selector) {
        console.log(`[ScraperLabsApi] Esperando selector: ${providerConfig.wait_for_selector}`);
        await page.waitForSelector(providerConfig.wait_for_selector, { timeout: 15000 });
      }

      // Espera adicional en ms para permitir ejecución de scripts dinámicos
      const waitTime = parseInt(providerConfig.wait || 0, 10);
      if (waitTime > 0) {
        console.log(`[ScraperLabsApi] Esperando ${waitTime}ms para carga dinámica...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Extraer HTML completo renderizado
      const html = await page.content();
      console.log(`[ScraperLabsApi] Contenido obtenido exitosamente (${html.length} bytes).`);

      // Si no hay selectores, retornar el HTML crudo para que GenericDynamicStrategy lo procese
      if (!selectors || Object.keys(selectors).length === 0) {
        return html;
      }

      // Si hay selectores específicos, parsear directamente
      return this.parseHtml(html, selectors, url);

    } catch (error) {
      console.error(`[ScraperLabsApi] Error al scrapear ${url}:`, error.message);
      throw error;
    } finally {
      if (page) {
        try { await page.close(); } catch (e) {}
      }
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
    }
  }

  /**
   * Parsea el HTML usando selectores CSS
   */
  parseHtml(html, selectors, url) {
    const $ = cheerio.load(html);
    const data = { url };

    const mapping = {
      price: selectors.priceSelector || selectors.price,
      originalPrice: selectors.originalPriceSelector || selectors.originalPrice,
      title: selectors.titleSelector || selectors.title,
      image: selectors.imageSelector || selectors.image,
      availability: selectors.availabilitySelector || selectors.availability,
      description: selectors.descriptionSelector || selectors.description
    };

    for (const [key, selector] of Object.entries(mapping)) {
      if (selector) {
        if (key === 'image') {
          data[key] = $(selector).first().attr('src') || $(selector).first().attr('data-src') || '';
        } else {
          data[key] = $(selector).first().text().trim();
        }
      }
    }

    return this.formatResponse(data);
  }
}

module.exports = ScraperLabsApiStrategy;
