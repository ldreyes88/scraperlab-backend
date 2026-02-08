const { nowColombiaISO } = require('./time');

const successResponse = (data, statusCode = 200) => ({
    statusCode,
    body: JSON.stringify({
      success: true,
      data,
      timestamp: nowColombiaISO()
    })
  });
  
  const errorResponse = (message, statusCode = 500, details = null) => ({
    statusCode,
    body: JSON.stringify({
      success: false,
      error: message,
      details,
      timestamp: nowColombiaISO()
    })
  });
  
  module.exports = { successResponse, errorResponse };