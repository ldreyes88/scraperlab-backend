// src/services/PipelineService.js
const PipelineRepository = require('../repositories/PipelineRepository');
const ProcessRepository = require('../repositories/ProcessRepository');
const ProcessDetailRepository = require('../repositories/ProcessDetailRepository');
const AIService = require('./AIService');
const ScraperService = require('./ScraperService');
const { nowColombiaISO } = require('../utils/time');

class PipelineService {
  /**
   * Iniciar la ejecución de un pipeline de forma asíncrona
   */
  async start(pipelineId, inputData = {}) {
    // Crear el registro de proceso
    const processRecord = await ProcessRepository.create({
      processType: 'pipeline',
      pipelineId: pipelineId,
      status: 'pending',
      input: inputData,
      steps: []
    });

    const processId = processRecord.processId;

    // Disparar ejecución en background
    this.execute(pipelineId, inputData, processId).catch(err => {
      console.error(`[PipelineService] Error crítico:`, err);
      ProcessRepository.updateStatus(processId, 'failed');
    });

    return processId;
  }

  /**
   * Ejecutar un pipeline por ID
   */
  async execute(pipelineId, inputData = {}, processId = null) {
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
      config: process.env,
      startTime: nowColombiaISO()
    };

    console.log(`Iniciando ejecución de pipeline: ${pipelineId}${processId ? ` (Process: ${processId})` : ''}`);

    if (processId) {
      await ProcessRepository.updateStatus(processId, 'running');
    }

    // Empezar por el nodo 'start' o el primero de la lista
    let currentNodeId = pipeline.startNodeId || (pipeline.nodes && pipeline.nodes[0]?.id);
    
    while (currentNodeId) {
      const node = pipeline.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        console.warn(`Nodo ${currentNodeId} no encontrado en el pipeline`);
        break;
      }

      console.log(`Ejecutando nodo: ${node.id} (${node.type})`);
      
      const startTime = Date.now();
      try {
        const nodeResult = await this.executeNode(node, state, pipeline);
        const duration = Date.now() - startTime;
        
        state.nodes[node.id] = nodeResult;
        
        // Detección inteligente de éxito para arrays (como SCRAPE_SEARCH) o objetos simples
        const isSuccess = Array.isArray(nodeResult) 
          ? nodeResult.some(r => r.success !== false) // Al menos uno exitoso en la lista
          : nodeResult?.success !== false;

        state.results.push({
          nodeId: node.id,
          type: node.type,
          success: isSuccess,
          output: nodeResult,
          duration
        });

        if (processId) {
          await ProcessDetailRepository.create({
            processId,
            nodeId: node.id,
            nodeType: node.type,
            success: isSuccess,
            data: nodeResult,
            responseTime: duration
          }).catch(e => console.error(`Error guardando detalle del nodo ${node.id}:`, e));
        }

        if (!isSuccess) {
          throw new Error(nodeResult.error ? JSON.stringify(nodeResult.error) : `El nodo ${node.id} no devolvió resultados satisfactorios`);
        }

        // Determinar siguiente nodo
        currentNodeId = node.next;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Pipeline Error] pipeline: ${pipelineId} | process: ${processId} | node: ${node.id} (${node.type}) - Details:`, error.message);
        // Ya se registró el error si el try falló limpiamente con success: false,
        // pero si fue una excepción directa, lo registramos.
        if (!state.results.find(r => r.nodeId === node.id && r.success === false)) {
          state.results.push({
            nodeId: node.id,
            type: node.type,
            success: false,
            error: error.message,
            duration
          });

          if (processId) {
            await ProcessDetailRepository.create({
              processId,
              nodeId: node.id,
              nodeType: node.type,
              success: false,
              error: error.message,
              responseTime: duration
            }).catch(e => console.error(`Error guardando detalle de error en nodo ${node.id}:`, e));
          }
        }

        // Determinar siguiente paso desde el error handler
        currentNodeId = node.onError || null;
      }
      
      // Actualizar progreso en el repositorio de procesos si aplica
      if (processId) {
        await ProcessRepository.updateSteps(processId, state.results);
      }
      
      // Si no hay nodo siguiente, rompemos el ciclo
      if (!currentNodeId) break;
    }

    if (processId) {
      // Determinar el status final analizando si hubo error
      const hasFailedStep = state.results.some(r => !r.success);
      await ProcessRepository.updateStatus(processId, hasFailedStep ? 'failed' : 'completed');
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
    const { queryTemplate, limit = 5 } = node.config;
    const query = this.resolveTemplate(queryTemplate, state);
    
    // Resolver domainIds dinámicamente si es un template
    let domainIds = this.resolveTemplate(node.config.domainIds, state);
    
    // Asegurarse de que domainIds sea un array
    if (!Array.isArray(domainIds)) {
      if (typeof domainIds === 'string') {
        try {
          // Intentar parsear si viene como string JSON (ej: de un prompt de AI)
          const parsed = JSON.parse(domainIds);
          domainIds = Array.isArray(parsed) ? parsed : [domainIds];
        } catch (e) {
          // Si no es JSON, tratar como un ID único o lista separada por comas
          domainIds = domainIds.includes(',') 
            ? domainIds.split(',').map(d => d.trim()) 
            : [domainIds];
        }
      } else {
        domainIds = [];
      }
    }

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

    // Auto-inyectar API key interna si es para Oferty
    const internalUrl = process.env.OFERTY_INTERNAL_API_URL;
    const internalKey = process.env.OFERTY_INTERNAL_API_KEY;
    if (internalUrl && url.startsWith(internalUrl) && internalKey && !headers['x-internal-api-key']) {
      headers['x-internal-api-key'] = internalKey;
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
        data: response.data
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
    
    // Si el template es exactamente un tag {{variable}}, devolvemos el valor crudo (obj, array, etc)
    const trimmed = template.trim();
    const tagMatch = trimmed.match(/^\{\{(.+?)\}\}$/);
    
    if (tagMatch && !trimmed.includes('}} {{')) {
      const path = tagMatch[1].trim();
      const parts = path.split('.');
      let current = state;
      let found = true;
      
      for (const part of parts) {
        if (!current || current[part] === undefined) {
          found = false;
          break;
        }
        current = current[part];
      }
      
      if (found) return current;
    }
    
    // Reemplazo estándar para templates compuestos (devuelve siempre string)
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let current = state;
      
      for (const part of parts) {
        if (!current || current[part] === undefined) {
          console.warn(`[Pipeline] Variable {{${path.trim()}}} no resuelta. Falta '${part}' en el estado.`);
          return match;
        }
        current = current[part];
      }
      
      return typeof current === 'object' ? JSON.stringify(current) : current;
    });
  }
}

module.exports = new PipelineService();
