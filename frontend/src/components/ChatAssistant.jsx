import { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2, AlertCircle, Bell } from './ui/Icons'
import { useVertexStore, selectFormattedMessages } from '../store/vertexStore'
import { useAuthStore } from '../store/authStore'
import vertexService, { sendVertexMessage, loadVertexAlerts, initializeVertex } from '../services/vertex'
import { Button } from './ui/Button'

/**
 * Componente ChatAssistant - Vertex IA
 *
 * Chat flotante con personalidad argentina que usa Gemini para generar respuestas.
 * Incluye:
 * - Memoria persistente entre sesiones
 * - Alertas proactivas
 * - Sugerencias contextuales
 */
export default function ChatAssistant() {
  const messagesEndRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  // Vertex store
  const store = useVertexStore()
  const {
    messages,
    isOpen,
    isLoading,
    isTyping,
    error,
    pendingAlerts,
    suggestions,
    greeting,
    closeChat,
    addUserMessage,
    addAssistantMessage,
    setLoading,
    setTyping,
    setError,
    clearError,
    setSessionId,
    setSuggestions,
    pageContext,
    sessionId,
    getUnshownAlertsCount,
  } = store

  const { user } = useAuthStore()

  // Formatear mensajes para UI
  const formattedMessages = selectFormattedMessages(store)

  // Inicializar al abrir
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const context = {
        page: pageContext?.page || 'default',
        userId: user?.id,
        centro: user?.centro,
      }
      initializeVertex(store, context)
      loadVertexAlerts(store)
    }
  }, [isOpen])

  // Cargar alertas periodicamente
  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      loadVertexAlerts(store)
    }, 5 * 60 * 1000) // Cada 5 minutos

    return () => clearInterval(interval)
  }, [isOpen])

  // Auto scroll a los ultimos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Focus en input cuando abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  /**
   * Envia un mensaje a Vertex
   */
  const sendMessage = async (message) => {
    if (!message.trim() || isLoading) return

    setInputValue('')
    clearError()

    // Usar el helper que actualiza el store
    await sendVertexMessage(store, message)
  }

  /**
   * Maneja el envio del formulario
   */
  const handleSendMessage = async (e) => {
    e.preventDefault()
    await sendMessage(inputValue)
  }

  /**
   * Maneja el click en sugerencias
   */
  const handleSuggestion = (suggestion) => {
    sendMessage(suggestion)
  }

  /**
   * Descarta una alerta
   */
  const handleDismissAlert = async (alertId) => {
    try {
      await vertexService.dismissAlert(alertId)
      store.dismissAlert(alertId)
    } catch (error) {
      console.error('Error descartando alerta:', error)
    }
  }

  // Contador de alertas no mostradas
  const unshownAlertsCount = getUnshownAlertsCount()

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-6 z-50 w-full max-w-sm h-[520px]
                    bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl
                    border border-white/50 dark:border-white/10
                    rounded-2xl shadow-glass
                    flex flex-col
                    animate-scale-in"
    >
      {/* Header - Vertex IA */}
      <div className="px-4 py-3 border-b border-white/30 dark:border-white/10 flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <div className="flex items-center gap-3">
          {/* Avatar Vertex */}
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600
                          flex items-center justify-center shadow-lg shadow-violet-500/25">
              <span className="text-white text-sm font-bold">V</span>
            </div>
            {/* Indicador de estado */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-slate-900"></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Vertex IA
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Tu asistente SPM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge de alertas */}
          {unshownAlertsCount > 0 && (
            <div className="relative">
              <Bell className="w-5 h-5 text-amber-500" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unshownAlertsCount}
              </span>
            </div>
          )}

          <Button
            onClick={closeChat}
            variant="icon"
            size="icon-sm"
            aria-label="Cerrar chat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alertas Proactivas */}
      {pendingAlerts.length > 0 && (
        <div className="px-3 py-2 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200/50 dark:border-amber-500/20">
          {pendingAlerts.slice(0, 1).map(alert => (
            <div key={alert.id} className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 truncate">
                  {alert.title}
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-300 line-clamp-2">
                  {alert.message}
                </p>
              </div>
              <button
                onClick={() => handleDismissAlert(alert.id)}
                className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/50">
        {formattedMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl
                ${msg.isUser
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/50 dark:border-white/10 text-slate-700 dark:text-slate-200 shadow-sm'
                }`}
            >
              {/* Contenido del mensaje */}
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                {msg.content}
              </p>

              {/* Sugerencias */}
              {msg.suggestions && msg.suggestions.length > 0 && msg.isAssistant && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-600/50">
                  {msg.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestion(suggestion)}
                      className="block w-full text-left text-xs px-2 py-1.5
                               bg-white/50 dark:bg-slate-700/50 hover:bg-violet-50/70 dark:hover:bg-violet-900/30
                               border border-slate-200/50 dark:border-slate-600/50
                               rounded-lg transition-colors text-slate-600 dark:text-slate-300
                               hover:text-violet-600 dark:hover:text-violet-400"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <p className={`text-[10px] mt-1.5 ${msg.isUser ? 'text-violet-100' : 'text-slate-400'}`}>
                {msg.formattedTime}
              </p>
            </div>
          </div>
        ))}

        {/* Indicador de Vertex pensando */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-violet-50/80 dark:bg-violet-900/30 backdrop-blur-sm border border-violet-200/50 dark:border-violet-500/30 rounded-xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-violet-600 dark:text-violet-300">Vertex esta pensando...</span>
            </div>
          </div>
        )}

        {/* Loading sin typing */}
        {isLoading && !isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl shadow-sm">
              <Loader2 className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-spin" />
              <span className="text-sm text-slate-600 dark:text-slate-300">Conectando...</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-red-50/70 dark:bg-red-900/30 backdrop-blur-sm border border-red-200/50 dark:border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-white/30 dark:border-white/10 p-3 bg-white/50 dark:bg-slate-800/50 rounded-b-2xl"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribi tu consulta..."
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 px-3 py-2 bg-white/70 dark:bg-slate-700/70 backdrop-blur-sm
                      border border-white/50 dark:border-white/10 rounded-xl
                      text-sm text-slate-800 dark:text-slate-200
                      placeholder-slate-400 dark:placeholder-slate-500
                      focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400/50
                      disabled:bg-slate-100/50 dark:disabled:bg-slate-600/50 disabled:cursor-not-allowed
                      transition-all"
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            size="sm"
            className="px-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Helper text con sugerencias rapidas */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(suggestions.length > 0 ? suggestions.slice(0, 3) : ['Ver solicitudes', 'Buscar material', 'Stock']).map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSuggestion(sug)}
              disabled={isLoading}
              className="text-[10px] px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30
                       text-violet-600 dark:text-violet-300 rounded-full
                       hover:bg-violet-100 dark:hover:bg-violet-900/50
                       disabled:opacity-50 transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>
      </form>
    </div>
  )
}
