import { create } from 'zustand'
import { getTranslation } from '../context/i18n'

/**
 * Helper to create initial message with current translations
 */
const createInitialMessage = (withSuggestions = true) => ({
  id: 'initial',
  type: 'bot',
  content: getTranslation(
    withSuggestions ? 'chat_greeting_with_options' : 'chat_greeting',
    '¡Hola! Soy el asistente SPM. ¿En qué puedo ayudarte?'
  ),
  timestamp: new Date(),
  ...(withSuggestions && {
    suggestions: [
      getTranslation('chat_suggestion_view_requests', 'Ver mis solicitudes'),
      getTranslation('chat_suggestion_analyze', 'Analizar una solicitud'),
      getTranslation('chat_suggestion_load_materials', 'Cargar datos de materiales'),
      getTranslation('chat_suggestion_recommendations', 'Obtener recomendaciones')
    ]
  })
})

/**
 * Store Zustand para el estado del chat asistente
 * Maneja:
 * - Historial de mensajes
 * - Estado abierto/cerrado
 * - Estado de carga
 * - Contexto actual (página, datos)
 */
export const useChatStore = create((set, get) => ({
  // Estado
  messages: [createInitialMessage(true)],
  isOpen: false,
  isLoading: false,
  error: null,
  currentContext: {
    page: null,
    solicitudId: null,
    userId: null,
    centro: null
  },

  // Acciones
  toggleChat: () => set(state => ({ isOpen: !state.isOpen })),

  openChat: () => set({ isOpen: true }),

  closeChat: () => set({ isOpen: false }),

  addMessage: (message) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
      ...message
    }
    set(state => ({
      messages: [...state.messages, newMessage]
    }))
    return newMessage
  },

  addBotMessage: (content, suggestions = []) => {
    return get().addMessage({
      type: 'bot',
      content,
      suggestions
    })
  },

  addUserMessage: (content) => {
    return get().addMessage({
      type: 'user',
      content
    })
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  setContext: (context) => {
    set(state => ({
      currentContext: { ...state.currentContext, ...context }
    }))
  },

  clearMessages: () => set({ messages: [createInitialMessage(false)] }),

  // Utilidades
  getLastMessage: () => {
    const messages = get().messages
    return messages[messages.length - 1]
  },

  getContext: () => get().currentContext,

  reset: () => set({
    messages: [createInitialMessage(true)],
    isOpen: false,
    isLoading: false,
    error: null,
    currentContext: {
      page: null,
      solicitudId: null,
      userId: null,
      centro: null
    }
  })
}))
