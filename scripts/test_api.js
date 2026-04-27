const axios = require('axios');
const https = require('https');

async function test() {
  const url = 'https://estadotramiteciud.supernotariado.gov.co/Portal/EstadoTramiteCiud/webresources/tramite/140,2026-140-6-4630';
  
  console.log('📡 Consultando API de Supernotariado...');
  
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.get(url, { httpsAgent: agent });
    
    console.log('✅ Respuesta recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error.message);
    if (error.response) {
      console.log('Detalle:', error.response.data);
    }
  }
}

test();
