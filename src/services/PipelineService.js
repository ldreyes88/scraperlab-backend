// src/services/PipelineService.js
const PipelineRepository = require('../repositories/PipelineRepository');
const ProcessRepository = require('../repositories/ProcessRepository');
const ProcessDetailRepository = require('../repositories/ProcessDetailRepository');
const NodeRepository = require('../repositories/NodeRepository');
const AIService = require('./AIService');
const ScraperService = require('./ScraperService');
const { calculateHomologyScore } = require('../utils/HomologyMatcher');
const { nowColombiaISO } = require('../utils/time');

class PipelineService {
  /**
   * Iniciar la ejecución de un pipeline
   * @param {string} pipelineId
   * @param {Object} inputData
   * @param {Object} options - { isSync: boolean }
   */
  async start(pipelineId, inputData = {}, options = {}) {
    const { isSync = false, trigger = 'manual' } = options;

    // Crear el registro de proceso
    const processRecord = await ProcessRepository.create({
      processType: 'pipeline',
      pipelineId: pipelineId,
      status: 'pending',
      input: inputData,
      trigger: trigger,
      steps: []
    });

    const processId = processRecord.processId;

    // Ejecución
    const execution = this.execute(pipelineId, inputData, processId);

    if (isSync) {
      await execution;
    } else {
      // Disparar ejecución en background (para API)
      execution.catch(err => {
        console.error(`[PipelineService] Error crítico:`, err);
        ProcessRepository.updateStatus(processId, 'failed');
      });
    }

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
      const rawNode = pipeline.nodes.find(n => n.id === currentNodeId);
      if (!rawNode) {
        console.warn(`Nodo ${currentNodeId} no encontrado en el pipeline`);
        break;
      }

      // Hidratar nodo desde el catálogo si viene referenciado (nodeRef)
      const node = await this.resolveNodeDefinition(rawNode);

      console.log(`Ejecutando nodo: ${node.id} (${node.type})${node.nodeRef ? ` [ref: ${node.nodeRef}]` : ''}`);
      
      const startTime = Date.now();
      try {
        const nodeResult = await this.executeNode(node, state, pipeline);
        const duration = Date.now() - startTime;
        
        state.nodes[node.id] = nodeResult;
        
        // Detección inteligente de éxito para arrays (como SCRAPE_SEARCH) o objetos simples
        const isSuccess = Array.isArray(nodeResult) 
          ? nodeResult.some(r => r.success !== false && r.data?.success !== false) 
          : nodeResult?.success !== false && nodeResult?.data?.success !== false;

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

        // Determinar siguiente nodo considerando bifurcaciones, branches y acciones
        if (nodeResult && nodeResult.action === 'STOP') {
          console.log(`[Pipeline] Deteniendo ejecución por solicitud del nodo ${node.id}: ${nodeResult.message || 'Sin detalles'}`);
          currentNodeId = null;
          state.stopped = true;
        } else if (nodeResult && nodeResult.nextNode !== undefined) {
          console.log(`[Pipeline] Transición dinámica desde nodo ${node.id} hacia -> ${nodeResult.nextNode || 'FIN'}`);
          currentNodeId = nodeResult.nextNode;
        } else if (node.branches && Array.isArray(node.branches)) {
          const branchedNext = this.evaluateBranches(node.branches, state);
          currentNodeId = branchedNext !== undefined ? branchedNext : node.next;
        } else {
          currentNodeId = node.next;
        }
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
      let finalStatus = 'completed';
      
      if (hasFailedStep) {
        finalStatus = 'failed';
      } else if (state.stopped) {
        finalStatus = 'stopped';
      }

      // Extraer output final si un nodo lo generó (ej: Hunter scraping o Save Result)
      const finalOutput = state.output || 
        state.results.find(r => r.type === 'HUNTER_SCRAPING' || r.type === 'LIVE_HUNTER_SEARCH')?.output || 
        null;
      
      await ProcessRepository.updateStatus(processId, finalStatus, finalOutput);
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
      case 'CONDITION':
        output = await this.handleCondition(node, state, pipeline);
        break;
      case 'HUNTER_SCRAPING':
      case 'LIVE_HUNTER_SEARCH':
        output = await this.handleHunterScraping(node, state);
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
        
        // saveLog = false para no polucionar la tabla de procesos con logs individuales de cada tienda dentro de un pipeline
        const scrapeResult = await ScraperService.scrapeUrl(searchUrl, false, 'search');
        
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
    
    console.log(`[PipelineService] Ejecutando SCRAPE_DETAIL para: ${url}`);
    const result = await ScraperService.scrapeUrl(url, saveLog, 'detail');
    
    // Retornar el objeto completo para que el motor de pipeline vea result.success
    return result;
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
   * Soporta strings, objetos y arrays de forma recursiva.
   */
  resolveTemplate(template, state) {
    if (!template) return template;

    // Si es un objeto o array, procesar recursivamente
    if (typeof template === 'object') {
      if (Array.isArray(template)) {
        return template.map(item => this.resolveTemplate(item, state));
      }
      
      const resolvedObj = {};
      for (const [key, value] of Object.entries(template)) {
        resolvedObj[key] = this.resolveTemplate(value, state);
      }
      return resolvedObj;
    }

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
      const trimmedPath = path.trim();

      // Soporte para {{config.ENV_VAR}} usando variables de entorno
      if (trimmedPath.startsWith('config.')) {
        const envVar = trimmedPath.replace(/^config\./, '');
        return process.env[envVar] !== undefined ? process.env[envVar] : '';
      }

      const parts = trimmedPath.split('.');
      let current = state;
      
      for (const part of parts) {
        if (!current || current[part] === undefined) {
          console.warn(`[Pipeline] Variable {{${trimmedPath}}} no resuelta. Falta '${part}' en el estado.`);
          return match;
        }
        current = current[part];
      }
      
      return typeof current === 'object' ? JSON.stringify(current) : current;
    });
  }
  /**
   * Hidrata un nodo a partir del catálogo independiente si tiene nodeRef
   */
  async resolveNodeDefinition(rawNode) {
    if (!rawNode.nodeRef) {
      return rawNode;
    }

    try {
      const catalogNode = await NodeRepository.getById(rawNode.nodeRef);
      if (!catalogNode) {
        throw new Error(`Nodo referenciado '${rawNode.nodeRef}' no existe en el catálogo ScraperLab-Nodes`);
      }

      return {
        ...catalogNode,
        ...rawNode,
        id: rawNode.id,
        type: rawNode.type || catalogNode.type,
        name: rawNode.name || catalogNode.name,
        category: catalogNode.category || 'general',
        config: {
          ...(catalogNode.defaultConfig || {}),
          ...(rawNode.configOverride || rawNode.config || {})
        },
        next: rawNode.next,
        onError: rawNode.onError,
        branches: rawNode.branches
      };
    } catch (err) {
      console.error(`[resolveNodeDefinition] Error al resolver nodeRef ${rawNode.nodeRef}:`, err.message);
      throw err;
    }
  }

  /**
   * Manejador de CONDITION
   * Soporta tanto evaluación de expresiones lógicas directas (ej: "var > 1" -> onTrue/onFalse)
   * como detección de cambios contra ejecuciones históricas (retrocompatibilidad).
   */
  async handleCondition(node, state, pipeline) {
    const config = node.config || {};
    const { 
      expression, 
      operator, 
      left, 
      onTrue, 
      onFalse,
      compare, 
      onNoChange = 'STOP', 
      onDifference = 'CONTINUE',
      forceEveryHours = null 
    } = config;

    // CASO 1: Condición lógica por expresión o comparación directa ("Si var > 1 --> nodo33")
    if (expression || operator || (left && config.right !== undefined)) {
      const isMet = this.evaluateConditionRule(config, state);
      const nextNode = isMet ? onTrue : onFalse;
      
      console.log(`[ConditionNode] '${node.id}' - Evaluación: ${isMet ? 'TRUE' : 'FALSE'} -> Siguiente nodo: ${nextNode || (isMet ? (node.next || 'TERMINAR') : 'TERMINAR')}`);

      return {
        success: true,
        conditionResult: isMet,
        nextNode: nextNode !== undefined ? nextNode : (isMet ? node.next : null),
        action: nextNode === 'STOP' || (!isMet && onFalse === null) ? 'STOP' : 'CONTINUE',
        message: `Condición ${isMet ? 'cumplida (true)' : 'no cumplida (false)'}`
      };
    }

    // CASO 2: Comparación histórica contra proceso previo (Retrocompatibilidad)
    if (compare) {
      const currentValue = this.resolveTemplate(compare, state);
      console.log(`[ConditionNode] Valor actual para ${node.id}:`, currentValue);

      const lastProcess = await ProcessRepository.findLastByPipeline(pipeline.pipelineId, state.input);
      let hasChanged = true;

      if (lastProcess && lastProcess.steps) {
        const lastNodeResult = lastProcess.steps.find(s => s.nodeId === node.id);
        const lastValue = lastNodeResult?.output?.value;

        console.log(`[ConditionNode] Valor anterior para ${node.id}:`, lastValue);

        if (lastValue !== undefined && lastValue === currentValue) {
          hasChanged = false;

          if (forceEveryHours) {
            const lastTime = new Date(lastProcess.timestamp).getTime();
            const hoursSinceLast = (Date.now() - lastTime) / (1000 * 60 * 60);

            if (hoursSinceLast >= forceEveryHours) {
              console.log(`[ConditionNode] Forzando ejecución por tiempo transcurrido: ${hoursSinceLast.toFixed(1)}h >= ${forceEveryHours}h`);
              hasChanged = true;
            }
          }
        }
      }

      const action = hasChanged ? onDifference : onNoChange;
      console.log(`[ConditionNode] Resultado: ${hasChanged ? 'CAMBIO (o forzado)' : 'SIN CAMBIO'} -> Acción: ${action}`);

      return { 
        success: true, 
        value: currentValue, 
        action: action,
        message: action === 'STOP' ? 'Condición cumplida para detener' : 'Condición cumplida para continuar'
      };
    }

    // Por defecto si no hay configuración
    return { success: true, action: 'CONTINUE' };
  }

  /**
   * Evalúa una regla condicional y retorna true o false
   */
  evaluateConditionRule(config, state) {
    const { expression, left, operator, right } = config;

    // Caso A: Expresión directa, ej: "{{nodes.nodo44.var}} > 1"
    if (expression && typeof expression === 'string') {
      return this.evaluateExpression(expression, state);
    }

    // Caso B: Parámetros estructurados (left, operator, right)
    if (operator) {
      const resolvedLeft = this.resolveTemplate(left, state);
      const resolvedRight = this.resolveTemplate(right, state);
      return this.compareValues(resolvedLeft, operator, resolvedRight);
    }

    return false;
  }

  /**
   * Parsea y evalúa expresiones tipo: "A > B", "A == B", "A <= B", etc.
   */
  evaluateExpression(expression, state) {
    const resolvedExp = this.resolveTemplate(expression, state);

    // Buscar operadores comunes
    const opRegex = /^(.*?)\s*(>=|<=|===|!==|==|!=|>|<|includes|contains)\s*(.*)$/;
    const match = String(resolvedExp).trim().match(opRegex);

    if (!match) {
      const val = this.resolveTemplate(expression, state);
      return Boolean(val && val !== 'false' && val !== '0');
    }

    let [, leftStr, op, rightStr] = match;
    leftStr = leftStr.trim();
    rightStr = rightStr.trim();

    const parseVal = (v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      if (v === 'null') return null;
      if (v === 'undefined') return undefined;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
      }
      if (!isNaN(Number(v))) return Number(v);
      return v;
    };

    const leftVal = parseVal(leftStr);
    const rightVal = parseVal(rightStr);

    return this.compareValues(leftVal, op, rightVal);
  }

  /**
   * Compara dos valores de acuerdo con el operador especificado
   */
  compareValues(left, operator, right) {
    const leftNum = Number(left);
    const rightNum = Number(right);
    const areNumbers = !isNaN(leftNum) && !isNaN(rightNum) && typeof left !== 'boolean' && typeof right !== 'boolean';

    const valL = areNumbers ? leftNum : left;
    const valR = areNumbers ? rightNum : right;

    switch (operator) {
      case '>':
        return valL > valR;
      case '<':
        return valL < valR;
      case '>=':
        return valL >= valR;
      case '<=':
        return valL <= valR;
      case '==':
      case '===':
      case 'equals':
        return valL == valR;
      case '!=':
      case '!==':
        return valL != valR;
      case 'includes':
      case 'contains':
        if (Array.isArray(valL)) return valL.includes(valR);
        return String(valL).includes(String(valR));
      case 'empty':
        return valL === null || valL === undefined || valL === '' || (Array.isArray(valL) && valL.length === 0);
      case 'notEmpty':
        return valL !== null && valL !== undefined && valL !== '' && (!Array.isArray(valL) || valL.length > 0);
      default:
        console.warn(`[Pipeline] Operador condicional desconocido: ${operator}`);
        return false;
    }
  }

  /**
   * Evalúa ramas condicionales opcionales
   */
  evaluateBranches(branches, state) {
    for (const branch of branches) {
      if (branch.if) {
        const matches = this.evaluateExpression(branch.if, state);
        if (matches) {
          return branch.then;
        }
      }
    }
    return undefined;
  }

  /**
   * Manejador de HUNTER_SCRAPING / LIVE_HUNTER_SEARCH
   * Busca simultáneamente en tiempo real en los comercios seleccionados (Alkosto, Éxito, Mercado Libre, etc.)
   * Extrae la posición #1 (Top 1) de cada tienda y clasifica la intención con Gemini.
   */
  async handleHunterScraping(node, state) {
    const query = state.input?.query || state.input?.name || state.input?.product_family_name || '';
    const rawMarkets = state.input?.marketplaces || node.config?.marketplaces || ['exito', 'alkosto', 'mercadolibre'];
    const isGift = Boolean(state.input?.isGift);

    const targetMarkets = Array.isArray(rawMarkets) 
      ? rawMarkets 
      : String(rawMarkets).split(',').map(m => m.trim().toLowerCase());

    console.log(`[Hunter] Iniciando búsqueda multi-sitio en paralelo para: "${query}"`, targetMarkets);

    const MARKETPLACE_CONFIGS = {
      'alkosto': {
        domainId: 'alkosto.com',
        name: 'Alkosto',
        searchUrl: (q) => `https://www.alkosto.com/search?text=${encodeURIComponent(q)}`
      },
      'exito': {
        domainId: 'exito.com',
        name: 'Éxito',
        searchUrl: (q) => `https://www.exito.com/s?q=${encodeURIComponent(q)}`
      },
      'mercadolibre': {
        domainId: 'mercadolibre.com.co',
        name: 'Mercado Libre',
        searchUrl: (q) => `https://listado.mercadolibre.com.co/${encodeURIComponent(q)}`
      },
      'falabella': {
        domainId: 'falabella.com.co',
        name: 'Falabella',
        searchUrl: (q) => `https://www.falabella.com.co/falabella-co/search?Ntt=${encodeURIComponent(q)}`
      },
      'ktronix': {
        domainId: 'ktronix.com',
        name: 'Ktronix',
        searchUrl: (q) => `https://www.ktronix.com/search?text=${encodeURIComponent(q)}`
      }
    };

    const toSafeNumber = (val, fallback = 0) => {
      const n = Number(val);
      return Number.isFinite(n) ? n : fallback;
    };

    // Datos base para evaluación de homología
    const baseProductInfo = {
      name: query,
      price: toSafeNumber(state.input?.price || state.input?.currentPrice || 0),
      brand: state.input?.brand || '',
      category: state.input?.category || ''
    };

    // Scraping en paralelo para todos los comercios seleccionados
    const promises = targetMarkets.map(async (marketKey) => {
      const key = marketKey.toLowerCase().replace(/[^a-z]/g, '');
      console.log(`[Hunter] Ejecutando búsqueda live para ${key} con término "${query}"...`);

      let candidates = [];

      // 1. ÉXITO (Conector nativo VTEX con fallback a host directo VTEX < 150ms)
      if (key === 'exito') {
        try {
          const exitoUrls = [
            `https://exitocol.vtexcommercestable.com.br/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}`,
            `https://www.exito.com/io/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}`,
            `https://www.exito.com/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}`
          ];
          let items = null;
          for (const exitoUrl of exitoUrls) {
            try {
              const res = await fetch(exitoUrl, {
                redirect: 'follow',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/json'
                }
              });
              if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length > 0) {
                  items = json;
                  break;
                }
              }
            } catch (_) {}
          }
          if (items && items.length > 0) {
            candidates = items.slice(0, 3).map((item, idx) => {
              const price = toSafeNumber(item.items?.[0]?.sellers?.[0]?.commertialOffer?.Price, 0);
              const origPrice = toSafeNumber(item.items?.[0]?.sellers?.[0]?.commertialOffer?.ListPrice, price);
              const discount = (origPrice > price && origPrice > 0) ? Math.round(((origPrice - price) / origPrice) * 100) : 0;
              const pName = item.productName || query;
              const rawLink = item.link || (item.linkText ? `https://www.exito.com/${item.linkText}/p` : `https://www.exito.com/s?q=${encodeURIComponent(query)}`);
              const cleanUrl = rawLink.replace('exitocol.vtexcommercestable.com.br', 'www.exito.com');
              return {
                marketplace: 'Éxito',
                marketplaceName: 'Éxito',
                store: 'Éxito',
                domainId: 'exito.com',
                name: pName,
                productName: pName,
                title: pName,
                brand: item.brand || '',
                currentPrice: price,
                originalPrice: origPrice,
                discount,
                url: cleanUrl,
                image: item.items?.[0]?.images?.[0]?.imageUrl || null,
                position: idx + 1
              };
            });
          }
        } catch (err) {
          console.warn('[Hunter] Error en conector directo de Éxito:', err.message);
        }
      }

      // 2. ALKOSTO / KTRONIX (Conector oficial Algolia Search < 100ms)
      else if (key === 'alkosto' || key === 'ktronix') {
        try {
          const appId = 'QX5IPS1B1Q';
          const apiKey = 'ODNiNzFhOTg5MWEyNWYxZGIyMmMyODFjYjNkMWU3NjVhNjUzYzgzZWUwMjkwODI3NmM4MDliNTY4OTEzODc5NCZmaWx0ZXJzPWF2YWlsYWJsZUJ1eUJ1dE5vdFZpc2libGVfYm9vbGVhbiUzQWZhbHNl';
          const indexName = key === 'ktronix' ? 'ktronixIndexAlgoliaPRD' : 'alkostoIndexAlgoliaPRD';
          const algoliaUrl = `https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`;

          const res = await fetch(algoliaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Algolia-Application-Id': appId,
              'X-Algolia-API-Key': apiKey
            },
            body: JSON.stringify({ query, hitsPerPage: 3 })
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.hits) && data.hits.length > 0) {
              const host = key === 'ktronix' ? 'https://www.ktronix.com' : 'https://www.alkosto.com';
              const storeName = key === 'ktronix' ? 'Ktronix' : 'Alkosto';

              candidates = data.hits.slice(0, 3).map((hit, idx) => {
                const price = toSafeNumber(hit.lowestprice_double || hit.discountprice_double || hit.pricevalue_cop_double, 0);
                const origPrice = toSafeNumber(hit.baseprice_cop_string || hit.pricevalue_cop_double, price);
                const discount = toSafeNumber(hit.percentagediscount_string, (origPrice > price && origPrice > 0 ? Math.round(((origPrice - price) / origPrice) * 100) : 0));
                const pUrl = hit.url_es_string ? `${host}${hit.url_es_string}` : `${host}/search?text=${encodeURIComponent(query)}`;
                const pImg = hit['img-750wx750h_string'] || hit['img-310wx310h_string'] || hit['img-1400wx1400h_string'] || null;
                const pName = hit.name_text_es || query;
                const pBrand = hit.brand_string || (Array.isArray(hit.brand_string_mv) ? hit.brand_string_mv[0] : hit.marca_text) || '';

                return {
                  marketplace: storeName,
                  marketplaceName: storeName,
                  store: storeName,
                  domainId: `${key}.com`,
                  name: pName,
                  productName: pName,
                  title: pName,
                  brand: pBrand,
                  currentPrice: price,
                  originalPrice: origPrice,
                  discount,
                  url: pUrl,
                  image: pImg,
                  position: idx + 1
                };
              });
            }
          }
        } catch (err) {
          console.warn(`[Hunter] Error en conector directo de ${key}:`, err.message);
        }
      }

      // 3. MERCADO LIBRE / FALABELLA / OTROS (ScraperService Fallback)
      else {
        const config = MARKETPLACE_CONFIGS[key];
        if (!config) return null;

        const searchUrl = config.searchUrl(query);
        console.log(`[Hunter] Buscando vía ScraperService en ${config.name}: ${searchUrl}`);

        try {
          // saveLog = false para no duplicar un registro 'simple' por cada tienda consultada dentro de un pipeline
          // limit: 3 para extraer únicamente el top 2-3 de resultados por comercio
          const scrapeRes = await ScraperService.scrapeUrl(searchUrl, false, 'search', null, null, 'simple', { limit: 3 });
          if (scrapeRes && scrapeRes.success && Array.isArray(scrapeRes.data?.results) && scrapeRes.data.results.length > 0) {
            candidates = scrapeRes.data.results.slice(0, 3).map((res, idx) => {
              const price = toSafeNumber(res.currentPrice || res.price, 0);
              const origPrice = toSafeNumber(res.originalPrice || res.price, price);
              const discount = toSafeNumber(res.discount, (origPrice > price && origPrice > 0 ? Math.round(((origPrice - price) / origPrice) * 100) : 0));
              const pName = res.title || res.name || query;

              return {
                marketplace: config.name,
                marketplaceName: config.name,
                store: config.name,
                domainId: config.domainId,
                name: pName,
                productName: pName,
                title: pName,
                currentPrice: price,
                originalPrice: origPrice,
                discount,
                url: res.url || res.productUrl || searchUrl,
                image: res.image || res.imageUrl || null,
                position: idx + 1
              };
            });
          }
        } catch (err) {
          console.warn(`[Hunter] Error buscando en ${config.name}:`, err.message);
        }
      }

      if (candidates.length === 0) return null;

      // Evaluar cada candidato con el motor de scoring lógico de homología
      let bestCandidate = null;
      let highestScore = -1;

      for (const cand of candidates) {
        const homology = calculateHomologyScore(baseProductInfo, cand);
        cand.homologyScore = homology.score;
        cand.isMatch = homology.isMatch;
        cand.homologyReasons = homology.reasons;

        if (homology.isMatch && homology.score > highestScore) {
          highestScore = homology.score;
          bestCandidate = cand;
        }
      }

      // Si ningún candidato superó el umbral de homología, no registrar coincidencia espuria
      if (!bestCandidate) {
        console.log(`[Hunter] ⚠️ No se encontró producto homólogo válido en ${key} (Candidatos evaluados: ${candidates.length})`);
        return null;
      }

      console.log(`[Hunter] ✅ Homólogo encontrado en ${key}: "${bestCandidate.name}" con score ${bestCandidate.homologyScore}%`);
      bestCandidate.success = true;
      return bestCandidate;
    });

    const settled = await Promise.all(promises);
    const marketplacesFound = settled.filter(Boolean);

    // Clasificación Determinística / Heurística (100% libre de IA para máximo rendimiento y costo $0)
    const normalizedText = `${query} ${marketplacesFound.map(m => m.name).join(' ')}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const ELECTRO_KEYWORDS = [
      'televisor', 'televisores', 'tv', 'smart tv', 'nevera', 'neveras', 'refrigerador',
      'lavadora', 'lavadoras', 'secadora', 'microondas', 'freidora', 'aire acondicionado',
      'aspiradora', 'licuadora', 'cafetera', 'estufa', 'horno'
    ];

    const TECH_KEYWORDS = [
      'celular', 'celulares', 'smartphone', 'telefono', 'iphone', 'samsung', 'xiaomi',
      'motorola', 'huawei', 'computador', 'computadores', 'laptop', 'portatil', 'portátil',
      'macbook', 'lenovo', 'asus', 'dell', 'hp', 'tablet', 'tablets', 'ipad', 'audifonos', 'audífonos',
      'airpods', 'auriculares', 'smartwatch', 'reloj inteligente', 'consola', 'playstation',
      'ps5', 'xbox', 'nintendo', 'switch', 'monitor', 'teclado', 'mouse', 'gamer',
      'microfono', 'micrófono', 'mic', 'parlante', 'altavoz', 'camara', 'cámara', 'drone', 'dji'
    ];

    const isElectro = ELECTRO_KEYWORDS.some(kw => normalizedText.includes(kw));
    const isTech = TECH_KEYWORDS.some(kw => normalizedText.includes(kw));
    const isTechOrElectro = isElectro || isTech;

    let category = 'Otros';
    if (isElectro) {
      category = 'Electrodomésticos';
    } else if (isTech) {
      category = 'Tecnología';
    }

    // Extracción de nombre representativo desde los comercios o la consulta
    const topMarketName = marketplacesFound.length > 0 ? marketplacesFound[0].name : query;

    const classification = {
      isTechOrElectro,
      category,
      name: topMarketName || query,
      brand: 'Genérica',
      giftRecommendation: null
    };

    const outputResult = {
      success: true, // El nodo Hunter se ejecutó exitosamente
      foundCount: marketplacesFound.length,
      query,
      name: classification.name || query,
      brand: classification.brand || 'Genérica',
      category: classification.category || 'Tecnología',
      isTechOrElectro: Boolean(classification.isTechOrElectro),
      giftRecommendation: null,
      marketplacesFound,
      totalMarketsFound: marketplacesFound.length
    };

    state.output = outputResult;
    return outputResult;
  }
}

module.exports = new PipelineService();
