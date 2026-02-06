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
    
    // Forzar CORS
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };
  }
});

module.exports.handler = handler;