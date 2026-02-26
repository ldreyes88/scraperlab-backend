// scraperlab-backend/scripts/verifyGroupedSelectors.js
require('dotenv').config();
const GenericDynamicStrategy = require('../src/strategies/domain/GenericDynamicStrategy');
const cheerio = require('cheerio');

async function test() {
  console.log('--- Iniciando Prueba de Selectores Agrupados ---');
  
  const strategy = new GenericDynamicStrategy({
    providerName: 'MockProvider',
    scrape: async () => ({
      rawHtml: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@type": "Product",
                "name": "Producto JSON-LD",
                "offers": {
                  "@type": "Offer",
                  "price": "150000",
                  "oldPrice": "200000"
                }
              }
            </script>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "product": {
                      "title": "Producto NextData",
                      "pricing": { "value": 140000 }
                    }
                  }
                }
              }
            </script>
          </head>
          <body>
            <h1 class="css-title">Producto CSS</h1>
            <span class="css-price">130000</span>
          </body>
        </html>
      `
    })
  });

  const config = {
    domainId: 'test.com',
    useJsonLd: true,
    useNextData: true,
    useMeta: false,
    useScripts: false,
    selectors: {
      detail: {
        css: {
          price: '.css-price',
          title: '.css-title'
        },
        nextData: {
          productPath: 'props.pageProps.product',
          pricePath: 'pricing.value',
          titlePath: 'title'
        },
        jsonLd: {
          pricePath: 'price'
        }
      }
    }
  };

  console.log('1. Probando prioridad JSON-LD...');
  const res1 = await strategy.scrape('http://test.com', { ...config, useNextData: false });
  console.log('Resultado JSON-LD:', res1.data?.title, res1.prices?.current); // Esperado: Producto JSON-LD, 150000

  console.log('\n2. Probando prioridad NextData (sin JSON-LD)...');
  const res2 = await strategy.scrape('http://test.com', { ...config, useJsonLd: false });
  console.log('Resultado NextData:', res2.data?.title, res2.prices?.current); // Esperado: Producto NextData, 140000

  console.log('\n3. Probando fallback CSS (sin JSON-LD ni NextData)...');
  const res3 = await strategy.scrape('http://test.com', { ...config, useJsonLd: false, useNextData: false });
  console.log('Resultado CSS:', res3.data?.title, res3.prices?.current); // Esperado: Producto CSS, 130000

  console.log('\n--- Fin de la prueba ---');
}

test().catch(console.error);
