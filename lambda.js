const serverless = require('serverless-http');
const app = require('./server');

const handler = serverless(app, {
  binary: ['image/*'],
  request: (request, event, context) => {
    console.log('📥 Lambda request:', {
      method: request.method,
      url: request.url,
      path: event.path || event.rawPath,  // API Gateway v1 || Function URL/v2
      stage: process.env.STAGE
    });
  },
  response: (response, event, context) => {
    console.log('📤 Lambda response:', {
      statusCode: response.statusCode,
      stage: process.env.STAGE
    });
    
    // Forzar headers CORS para evitar problemas de origin bloqueado
    // Especialmente importante para respuestas generadas por middleware de error
    response.headers = response.headers || {};
    response.headers['Access-Control-Allow-Origin'] = '*';
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,X-Api-Key,Authorization';
  }
});

module.exports.handler = handler;