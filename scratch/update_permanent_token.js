const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

const token = 'EAAegDE5qzr8BTAzLjNZAd89totV6JC8Gq2AYTvhHDNOmgJio0osNcpX7hepSWnW9keqEjlblJGudm59GoHv1tQQOxT4wlNVqTNuyRaEGzCT7ZAuiAHcxOwoSTZBZBiV8Qbdz76HgkXf5xJizUHedp5y4dMQWMtN8uEcCR6ZBl4d6cD2ZAqouzYiage8NxZCJgZDZD';

if (!envContent.includes('WHATSAPP_ACCESS_TOKEN=')) {
  envContent += `\nWHATSAPP_ACCESS_TOKEN=${token}\n`;
} else {
  envContent = envContent.replace(/WHATSAPP_ACCESS_TOKEN=.*/, `WHATSAPP_ACCESS_TOKEN=${token}`);
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env actualizado con el Token Permanente de Sistema.');
