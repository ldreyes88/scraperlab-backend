const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const DomainConfigService = require('../src/services/DomainConfigService');

async function extractConfig() {
  const domainId = process.argv[2];
  
  if (!domainId) {
    console.error('Uso: node extractConfigDomain.js <dominio.com>');
    process.exit(1);
  }

  console.log(`Buscando configuración para ${domainId}...`);
  
  try {
    const config = await DomainConfigService.getConfig(domainId);
    
    // Formatear nombre de archivo (ej: mercadolibre.com.co -> MercadolibreStrategy.json)
    const baseName = domainId.split('.')[0];
    const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    const fileName = `${formattedName}Strategy.json`;
    
    // Asegurar que el directorio .logs existe
    const logsDir = path.join(__dirname, '../.logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const filePath = path.join(logsDir, fileName);
    
    // Guardar JSON
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    
    console.log(`✓ Configuración extraída correctamente en: .logs/${fileName}`);
    console.log('---');
    console.log(JSON.stringify(config, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

extractConfig();
