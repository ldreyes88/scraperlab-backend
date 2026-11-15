const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

const recipient = '573219662703';

if (!envContent.includes('WHATSAPP_DEFAULT_RECIPIENT=')) {
  envContent += `\nWHATSAPP_DEFAULT_RECIPIENT=${recipient}\n`;
} else {
  envContent = envContent.replace(/WHATSAPP_DEFAULT_RECIPIENT=.*/, `WHATSAPP_DEFAULT_RECIPIENT=${recipient}`);
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env actualizado con WHATSAPP_DEFAULT_RECIPIENT=' + recipient);
