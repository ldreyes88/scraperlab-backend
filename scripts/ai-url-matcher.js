// Archivo: scripts/ai-url-matcher.js
// Prueba Conceptual Fase 2: El Cazador (Buscar el producto web y usar IA para saber cuál link es el real)

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ai = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

async function matchProductUrl(brandName, modelName) {
  if (!SCRAPER_API_KEY) {
    console.error("❌ ERROR: Configura SCRAPER_API_KEY en el .env");
    return;
  }

  // 1. Armar la consulta de búsqueda
  const searchQuery = `${brandName} ${modelName}`.replace(/\s+/g, '-').toLowerCase();
  
  // En este ejemplo usamos MercadoLibre Colombia como la tienda objetivo
  const storeSearchUrl = `https://listado.mercadolibre.com.co/${searchQuery}`;
  console.log(`\n🔍 1. Scrapeando resultados desde: ${storeSearchUrl}`);

  // Pasamos por ScraperAPI para no ser bloqueados
  const apiScraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(storeSearchUrl)}&premium=true&country_code=co`;

  try {
    const response = await axios.get(apiScraperUrl);
    const $ = cheerio.load(response.data);
    
    const candidateLinks = [];
    
    // Extraemos los primeros 5-7 resultados que arroja MercadoLibre
    $('.ui-search-result__wrapper').slice(0, 7).each((i, el) => {
         const title = $(el).find('.ui-search-item__title').text().trim();
         const url = $(el).find('.ui-search-link').attr('href');
         // Solo la fracción del precio
         const price = $(el).find('.andes-money-amount__fraction').first().text().trim();
         
         if (title && url) {
             candidateLinks.push({ id: i+1, title, url, price });
         }
    });

    if (candidateLinks.length === 0) {
         console.log("❌ No se encontraron resultados en la tienda o ScraperAPI falló.");
         return;
    }

    console.log(`📦 Se obtuvieron ${candidateLinks.length} resultados crudos. Evaluando cuál es el real con Inteligencia Artificial...\n`);

    // 2. Invocamos a Gemini como Emparejador (Entity Matcher)
    const prompt = `
    Eres un asistente robótico para data scraping y control de calidad.
    El producto maestro que estamos buscando es: Marca: "${brandName}", Modelo: "${modelName}".
    
    Acabamos de raspar (scrape) una tienda online y nos devolvió estos ${candidateLinks.length} candidatos:
    ${JSON.stringify(candidateLinks, null, 2)}
    
    Tu trabajo es evaluar CUIDADOSAMENTE el 'title' y determinar cuál de esas URLs pertenece al equipo real.
    Regla Crítica: ¡Descarta inmediatamente repuestos, cables, accesorios, partes usadas o modelos equivocados!
    Si ninguno es correcto, marca isMatchFound como false.
    `;

    const result = await ai.generateContent(prompt);
    const aiResponse = await result.response;
    const aiData = JSON.parse(aiResponse.text());

    console.log("🤖 RESPUESTA Y DECISIÓN DE LA IA:");
    console.log(aiData);
    console.log("\n🚀 Este resultado de 'winningUrl' es el que tu batch-process de producción necesita guardar en la BD.");

  } catch (error) {
    console.error("❌ Error en Fase 2:", error.message);
  }
}

// Si no pasamos argumentos en terminal, usará el de tu Torre de Lavado por defecto
const brand = process.argv[2] || "Samsung";
const model = process.argv[3] || "Torre de Lavado 22kg Gas Laundry Hub";

matchProductUrl(brand, model);
