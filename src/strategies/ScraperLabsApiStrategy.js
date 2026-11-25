// scraperlab-backend/src/strategies/ScraperLabsApiStrategy.js

const BaseStrategy = require('./BaseStrategy');
const cheerio = require('cheerio');
const fs = require('fs');

/**
 * ScraperLabsApiStrategy - Proveedor Propio de Scraping Serverless Headless de ScraperLabs
 * Ejecuta un navegador headless real en AWS Lambda usando @sparticuz/chromium y puppeteer-core.
 * Costo: ~$0 en proxies de terceros.
 * Soporta ejecución de JavaScript, SPAs, espera de selectores y cookies de sesión.
 */
let localProfileMutex = Promise.resolve();

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
   * Obtiene la ruta del directorio de usuario si el dominio tiene habilitada la sesión/perfil.
   * Si el dominio no lo especifica, devuelve null (scraping normal y ligero).
   */
  resolveUserDataDir(domainConfig = {}) {
    const providerConfig = domainConfig.providerConfig || {};
    // El dominio debe solicitarlo explícitamente: use_session_profile === true, session_type === 'profile', o providerConfig.user_data_dir
    const wantsProfile = Boolean(
      providerConfig.use_session_profile ||
      providerConfig.session_type === 'profile' ||
      providerConfig.user_data_dir
    );

    if (!wantsProfile) {
      return null;
    }

    return providerConfig.user_data_dir || process.env.SCRAPERLABS_USER_DATA_DIR || null;
  }

  /**
   * Realiza el scraping usando Chromium Headless de ScraperLabs
   * @param {string} url - URL a navegar
   * @param {Object} domainConfig - Configuración del dominio y provider
   */
  async scrape(url, domainConfig = {}) {
    const userDataDir = this.resolveUserDataDir(domainConfig);

    // Solo si el dominio requiere un userDataDir compartido en entorno local, serializar con mutex.
    // Todos los demás dominios normales se ejecutan en paralelo sin esperarse.
    if (userDataDir && !Boolean(process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT)) {
      const executeNext = () => this._executeScrape(url, domainConfig);
      const executionPromise = localProfileMutex.then(executeNext, executeNext);
      localProfileMutex = executionPromise.catch(() => {});
      return await executionPromise;
    }

    return await this._executeScrape(url, domainConfig);
  }

  /**
   * Ejecución interna del ciclo de vida del navegador y scraping
   */
  async _executeScrape(url, domainConfig = {}) {
    const { providerConfig = {}, selectors } = domainConfig;

    const puppeteerMod = await import('puppeteer-core');
    const puppeteer = puppeteerMod.default || puppeteerMod;

    const chromiumMod = await import('@sparticuz/chromium');
    const chromium = chromiumMod.default || chromiumMod;

    const isLambda = Boolean(process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT);
    const executablePath = await this.getExecutablePath(chromium);

    // Determinar si este dominio en particular requiere sesión/perfil
    const userDataDir = this.resolveUserDataDir(domainConfig);

    console.log(`[ScraperLabsApi] Navegando a: ${url} (Entorno: ${isLambda ? 'AWS Lambda' : 'Local'}, Perfil: ${userDataDir ? 'Activo' : 'Estándar ligero'})`);

    const launchArgs = isLambda
      ? [...chromium.args, '--disable-blink-features=AutomationControlled']
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080'
        ];

    // Soporte opcional de proxy (residencial/rotativo) para dominios que bloquean IPs de AWS Datacenter
    const proxyUrl = providerConfig.proxy || process.env.SCRAPERLABS_PROXY || null;
    let proxyAuth = null;
    if (proxyUrl) {
      try {
        const parsed = new URL(proxyUrl);
        launchArgs.push(`--proxy-server=${parsed.protocol}//${parsed.host}`);
        if (parsed.username || parsed.password) {
          proxyAuth = {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password)
          };
        }
      } catch (err) {
        launchArgs.push(`--proxy-server=${proxyUrl}`);
      }
    }

    // Configuración de persistencia de perfil (userDataDir) y modo headless/off-screen
    const isHeadless = isLambda
      ? chromium.headless
      : (providerConfig.headless !== undefined ? providerConfig.headless : (process.env.SCRAPERLABS_HEADLESS === 'false' || Boolean(userDataDir) ? false : true));

    if (!isLambda && !isHeadless) {
      launchArgs.push('--no-first-run', '--no-default-browser-check');
      // Si corre en máquina local/servidor sin pantalla estricta, renderizar en canvas virtual off-screen
      if (process.env.SCRAPERLABS_OFFSCREEN !== 'false') {
        launchArgs.push('--window-position=-2400,-2400');
      }
    }

    let browser = null;
    let page = null;

    try {
      const launchOptions = {
        args: launchArgs,
        defaultViewport: {
          width: parseInt(providerConfig.viewport_width || 1920, 10),
          height: parseInt(providerConfig.viewport_height || 1080, 10)
        },
        executablePath,
        headless: isHeadless
      };

      if (userDataDir) {
        launchOptions.userDataDir = userDataDir;
      }

      browser = await puppeteer.launch(launchOptions);

      page = await browser.newPage();

      // Autenticación de proxy si aplica
      if (proxyAuth) {
        await page.authenticate(proxyAuth);
      }

      // Configurar User-Agent y Headers consistentes según el entorno (Lambda Linux vs Local)
      const defaultUserAgent = isLambda
        ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
      await page.setUserAgent(providerConfig.userAgent || defaultUserAgent);

      const defaultHeaders = {
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': isLambda ? '"Linux"' : '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      };
      await page.setExtraHTTPHeaders({ ...defaultHeaders, ...(providerConfig.headers || {}) });

      // Evasión de WebDriver y entorno de automatización
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-419', 'es', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        window.chrome = { runtime: {} };
      });

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

      // Detección y resolución de retos interactivos anti-bot / PoW (activo por defecto salvo que se defina antibot: false)
      const isAntiBotDisabled = providerConfig.antibot === false;
      if (!isAntiBotDisabled) {
        try {
          const challengeSelector = providerConfig.challenge_selector || '#continue-button';
          const continueBtn = await page.$(challengeSelector);
          if (continueBtn) {
            console.log(`[ScraperLabsApi] [AntiBot] Reto interactivo detectado (${challengeSelector}). Esperando resolución de PoW...`);
            const challengeTimeout = parseInt(providerConfig.challenge_timeout || 25000, 10);
            await page.waitForFunction((sel) => {
              const btn = document.querySelector(sel);
              return btn && !btn.disabled;
            }, { timeout: challengeTimeout }, challengeSelector);

            console.log(`[ScraperLabsApi] [AntiBot] Reto resuelto. Continuando navegación...`);
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {}),
              page.click(challengeSelector).catch(() => {})
            ]);

            // Intentar esperar a que aparezca un elemento representativo de la página del producto
            try {
              await page.waitForSelector('.ui-pdp-title, h1, .andes-money-amount, meta[property="og:title"]', { timeout: 12000 });
            } catch (waitErr) {
              // Si no aparece de inmediato, aplicar la espera de hidratación
            }

            const postChallengeWait = parseInt(providerConfig.post_challenge_wait || 2500, 10);
            await new Promise((resolve) => setTimeout(resolve, postChallengeWait));
          }
        } catch (challengeErr) {
          console.warn('[ScraperLabsApi] [AntiBot] Verificación de reto finalizada:', challengeErr.message);
        }
      }

      // Esperar selector específico si está configurado
      if (providerConfig.wait_for_selector) {
        console.log(`[ScraperLabsApi] Esperando selector: ${providerConfig.wait_for_selector}`);
        await page.waitForSelector(providerConfig.wait_for_selector, { timeout: 15000 });
      }

      // Espera adicional en ms para permitir ejecución de scripts dinámicos con Jitter Orgánico
      const baseWait = parseInt(providerConfig.wait || 0, 10);
      let waitTime = baseWait;
      if (baseWait > 0) {
        // Jitter fluctuante: ±35% sobre el tiempo base para romper patrones rígidos de bot
        const minFactor = 0.7;
        const maxFactor = 1.4;
        const jitterMultiplier = Math.random() * (maxFactor - minFactor) + minFactor;
        waitTime = Math.round(baseWait * jitterMultiplier);
        console.log(`[ScraperLabsApi] Esperando ${waitTime}ms (jitter orgánico sobre base ${baseWait}ms)...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Micro-scroll orgánico: simula actividad humana real activando telemetría del DOM
      try {
        await page.evaluate(() => {
          const scrollDistance = Math.floor(Math.random() * 350) + 150;
          window.scrollBy({ top: scrollDistance, behavior: 'smooth' });
        });
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 400) + 200));
      } catch (scrollErr) {
        // Ignorar si el contexto del frame no permite scroll
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
        try {
          page.removeAllListeners();
          await Promise.race([
            page.close(),
            new Promise((resolve) => setTimeout(resolve, 2000))
          ]);
        } catch (e) {
          console.warn('[ScraperLabsApi] Warning cerrando página:', e.message);
        }
      }
      if (browser) {
        try {
          const proc = browser.process();
          await Promise.race([
            browser.close(),
            new Promise((resolve) => setTimeout(resolve, 3000))
          ]);
          if (proc && !proc.killed) {
            try { proc.kill('SIGKILL'); } catch (err) {}
          }
        } catch (e) {
          console.warn('[ScraperLabsApi] Warning cerrando browser:', e.message);
        }
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
