// src/services/PipelineService.js
const PipelineRepository = require('../repositories/PipelineRepository');
const AIService = require('./AIService');
const ScraperService = require('./ScraperService');
const { nowColombiaISO } = require('../utils/time');

class PipelineService {
  /**
   * Ejecutar un pipeline por ID
   */
  async execute(pipelineId, inputData = {}) {
    const pipeline = await PipelineRepository.getById(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} no encontrado`);
    }

    if (!pipeline.enabled) {
      throw new Error(`Pipeline ${pipelineId} está desactivado`);
    }

    const state = {
      input: inputData,
      nodes: {},
      results: [],
      startTime: nowColombiaISO()
    };

    console.log(`Iniciando ejecución de pipeline: ${pipelineId}`);

    // Empezar por el nodo 'start' o el primero de la lista
    let currentNodeId = pipeline.startNodeId || (pipeline.nodes && pipeline.nodes[0]?.id);
    
    while (currentNodeId) {
      const node = pipeline.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        console.warn(`Nodo ${currentNodeId} no encontrado en el pipeline`);
        break;
      }

      console.log(`Ejecutando nodo: ${node.id} (${node.type})`);
      
      try {
        const nodeResult = await this.executeNode(node, state, pipeline);
        state.nodes[node.id] = nodeResult;
        state.results.push({
          nodeId: node.id,
          type: node.type,
          success: true,
          output: nodeResult
        });

        // Determinar siguiente nodo
        currentNodeId = node.next;
      } catch (error) {
        console.error(`Error en nodo ${node.id}:`, error);
        state.results.push({
          nodeId: node.id,
          type: node.type,
          success: false,
          error: error.message
        });
        
        // Si hay un nodo de error definido, ir a él. Si no, detener.
        currentNodeId = node.onError || null;
        if (!currentNodeId) break; 
      }
    }

    state.endTime = nowColombiaISO();
    return state;
  }

  /**
   * Ejecutar un nodo específico
   */
  async executeNode(node, state, pipeline) {
    let output;
    switch (node.type) {
      case 'TRIGGER':
        output = state.input; // El trigger solo pasa el input inicial
        break;
      case 'AI_PROMPT':
        output = await this.handleAIPrompt(node, state);
        break;
      case 'SCRAPE_SEARCH':
        output = await this.handleScrapeSearch(node, state);
        break;
      case 'SCRAPE_DETAIL':
        output = await this.handleScrapeDetail(node, state);
        break;
      case 'DATA_MAPPING':
        output = await this.handleDataMapping(node, state);
        break;
      case 'SAVE_RESULT':
        output = await this.handleSaveResult(node, state, pipeline);
        break;
      case 'API_REQUEST':
        output = await this.handleApiRequest(node, state);
        break;
      default:
        throw new Error(`Tipo de nodo no soportado: ${node.type}`);
    }
    return output;
  }

  /**
   * Manejador de AI_PROMPT
   */
  async handleAIPrompt(node, state) {
    const { providerId, promptTemplate, model, config, isJson = false } = node.config;
    
    // Resolver variables en el template
    const prompt = this.resolveTemplate(promptTemplate, state);
    
    if (isJson) {
      return await AIService.generateJSON(prompt, model, config);
    } else {
      return await AIService.generateContent(prompt, model, config);
    }
  }

  /**
   * Manejador de SCRAPE_SEARCH
   */
  async handleScrapeSearch(node, state) {
    const { domainIds, queryTemplate, limit = 5 } = node.config;
    const query = this.resolveTemplate(queryTemplate, state);
    
    // Obtener configuraciones de los dominios involucrados
    const DomainConfigService = require('./DomainConfigService');
    
    const promises = domainIds.map(async (domainId) => {
      try {
        const config = await DomainConfigService.getConfig(domainId);
        
        // Buscar el template de URL de búsqueda. 
        // Se espera que esté en config.searchUrlTemplate (ej: "https://listado.mercadolibre.com.co/{{query}}")
        const searchUrlTemplate = config.searchUrlTemplate || node.config.searchUrlTemplates?.[domainId];
        
        if (!searchUrlTemplate) {
          throw new Error(`No se encontró searchUrlTemplate para el dominio ${domainId}`);
        }

        // El template del dominio puede usar {{query}}
        const urlNodeState = { ...state, query: encodeURIComponent(query) };
        const searchUrl = this.resolveTemplate(searchUrlTemplate, urlNodeState);

        console.log(`Ejecutando scraping de búsqueda en ${domainId}: ${searchUrl}`);
        
        const scrapeResult = await ScraperService.scrapeUrl(searchUrl, true, 'search');
        
        return {
          domainId,
          success: scrapeResult.success,
          results: (scrapeResult.data?.results || []).slice(0, limit),
          url: searchUrl
        };
      } catch (err) {
        console.error(`Error buscando en dominio ${domainId}:`, err.message);
        return { domainId, success: false, error: err.message };
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Manejador de SCRAPE_DETAIL
   */
  async handleScrapeDetail(node, state) {
    const { urlTemplate, saveLog = true } = node.config;
    const url = this.resolveTemplate(urlTemplate, state);
    
    console.log(`Ejecutando SCRAPE_DETAIL para: ${url}`);
    const result = await ScraperService.scrapeUrl(url, saveLog, 'detail');
    return result.data;
  }

  /**
   * Manejador de SAVE_RESULT
   */
  async handleSaveResult(node, state, pipeline) {
    const { dataTemplate, resultKey = 'finalResult' } = node.config;
    const dataToSave = this.resolveTemplate(dataTemplate, state);
    
    // Por ahora guardamos en la tabla de resultados de pipelines (si existe)
    // O simplemente marcamos el resultado en el log del proceso
    const item = {
      resultId: require('uuid').v4(),
      pipelineId: pipeline?.pipelineId || 'unknown', 
      data: dataToSave,
      timestamp: new Date().toISOString()
    };
    
    // Simulación de guardado por ahora (podríamos crear una tabla dedicada)
    console.log(`[SAVE_RESULT] Guardando resultado:`, JSON.stringify(item, null, 2));
    
    return { success: true, resultId: item.resultId };
  }

  /**
   * Manejador de DATA_MAPPING
   */
  async handleDataMapping(node, state) {
    const { mapping } = node.config;
    const result = {};
    
    for (const [key, template] of Object.entries(mapping)) {
      result[key] = this.resolveTemplate(template, state);
    }
    
    return result;
  }

  /**
   * Manejador de API_REQUEST (Peticiones HTTP externas)
   */
  async handleApiRequest(node, state) {
    const axios = require('axios');
    const { 
      url: urlTemplate, 
      method = 'GET', 
      headers: headersTemplates = {}, 
      bodyTemplate, 
      timeout = 30000 
    } = node.config;

    const url = this.resolveTemplate(urlTemplate, state);
    
    // Resolver headers
    const headers = {};
    for (const [key, template] of Object.entries(headersTemplates)) {
      headers[key] = this.resolveTemplate(template, state);
    }

    // Resolver body si aplica
    let data = null;
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && bodyTemplate) {
      // Si el bodyTemplate es un string que parece un objeto/variable completa {{nodes.x.y}}
      // resolveTemplate lo devolverá como stringified JSON si es un objeto.
      const resolvedBody = this.resolveTemplate(bodyTemplate, state);
      
      try {
        // Intentar parsear si es un string que representa un JSON
        data = typeof resolvedBody === 'string' ? JSON.parse(resolvedBody) : resolvedBody;
      } catch (e) {
        // Si no es JSON válido, enviar como string (ej: form-data o texto plano)
        data = resolvedBody;
      }
    }

    console.log(`[API_REQUEST] ${method} ${url}`);

    try {
      const response = await axios({
        url,
        method: method.toUpperCase(),
        headers,
        data,
        timeout
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      
      console.error(`[API_REQUEST] Error ${status}:`, errorData);
      
      return {
        success: false,
        status,
        error: errorData
      };
    }
  }

  /**
   * Utilidad para resolver variables tipo {{input.productName}} o {{nodes.start.id}}
   */
  resolveTemplate(template, state) {
    if (typeof template !== 'string') return template;
    
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let current = state;
      
      for (const part of parts) {
        if (current[part] === undefined) return match; // Dejar original si no existe
        current = current[part];
      }
      
      return typeof current === 'object' ? JSON.stringify(current) : current;
    });
  }
}

module.exports = new PipelineService();
