/**
 * Script de verificación para el nuevo pipeline de extracción modular
 * Uso: node scripts/verifyExtractionPipeline.js
 */
const GenericDynamicStrategy = require('../src/strategies/domain/GenericDynamicStrategy');
require('dotenv').config();

async function testPipeline() {
  const mockProvider = {
    providerName: 'mock',
    scrape: async (url, config) => {
      // En la prueba, pasamos el HTML que queremos probar en el objeto config original
      // pero fetchHtml solo pasa ciertos campos. Usaremos un truco:
      // Si el objeto config no tiene lo que buscamos, intentaremos usar una variable global temporal
      // o simplemente haremos que el mock sea más inteligente para este test.
      return { rawHtml: global.testHtml || '<html></html>' };
    }
  };

  const strategy = new GenericDynamicStrategy(mockProvider);

  const tests = [
    {
      name: 'JSON-LD Extraction',
      config: {
        useJsonLd: true,
        testHtml: `
          <html>
            <script type="application/ld+json">
              {
                "@type": "Product",
                "name": "Producto JSON-LD",
                "offers": { "price": "150000" }
              }
            </script>
          </html>
        `
      },
      expected: { title: 'Producto JSON-LD', currentPrice: 150000 }
    },
    {
      name: 'NextData Extraction (Falabella pattern)',
      config: {
        useNextData: true,
        testHtml: `
          <html>
            <script id="__NEXT_DATA__" type="application/json">
              {
                "props": {
                  "pageProps": {
                    "productData": {
                      "name": "Producto NextData",
                      "prices": [{ "eventPrice": "200000" }]
                    }
                  }
                }
              }
            </script>
          </html>
        `
      },
      expected: { title: 'Producto NextData', currentPrice: 200000 }
    },
    {
      name: 'Meta Tags Extraction',
      config: {
        useMeta: true,
        testHtml: `
          <html>
            <meta property="og:title" content="Producto Meta" />
            <meta property="product:price:amount" content="50000" />
          </html>
        `
      },
      expected: { title: 'Producto Meta', currentPrice: 50000 }
    },
    {
      name: 'Custom Script Regex Extraction (String from DB)',
      config: {
        useScripts: true,
        scriptPatterns: [
          { key: 'currentPrice', regex: 'var price = (\\d+);' }
        ],
        testHtml: `
          <html>
            <script>
              var price = 75000;
              var name = "Producto Script";
            </script>
          </html>
        `
      },
      expected: { currentPrice: 75000 }
    }
  ];

  console.log('--- Iniciando Pruebas de Pipeline de Extracción ---');
  let passed = 0;

  for (const t of tests) {
    try {
      console.log(`Prueba: ${t.name}`);
      global.testHtml = t.config.testHtml; // Pasar a través de global para el mock
      const result = await strategy.scrape('https://test.com', t.config);
      
      const priceMatched = result.data.currentPrice === t.expected.currentPrice;
      const titleMatched = !t.expected.title || result.data.title === t.expected.title;

      if (priceMatched && titleMatched) {
        console.log('✓ PASÓ');
        passed++;
      } else {
        console.log('✗ FALLÓ');
        console.log('  Esperado:', t.expected);
        console.log('  Recibido:', { title: result.data.title, currentPrice: result.data.currentPrice });
      }
    } catch (error) {
      console.error(`✗ ERROR: ${error.message}`);
    }
    console.log('-----------------------------------');
  }

  console.log(`Resumen: ${passed}/${tests.length} pruebas pasaron.`);
}

testPipeline().catch(console.error);
