require('dotenv').config();
const ScraperService = require('../src/services/ScraperService');

async function testMultiple() {
  const url = 'https://www.mercadolibre.com.co/samsung-galaxy-s25-ultra-256gb-titanium-black/p/MCO45517552';
  for (let i = 1; i <= 2; i++) {
    console.log(`\n=== Intento ${i} ===`);
    try {
      const res = await ScraperService.scrapeUrl(url, false, 'detail');
      console.log(`Intento ${i} - Success:`, res.success, 'Data success:', res.data?.success, 'Price:', res.data?.prices?.current, 'Error:', res.data?.error);
    } catch (e) {
      console.log(`Intento ${i} - Excepción:`, e.message);
    }
  }
}

testMultiple();
