import { create } from 'zustand'

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
  messages: [
    {
      id: 'initial',
      type: 'bot',
      content: '¡Hola! Soy el asistente SPM. ¿En qué puedo ayudarte? Puedo:',
      timestamp: new Date(),
      suggestions: [
        'Ver mis solicitudes',
        'Analizar una solicitud',
        'Cargar datos de materiales',
        'Obtener recomendaciones'
      ]
    }
  ],
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

  clearMessages: () => set({ messages: [
    {
      id: 'initial',
      type: 'bot',
      content: '¡Hola! Soy el asistente SPM. ¿En qué puedo ayudarte?',
      timestamp: new Date()
    }
  ]}),

  // Utilidades
  getLastMessage: () => {
    const messages = get().messages
    return messages[messages.length - 1]
  },

  getContext: () => get().currentContext,

  reset: () => set({
    messages: [
      {
        id: 'initial',
        type: 'bot',
        content: '¡Hola! Soy el asistente SPM. ¿En qué puedo ayudarte?',
        timestamp: new Date()
      }
    ],
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
