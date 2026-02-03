/**
 * Extrae el dominio principal de una URL
 */
function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      throw new Error(`URL inválida: ${url}`);
    }
  }
  
  /**
   * Valida formato de URL
   */
  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
  
  /**
   * Sleep helper
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  module.exports = {
    extractDomain,
    isValidUrl,
    sleep
  };