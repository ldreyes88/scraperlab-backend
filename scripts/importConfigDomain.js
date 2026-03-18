const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const DomainConfigService = require('../src/services/DomainConfigService');

/**
 * Script para importar una configuración de dominio desde un archivo JSON.
 * Uso: node scripts/importConfigDomain.js <ruta_al_archivo.json>
 */
async function importConfig() {
  const filePathArg = process.argv[2];
  
  if (!filePathArg) {
    console.error('Uso: node importConfigDomain.js <archivo.json>');
    console.error('Ejemplo: node scripts/importConfigDomain.js .logs/Mac-centerStrategy.json');
    process.exit(1);
  }

  // Resolver ruta (puede ser relativa al comando o absoluta)
  const filePath = path.isAbsolute(filePathArg) 
    ? filePathArg 
    : path.resolve(process.cwd(), filePathArg);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: El archivo ${filePath} no existe.`);
    process.exit(1);
  }

  try {
    console.log(`Leyendo archivo: ${filePathArg}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    // El domainId es obligatorio para identificar el registro en DynamoDB
    const domainId = config.domainId;
    
    if (!domainId) {
      console.error('Error: El archivo JSON no contiene la propiedad "domainId".');
      process.exit(1);
    }

    console.log(`🚀 Importando configuración para: ${domainId}...`);
    
    // Usar el servicio oficial de la aplicación para guardar en la BD
    // Esto asegura que se apliquen las validaciones y los formatos correctos
    await DomainConfigService.createOrUpdateConfig(domainId, config);
    
    console.log(`\n✅ ¡Éxito! La configuración de ${domainId} ha sido actualizada en la base de datos.`);
    
  } catch (error) {
    console.error('\n❌ Error durante la importación:');
    console.error(error.message);
    if (error.stack && process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

importConfig();
