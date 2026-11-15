const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

const phoneNumberId = '1459103610618616';

if (!envContent.includes('WHATSAPP_PHONE_NUMBER_ID=')) {
  envContent += `\nWHATSAPP_PHONE_NUMBER_ID=${phoneNumberId}\n`;
} else {
  envContent = envContent.replace(/WHATSAPP_PHONE_NUMBER_ID=.*/, `WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId}`);
}

if (!envContent.includes('WHATSAPP_VERIFY_TOKEN=')) {
  envContent += `WHATSAPP_VERIFY_TOKEN=scraperlab_whatsapp_verify_token\n`;
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env actualizado con WHATSAPP_PHONE_NUMBER_ID=' + phoneNumberId);
