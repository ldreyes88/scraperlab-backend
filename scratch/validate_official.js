const fs = require('fs');
const path = require('path');
const ScraperLabsApiStrategy = require('../src/strategies/ScraperLabsApiStrategy');
const GenericDynamicStrategy = require('../src/strategies/domain/GenericDynamicStrategy');

async function validateBoth() {
  console.log('========================================================');
  console.log('VALIDACIÓN OFICIAL: ESTRATEGIAS Y CONFIGURACIONES MGRADAS');
  console.log('========================================================\n');

  const providerStrategy = new ScraperLabsApiStrategy();
  const dynamicStrategy = new GenericDynamicStrategy(providerStrategy);

  // 1. Ktronix
  const ktronixConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../.logs/scraperConfig/domain-ktronix.com.json'), 'utf8')
  );
  ktronixConfig.scrapeType = 'detail';
  const urlKtronix = 'https://www.ktronix.com/iphone-18-pro-256gb-5g-borgona/p/195951415048';

  console.log('--- 1. Validando Ktronix ---');
  try {
    const resKtronix = await dynamicStrategy.scrape(urlKtronix, ktronixConfig);
    console.log('Respuesta Oficial Ktronix:');
    console.log(JSON.stringify(resKtronix, null, 2));
  } catch (err) {
    console.error('Error Ktronix:', err);
  }

  // 2. MercadoLibre
  const mlConfig = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../.logs/scraperConfig/domain-mercadolibre.com.co.json'), 'utf8')
  );
  mlConfig.scrapeType = 'detail';
  const urlML = 'https://www.mercadolibre.com.co/apple-iphone-18-pro-max-256-gb-negro/p/MCO77855502';

  console.log('\n--- 2. Validando MercadoLibre ---');
  try {
    const resML = await dynamicStrategy.scrape(urlML, mlConfig);
    console.log('Respuesta Oficial MercadoLibre:');
    console.log(JSON.stringify(resML, null, 2));
  } catch (err) {
    console.error('Error MercadoLibre:', err);
  }
}

validateBoth();
