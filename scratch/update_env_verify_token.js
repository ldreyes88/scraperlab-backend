const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

const token = 'scraperlabs_whatsapp_verify_token';

if (!envContent.includes('WHATSAPP_VERIFY_TOKEN=')) {
  envContent += `\nWHATSAPP_VERIFY_TOKEN=${token}\n`;
} else {
  envContent = envContent.replace(/WHATSAPP_VERIFY_TOKEN=.*/, `WHATSAPP_VERIFY_TOKEN=${token}`);
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env actualizado con WHATSAPP_VERIFY_TOKEN=' + token);
