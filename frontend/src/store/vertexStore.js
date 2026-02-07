import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Store Zustand para Vertex IA - Asistente conversacional
 *
 * Caracteristicas:
 * - Persistencia de session_id en localStorage
 * - Historial de mensajes en memoria
 * - Alertas proactivas
 * - Sugerencias contextuales
 * - Estado de conexion
 */
export const useVertexStore = create(
  persist(
    (set, get) => ({
      // ==================== Estado de Chat ====================
      messages: [],
      isOpen: false,
      isLoading: false,
      isTyping: false,  // Vertex esta "pensando"
      error: null,

      // ==================== Sesion ====================
      sessionId: null,
      greeting: null,

      // ==================== Contexto ====================
      currentPage: null,
      pageContext: {},

      // ==================== Alertas Proactivas ====================
      pendingAlerts: [],
      alertsLoading: false,

      // ==================== Sugerencias ====================
      suggestions: [],

      // ==================== Acciones de Chat ====================

      openChat: (context = {}) => {
        set({
          isOpen: true,
          currentPage: context.page || null,
          pageContext: context,
        })
      },

      closeChat: () => set({ isOpen: false }),

      toggleChat: () => set(state => ({ isOpen: !state.isOpen })),

      setSessionId: (sessionId) => set({ sessionId }),

      setGreeting: (greeting) => set({ greeting }),

      // Agregar mensaje generico
      addMessage: (message) => {
        const newMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          ...message
        }
        set(state => ({
          messages: [...state.messages, newMessage]
        }))
        return newMessage
      },

      // Agregar mensaje del usuario
      addUserMessage: (content) => {
        return get().addMessage({
          role: 'user',
          content,
        })
      },

      // Agregar mensaje de Vertex
      addAssistantMessage: (content, metadata = {}) => {
        return get().addMessage({
          role: 'assistant',
          content,
          ...metadata,
        })
      },

      // Marcar ultimo mensaje con sugerencias
      setLastMessageSuggestions: (suggestions) => {
        set(state => {
          const messages = [...state.messages]
          if (messages.length > 0) {
            const lastIdx = messages.length - 1
            messages[lastIdx] = {
              ...messages[lastIdx],
              suggestions,
            }
          }
          return { messages }
        })
      },

      setLoading: (isLoading) => set({ isLoading }),

      setTyping: (isTyping) => set({ isTyping }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      // ==================== Acciones de Sugerencias ====================

      setSuggestions: (suggestions) => set({ suggestions }),

      clearSuggestions: () => set({ suggestions: [] }),

      // ==================== Acciones de Alertas ====================

      setAlerts: (alerts) => set({ pendingAlerts: alerts }),

      addAlert: (alert) => set(state => ({
        pendingAlerts: [...state.pendingAlerts, alert]
      })),

      dismissAlert: (alertId) => set(state => ({
        pendingAlerts: state.pendingAlerts.filter(a => a.id !== alertId)
      })),

      markAlertShown: (alertId) => set(state => ({
        pendingAlerts: state.pendingAlerts.map(a =>
          a.id === alertId ? { ...a, shown: true } : a
        )
      })),

      setAlertsLoading: (loading) => set({ alertsLoading: loading }),

      // ==================== Acciones de Contexto ====================

      setContext: (context) => {
        set(state => ({
          currentPage: context.page || state.currentPage,
          pageContext: { ...state.pageContext, ...context },
        }))
      },

      // ==================== Utilidades ====================

      getLastMessage: () => {
        const messages = get().messages
        return messages.length > 0 ? messages[messages.length - 1] : null
      },

      getMessageCount: () => get().messages.length,

      getUnshownAlertsCount: () => {
        return get().pendingAlerts.filter(a => !a.shown).length
      },

      // Limpiar mensajes pero mantener sessionId
      clearMessages: () => set({
        messages: [],
        suggestions: [],
      }),

      // Reset completo
      reset: () => set({
        messages: [],
        isOpen: false,
        isLoading: false,
        isTyping: false,
        error: null,
        sessionId: null,
        greeting: null,
        currentPage: null,
        pageContext: {},
        pendingAlerts: [],
        alertsLoading: false,
        suggestions: [],
      }),

      // Nueva conversacion (mantiene alertas)
      startNewConversation: () => set(state => ({
        messages: [],
        sessionId: null,
        suggestions: [],
        error: null,
        // Mantener: isOpen, pendingAlerts, currentPage, pageContext
      })),
    }),
    {
      name: 'vertex-storage',
      // Solo persistir sessionId para poder reanudar conversacion
      partialize: (state) => ({
        sessionId: state.sessionId,
      }),
    }
  )
)

// ==================== Selectores ====================

// Selector para obtener mensajes formateados para UI
export const selectFormattedMessages = (state) => {
  return state.messages.map(msg => ({
    ...msg,
    isUser: msg.role === 'user',
    isAssistant: msg.role === 'assistant',
    formattedTime: msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
  }))
}

// Selector para alertas no mostradas
export const selectUnshownAlerts = (state) => {
  return state.pendingAlerts.filter(a => !a.shown)
}

// Selector para alertas por prioridad
export const selectAlertsByPriority = (state) => {
  return [...state.pendingAlerts].sort((a, b) => a.priority - b.priority)
}

// Granular selectors for state values
export const useVertexMessages = () => useVertexStore(s => s.messages);
export const useVertexIsOpen = () => useVertexStore(s => s.isOpen);
export const useVertexIsLoading = () => useVertexStore(s => s.isLoading);
export const useVertexSessionId = () => useVertexStore(s => s.sessionId);
export const useVertexAlerts = () => useVertexStore(s => s.pendingAlerts);
