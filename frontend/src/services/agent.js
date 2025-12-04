/**
 * Servicio de API para el Agente ML ReAct
 * Comunica con los endpoints /api/agent/* del backend
 */

import api from './api'

const AGENT_BASE = '/agent'

export const agentService = {
  /**
   * Ejecuta el agente con un objetivo
   */
  execute: async (goal, context = {}, maxIterations = 10) => {
    try {
      const response = await api.post(`${AGENT_BASE}/execute`, {
        goal,
        context,
        max_iterations: maxIterations,
        timeout_seconds: 300
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error ejecutando agente:', error)
      throw error
    }
  },

  /**
   * Obtiene el estado de salud del agente
   */
  health: async () => {
    try {
      const response = await api.get(`${AGENT_BASE}/health`)
      return response.data.data || response.data
    } catch (error) {
      console.error('Error en health check:', error)
      throw error
    }
  },

  /**
   * Carga datos del sistema SPM
   */
  loadData: async (dataType, filters = {}, limit = 100) => {
    try {
      const response = await api.post(`${AGENT_BASE}/data/load`, {
        data_type: dataType,
        filters,
        limit
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error cargando datos:', error)
      throw error
    }
  },

  /**
   * Carga solicitudes del usuario
   */
  loadSolicitudes: async (filters = {}, limit = 100) => {
    return agentService.loadData('solicitudes', filters, limit)
  },

  /**
   * Carga materiales
   */
  loadMateriales: async (filters = {}, limit = 100) => {
    return agentService.loadData('materiales', filters, limit)
  },

  /**
   * Carga presupuestos
   */
  loadPresupuestos: async (filters = {}) => {
    return agentService.loadData('presupuestos', filters)
  },

  /**
   * Carga catálogos
   */
  loadCatalogs: async () => {
    return agentService.loadData('catalogs')
  },

  /**
   * Obtiene memoria del agente
   */
  getMemory: async (depth = 10) => {
    try {
      const response = await api.get(`${AGENT_BASE}/memory`, {
        params: { depth }
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error obteniendo memoria:', error)
      throw error
    }
  },

  /**
   * Limpia memoria del agente
   */
  clearMemory: async () => {
    try {
      const response = await api.delete(`${AGENT_BASE}/memory`)
      return response.data
    } catch (error) {
      console.error('Error limpiando memoria:', error)
      throw error
    }
  },

  /**
   * Lista herramientas disponibles
   */
  listTools: async () => {
    try {
      const response = await api.get(`${AGENT_BASE}/tools`)
      return response.data.data || response.data
    } catch (error) {
      console.error('Error listando herramientas:', error)
      throw error
    }
  },

  /**
   * Entrena un modelo ML
   */
  trainModel: async (modelType, xTrain, yTrain, hyperparams = {}) => {
    try {
      const response = await api.post(`${AGENT_BASE}/ml/train`, {
        model_type: modelType,
        X_train: xTrain,
        y_train: yTrain,
        hyperparams
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error entrenando modelo:', error)
      throw error
    }
  },

  /**
   * Evalúa un modelo ML
   */
  evaluateModel: async (yTrue, yPred, problemType = 'classification', metrics = []) => {
    try {
      const response = await api.post(`${AGENT_BASE}/ml/evaluate`, {
        y_true: yTrue,
        y_pred: yPred,
        problem_type: problemType,
        metrics
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error evaluando modelo:', error)
      throw error
    }
  },

  /**
   * Realiza predicciones con un modelo entrenado
   */
  predict: async (modelName, xTest, returnProbabilities = false) => {
    try {
      const response = await api.post(`${AGENT_BASE}/ml/predict`, {
        model_name: modelName,
        X_test: xTest,
        return_probabilities: returnProbabilities,
        prediction_type: 'confidence'
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error en predicción:', error)
      throw error
    }
  },

  /**
   * Pronostica demanda de un material
   */
  forecastDemand: async (materialCodigo, centro, daysAhead = 30) => {
    try {
      const response = await api.post(`${AGENT_BASE}/forecast/demand`, {
        material_codigo: materialCodigo,
        centro,
        days_ahead: daysAhead,
        confidence_level: 0.95
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error en pronóstico:', error)
      throw error
    }
  },

  /**
   * Calcula puntuación de una solicitud
   */
  scoreSolicitud: async (solicitud, presupuestoDisponible = null) => {
    try {
      const response = await api.post(`${AGENT_BASE}/score/solicitud`, {
        solicitud,
        presupuesto_disponible: presupuestoDisponible
      })
      return response.data.data || response.data
    } catch (error) {
      console.error('Error en scoring:', error)
      throw error
    }
  }
}

export default agentService
