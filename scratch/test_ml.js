require('dotenv').config();
const ScraperLabsApiStrategy = require('../src/strategies/ScraperLabsApiStrategy');
const ScraperAPIStrategy = require('../src/strategies/ScraperAPIStrategy');
const BaseDomainStrategy = require('../src/strategies/domain/BaseDomainStrategy');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://www.mercadolibre.com.co/samsung-galaxy-s25-ultra-256gb-titanium-black/p/MCO45517552';
  
  console.log('--- 1. Probando con ScraperLabsApi (Puppeteer) ---');
  try {
    const labs = new ScraperLabsApiStrategy();
    const htmlLabs = await labs.scrape(url, { providerConfig: { timeout: 35000, wait: 2000 } });
    console.log('ScraperLabsApi HTML length:', typeof htmlLabs === 'string' ? htmlLabs.length : 'not string');
    const dummy = new (class extends BaseDomainStrategy {})(labs);
    const blocked = dummy.isBlocked(htmlLabs);
    console.log('¿Bloqueado en ScraperLabsApi?:', blocked);
    if (blocked) {
      const $ = cheerio.load(htmlLabs);
      console.log('Título de la página:', $('title').text().trim());
      console.log('Fragmento HTML:', htmlLabs.slice(0, 500));
      // Buscar que patron causó el bloqueo
      const specificPatterns = [
        'nav-header-captcha', 'challenge-form', 'robot_check', 
        'cf-challenge', 'g-recaptcha', 'captcha-delivery',
        'protection by cloudflare', 'access denied',
        'suspicious-traffic-frontend', 'account-verification', 'gz/account-verification'
      ];
      const lower = htmlLabs.toLowerCase();
      const matched = specificPatterns.filter(p => lower.includes(p));
      console.log('Patrones detectados:', matched);
    }
  } catch (err) {
    console.error('Error ScraperLabsApi:', err.message);
  }

  console.log('\n--- 2. Probando con ScraperAPI ---');
  try {
    const sapi = new ScraperAPIStrategy();
    const htmlSapi = await sapi.scrape(url, { 
      providerConfig: { 
        premium: true, 
        country_code: 'co' 
      } 
    });
    console.log('ScraperAPI HTML length:', htmlSapi.length);
    const dummy = new (class extends BaseDomainStrategy {})(sapi);
    const blocked = dummy.isBlocked(htmlSapi);
    console.log('¿Bloqueado en ScraperAPI (premium: true, country: co)?:', blocked);
    const $ = cheerio.load(htmlSapi);
    console.log('Título página ScraperAPI:', $('title').text().trim());
    console.log('H1 PDP title:', $('h1.ui-pdp-title').text().trim());
  } catch (err) {
    console.error('Error ScraperAPI:', err.message);
  }
}

test();
