const successResponse = (data, statusCode = 200) => ({
    statusCode,
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  });
  
  const errorResponse = (message, statusCode = 500, details = null) => ({
    statusCode,
    body: JSON.stringify({
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString()
    })
  });
  
  module.exports = { successResponse, errorResponse };