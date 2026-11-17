const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

envContent = envContent.replace(/WHATSAPP_PHONE_NUMBER_ID=.*/, 'WHATSAPP_PHONE_NUMBER_ID=1372470465958598');

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env local actualizado con WHATSAPP_PHONE_NUMBER_ID=1372470465958598');
