const fs = require('fs');
const envPath = '.env';
let envContent = fs.readFileSync(envPath, 'utf8');

const token = 'EAAegDE5qzr8BTMZCt1ORTuRemY7Qz6R8ZAeJ3TQVSEYAWREW9JYLCUyKRP7f6ZASHhCmO0ax9njK6pMbkAdjcWZBrX5ZCDbV5999ikk7FY9p2npm0bKEvEqsm9CEZBrxNnxxKpSgvbYiPS1ovfafE2eMDRKY7pYO1ZB7CNZBZCaHNgjpgASDO7ZAWGAuZAsbCbyZAnwtxogIZCvMrUc9xYJcLlx7jZBRv8od8SfrDck72OZByr0k9hKVSxJQ07FmOJg3uQqxCKpJDis3SDT7fAvEXASt5vHpZBglxr1wFFgZD';

if (!envContent.includes('WHATSAPP_ACCESS_TOKEN=')) {
  envContent += `\nWHATSAPP_ACCESS_TOKEN=${token}\n`;
} else {
  envContent = envContent.replace(/WHATSAPP_ACCESS_TOKEN=.*/, `WHATSAPP_ACCESS_TOKEN=${token}`);
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env actualizado con WHATSAPP_ACCESS_TOKEN');
