/**
 * Servicio de API para Vertex IA
 *
 * Maneja la comunicacion con los endpoints de Vertex IA:
 * - Chat conversacional
 * - Alertas proactivas
 * - Sugerencias contextuales
 * - Sesiones y historial
 */

import api from './api'

const VERTEX_BASE = '/vertex'

/**
 * Servicio de Vertex IA
 */
const vertexService = {
  // ==================== Status ====================

  /**
   * Obtiene el estado del servicio Vertex IA
   * @returns {Promise<{ok: boolean, available: boolean, gemini_configured: boolean}>}
   */
  async getStatus() {
    const response = await api.get(`${VERTEX_BASE}/status`)
    return response.data
  },

  // ==================== Chat ====================

  /**
   * Envia un mensaje al chat y obtiene respuesta de Vertex
   * @param {string} message - Mensaje del usuario
   * @param {string} [sessionId] - ID de sesion existente (opcional)
   * @param {Object} [context] - Contexto adicional (page, solicitud_id, etc.)
   * @returns {Promise<{ok: boolean, response: string, session_id: string, suggestions: string[]}>}
   */
  async chat(message, sessionId = null, context = {}) {
    const response = await api.post(`${VERTEX_BASE}/chat`, {
      message,
      session_id: sessionId,
      context,
    })
    return response.data
  },

  // ==================== Sugerencias ====================

  /**
   * Obtiene sugerencias contextuales basadas en la pagina actual
   * @param {string} [page='default'] - Nombre de la pagina actual
   * @param {Object} [params] - Parametros adicionales
   * @returns {Promise<{ok: boolean, greeting: string, suggestions: string[]}>}
   */
  async getSuggestions(page = 'default', params = {}) {
    const response = await api.get(`${VERTEX_BASE}/suggestions`, {
      params: { page, ...params },
    })
    return response.data
  },

  // ==================== Alertas ====================

  /**
   * Obtiene alertas proactivas pendientes
   * @returns {Promise<{ok: boolean, alerts: Array, count: number}>}
   */
  async getAlerts() {
    const response = await api.get(`${VERTEX_BASE}/alerts`)
    return response.data
  },

  /**
   * Descarta una alerta
   * @param {number} alertId - ID de la alerta
   * @returns {Promise<{ok: boolean, alert_id: number}>}
   */
  async dismissAlert(alertId) {
    const response = await api.post(`${VERTEX_BASE}/alerts/${alertId}/dismiss`)
    return response.data
  },

  /**
   * Marca una alerta como mostrada
   * @param {number} alertId - ID de la alerta
   * @returns {Promise<{ok: boolean, alert_id: number}>}
   */
  async markAlertShown(alertId) {
    const response = await api.post(`${VERTEX_BASE}/alerts/${alertId}/shown`)
    return response.data
  },

  // ==================== Sesiones ====================

  /**
   * Inicia una nueva sesion de chat
   * @param {Object} [context] - Contexto inicial
   * @returns {Promise<{ok: boolean, session_id: string, greeting: string}>}
   */
  async startSession(context = {}) {
    const response = await api.post(`${VERTEX_BASE}/session/start`, { context })
    return response.data
  },

  /**
   * Intenta reanudar la ultima sesion activa
   * @returns {Promise<{ok: boolean, has_active_session: boolean, session_id: string, messages: Array}>}
   */
  async resumeSession() {
    const response = await api.get(`${VERTEX_BASE}/session/resume`)
    return response.data
  },

  // ==================== Historial ====================

  /**
   * Obtiene historial de conversaciones del usuario
   * @param {number} [limit=10] - Numero maximo de conversaciones
   * @returns {Promise<{ok: boolean, conversations: Array, total: number}>}
   */
  async getHistory(limit = 10) {
    const response = await api.get(`${VERTEX_BASE}/history`, {
      params: { limit },
    })
    return response.data
  },
}

export default vertexService

// ==================== Hooks Helpers ====================

/**
 * Funcion helper para enviar mensaje y actualizar store
 * @param {Object} store - Store de Vertex (useVertexStore)
 * @param {string} message - Mensaje a enviar
 */
export async function sendVertexMessage(store, message) {
  const {
    sessionId,
    pageContext,
    addUserMessage,
    addAssistantMessage,
    setLoading,
    setTyping,
    setError,
    setSessionId,
    setSuggestions,
  } = store

  // Agregar mensaje del usuario inmediatamente
  addUserMessage(message)
  setLoading(true)
  setTyping(true)
  setError(null)

  try {
    const result = await vertexService.chat(message, sessionId, pageContext)

    if (result.ok) {
      // Guardar session_id si es nueva
      if (result.session_id && result.session_id !== sessionId) {
        setSessionId(result.session_id)
      }

      // Agregar respuesta de Vertex
      addAssistantMessage(result.response, {
        suggestions: result.suggestions || [],
      })

      // Actualizar sugerencias globales
      if (result.suggestions) {
        setSuggestions(result.suggestions)
      }
    } else {
      setError(result.error?.message || 'Error al procesar mensaje')
      addAssistantMessage(
        'Uh, tuve un problema procesando tu mensaje. Podes intentar de nuevo?'
      )
    }
  } catch (error) {
    setError(error.message || 'Error de conexion')
    addAssistantMessage(
      'Parece que hay un problema de conexion. Podes intentar de nuevo en unos segundos?'
    )
  } finally {
    setLoading(false)
    setTyping(false)
  }
}

/**
 * Funcion helper para cargar alertas
 * @param {Object} store - Store de Vertex (useVertexStore)
 */
export async function loadVertexAlerts(store) {
  const { setAlerts, setAlertsLoading } = store

  setAlertsLoading(true)

  try {
    const result = await vertexService.getAlerts()
    if (result.ok) {
      setAlerts(result.alerts || [])
    }
  } catch (error) {
    // Ignorar: si fallan las alertas se deja la lista previa sin romper la UI
    console.debug('[vertex] error cargando alertas:', error)
  } finally {
    setAlertsLoading(false)
  }
}

/**
 * Funcion helper para inicializar Vertex (resume o start session)
 * @param {Object} store - Store de Vertex (useVertexStore)
 * @param {Object} [context] - Contexto inicial
 */
export async function initializeVertex(store, context = {}) {
  const {
    sessionId,
    setSessionId,
    setGreeting,
    setContext,
    addAssistantMessage,
    messages,
  } = store

  setContext(context)

  try {
    // Intentar reanudar sesion existente
    if (sessionId) {
      const resumeResult = await vertexService.resumeSession()
      if (resumeResult.ok && resumeResult.has_active_session) {
        // Sesion reanudada exitosamente
        // Los mensajes ya estan en el servidor, no los cargamos al store
        // para evitar duplicados
        return { resumed: true, sessionId: resumeResult.session_id }
      }
    }

    // Obtener sugerencias y saludo para la pagina
    const suggestResult = await vertexService.getSuggestions(context.page)
    if (suggestResult.ok) {
      setGreeting(suggestResult.greeting)

      // Solo agregar mensaje de bienvenida si no hay mensajes
      if (messages.length === 0) {
        addAssistantMessage(suggestResult.greeting, {
          suggestions: suggestResult.suggestions,
        })
      }
    }

    return { resumed: false, sessionId: null }
  } catch (error) {
    return { resumed: false, sessionId: null, error }
  }
}
