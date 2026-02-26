require('dotenv').config();
const fs = require('fs');
const path = require('path');
const DomainConfigService = require('../src/services/DomainConfigService');

async function importLegacyStrategy() {
  const domainId = process.argv[2];
  const strategyFilePath = process.argv[3];
  
  if (!domainId || !strategyFilePath) {
    console.error('Uso: node importLegacyStrategy.js <dominio.com> <path_al_archivo_js>');
    console.error('Ejemplo: node scripts/importLegacyStrategy.js alkomprar.com src/strategies/domain/alkomprar.com/AlkomprarDetailStrategy.js');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(strategyFilePath) 
    ? strategyFilePath 
    : path.join(process.cwd(), strategyFilePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: El archivo ${absolutePath} no existe.`);
    process.exit(1);
  }

  console.log(`Analizando estrategia legacy para: ${domainId}...`);
  const content = fs.readFileSync(absolutePath, 'utf8');

  // Inicializar nueva configuración modular
  const config = {
    useJsonLd: true,
    useMeta: true,
    useCss: true,
    useScripts: false,
    useNextData: false,
    scriptPatterns: [],
    selectors: {
      priceSelector: '',
      originalPriceSelector: '',
      titleSelector: '',
      imageSelector: ''
    },
    strategyOrder: ['jsonLd', 'scripts', 'css', 'meta', 'nextData'],
    providerId: 'scraperapi',
    providerConfig: {
      render: content.includes('render: true'),
      premium: true
    }
  };

  // 1. EXTRAER REGEX PATTERNS (Scripts)
  // Busca .match(/.../) o Regex literales
  const regexPatterns = [
    { key: 'currentPrice', patterns: [/price["']?:\s*["']?(\d+(?:\.\d+)?)["']?/, /salePrice["']?:\s*["']?(\d+(?:\.\d+)?)["']?/] },
    { key: 'originalPrice', patterns: [/previousPrice["']?:\s*["']?(\d+(?:\.\d+)?)["']?/, /originalPrice["']?:\s*["']?(\d+(?:\.\d+)?)["']?/, /listPrice["']?:\s*["']?(\d+(?:\.\d+)?)["']?/] },
    { key: 'title', patterns: [/name["']?:\s*["']?([^"']+)["']?/, /title["']?:\s*["']?([^"']+)["']?/] }
  ];

  // Intentar encontrar los regex específicos usados en el código
  const regexLiteralMatch = content.match(/\/[^/]+\/\s*[,\])]/g);
  if (regexLiteralMatch) {
    config.useScripts = true;
    regexLiteralMatch.forEach(m => {
      const pattern = m.match(/\/(.*?)\//)[1];
      if (pattern.length < 5) return; // Ignorar regex muy cortos/errores

      let key = 'currentPrice';
      if (pattern.toLowerCase().includes('prev') || pattern.toLowerCase().includes('orig') || pattern.toLowerCase().includes('list') || pattern.toLowerCase().includes('before')) {
        key = 'originalPrice';
      } else if (pattern.toLowerCase().includes('name') || pattern.toLowerCase().includes('title')) {
        key = 'title';
      }
      
      // Evitar duplicados
      if (!config.scriptPatterns.find(p => p.regex === pattern)) {
        config.scriptPatterns.push({ key, regex: pattern });
      }
    });
  }

  // También buscar coincidencias de match() explícitas
  const codeRegexMatch = content.match(/\.match\(\/(.*?)\/\)/g);
  if (codeRegexMatch) {
    config.useScripts = true;
    codeRegexMatch.forEach(m => {
      const pattern = m.match(/\/(.*?)\//)[1];
      let key = 'currentPrice';
      if (pattern.toLowerCase().includes('prev') || pattern.toLowerCase().includes('orig') || pattern.toLowerCase().includes('list')) {
        key = 'originalPrice';
      } else if (pattern.toLowerCase().includes('name') || pattern.toLowerCase().includes('title')) {
        key = 'title';
      }
      
      if (!config.scriptPatterns.find(p => p.regex === pattern)) {
        config.scriptPatterns.push({ key, regex: pattern });
      }
    });
  }

  // 2. EXTRAER SELECTORES CSS
  // Busca $('selector') 
  const cssMatches = content.match(/\$\(['"]([^'"]+)['"]\)/g);
  if (cssMatches) {
    cssMatches.forEach(m => {
      const selector = m.match(/\(['"]([^'"]+)['"]\)/)[1];
      // Heurística simple para asignar selectores
      const lowS = selector.toLowerCase();
      if (!config.selectors.priceSelector && (lowS.includes('price') && !lowS.includes('orig') && !lowS.includes('old'))) {
        config.selectors.priceSelector = selector;
      } else if (!config.selectors.originalPriceSelector && (lowS.includes('orig') || lowS.includes('old') || lowS.includes('list') || lowS.includes('before'))) {
        config.selectors.originalPriceSelector = selector;
      } else if (!config.selectors.titleSelector && (lowS.includes('title') || lowS.includes('name') || lowS.includes('h1'))) {
        config.selectors.titleSelector = selector;
      } else if (!config.selectors.imageSelector && (lowS.includes('image') || lowS.includes('photo') || lowS.includes('img'))) {
        config.selectors.imageSelector = selector;
      }
    });
  }

  // Ajustar prioridad si usa scripts
  if (config.useScripts) {
    config.strategyOrder = ['scripts', 'jsonLd', 'css', 'meta', 'nextData'];
  }

  console.log('--- Migración Propuesta ---');
  console.log(JSON.stringify(config, null, 2));
  console.log('---------------------------');

  try {
    // Verificar si el dominio ya existe para hacer merge
    let existingConfig = {};
    try {
      existingConfig = await DomainConfigService.getConfig(domainId);
      console.log('Fusionando con configuración existente...');
    } catch (e) {
      console.log('Creando nueva configuración...');
    }

    const finalConfig = {
      ...existingConfig,
      ...config,
      // No sobreescribir si ya tenía datos manuales mejores, a menos que sea nuevo
      selectors: { ...config.selectors, ...(existingConfig.selectors || {}) },
      scriptPatterns: config.scriptPatterns.length > 0 ? config.scriptPatterns : (existingConfig.scriptPatterns || [])
    };

    await DomainConfigService.createOrUpdateConfig(domainId, finalConfig);
    console.log(`\n✓ Dominio ${domainId} migrado e importado en BD con éxito.`);
    
    // Crear respaldo del JSON en .logs
    const logsDir = path.join(__dirname, '../.logs');
    const fileName = `${domainId.split('.')[0]}Migration.json`;
    fs.writeFileSync(path.join(logsDir, fileName), JSON.stringify(finalConfig, null, 2));
    console.log(`✓ Backup de la migración guardado en .logs/${fileName}`);

  } catch (error) {
    console.error('Error al guardar en BD:', error.message);
  }
}

importLegacyStrategy();
