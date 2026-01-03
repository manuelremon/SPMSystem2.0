import { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2 } from './ui/Icons'
import { useChatStore } from '../store/chatStore'
import agentService from '../services/agent'
import { Button } from './ui/Button'

/**
 * Componente ChatAssistant
 * Chat flotante estilo Glass Morphism que comunica con el agente ML
 */
export default function ChatAssistant() {
  const messagesEndRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Zustand store
  const {
    messages,
    isOpen,
    isLoading,
    error,
    closeChat,
    addUserMessage,
    addBotMessage,
    setLoading,
    setError,
    clearError,
    getContext
  } = useChatStore()

  // Auto scroll a los últimos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /**
   * Procesa comandos inteligentes y consultas
   */
  const processQuery = async (userInput) => {
    const lowerInput = userInput.toLowerCase()
    let agentGoal = userInput
    let context = getContext()

    // Mapear consultas comunes a objetivos del agente
    if (lowerInput.includes('solicitud') || lowerInput.includes('mis solicitud')) {
      agentGoal = 'Cargar y summarizar todas las solicitudes del usuario actual'
      context.action = 'load_solicitudes'
    } else if (lowerInput.includes('material') || lowerInput.includes('buscar material')) {
      agentGoal = 'Cargar catálogo de materiales disponibles'
      context.action = 'load_materiales'
    } else if (lowerInput.includes('presupuesto')) {
      agentGoal = 'Obtener información de presupuestos disponibles'
      context.action = 'load_presupuestos'
    } else if (lowerInput.includes('analyza') || lowerInput.includes('analizar')) {
      // Intentar extraer ID de solicitud
      const match = userInput.match(/#?(\d+)/)
      if (match) {
        context.solicitudId = parseInt(match[1])
        agentGoal = `Analizar y proporcionar recomendaciones para la solicitud #${context.solicitudId}`
      }
    } else if (lowerInput.includes('recomendación') || lowerInput.includes('sugerir')) {
      agentGoal = 'Proporcionar recomendaciones de materiales a priorizar basado en demanda histórica'
    }

    return { agentGoal, context }
  }

  /**
   * Envía un mensaje y obtiene respuesta del agente
   */
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || isSending) return

    // Agregar mensaje del usuario
    addUserMessage(inputValue)
    setInputValue('')
    setIsSending(true)
    setLoading(true)
    clearError()

    try {
      // Procesar la consulta
      const { agentGoal, context } = await processQuery(inputValue)

      // Ejecutar el agente
      const agentResponse = await agentService.execute(
        agentGoal,
        context,
        8  // max_iterations
      )

      // Procesar respuesta del agente
      if (agentResponse.success) {
        let botMessage = ''

        // Extraer información de la respuesta
        if (agentResponse.reasoning_trace && agentResponse.reasoning_trace.length > 0) {
          botMessage = agentResponse.reasoning_trace[agentResponse.reasoning_trace.length - 1]
        }

        if (agentResponse.result) {
          const result = agentResponse.result
          if (typeof result === 'object') {
            // Formatear resultado según el tipo
            if (result.data && Array.isArray(result.data)) {
              botMessage = `Encontré ${result.data.length} registros. `
              if (result.count) {
                botMessage += `Mostrando: ${Math.min(5, result.data.length)} resultados.`
              }
            } else if (result.status === 'fitted') {
              botMessage = `Modelo entrenado exitosamente. Score: ${(result.train_score * 100).toFixed(2)}%`
            } else if (result.predictions) {
              botMessage = `Predicción completada. ${result.n_predictions} predicciones realizadas.`
            } else {
              botMessage = JSON.stringify(result, null, 2).substring(0, 200)
            }
          } else {
            botMessage = String(result).substring(0, 500)
          }
        }

        if (!botMessage) {
          botMessage = agentResponse.execution_log
            ? `Análisis completado en ${agentResponse.n_iterations} iteraciones.`
            : 'Consulta procesada.'
        }

        // Agregar mensaje del bot
        addBotMessage(botMessage, [
          'Ver más detalles',
          'Nueva consulta',
          'Listar solicitudes'
        ])
      } else {
        const errorMsg = agentResponse.error || 'Error procesando la consulta'
        addBotMessage(
          `No pude procesar tu solicitud: ${errorMsg}`,
          ['Intentar de nuevo', 'Otra consulta']
        )
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Error:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Error de conexión'
      addBotMessage(
        `Oops! Hubo un error: ${errorMsg}. Por favor intenta de nuevo.`,
        ['Reintentar', 'Soporte']
      )
      setError(errorMsg)
    } finally {
      setLoading(false)
      setIsSending(false)
    }
  }

  /**
   * Maneja el click en sugerencias
   */
  const handleSuggestion = (suggestion) => {
    setInputValue(suggestion)
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-24 right-6 z-50 w-full max-w-sm h-[500px]
                    bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
                    border border-white/50 dark:border-white/10
                    rounded-2xl shadow-glass
                    flex flex-col
                    animate-scale-in"
    >
      {/* Header - Glass style */}
      <div className="px-4 py-3 border-b border-white/30 dark:border-white/10 flex items-center justify-between rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Asistente SPM
          </h3>
        </div>
        <Button
          onClick={closeChat}
          variant="icon"
          size="icon-sm"
          aria-label="Cerrar chat"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl
                ${msg.type === 'user'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-white/50 dark:border-white/10 text-slate-700 dark:text-slate-200 shadow-sm'
                }`}
            >
              <p className="text-sm leading-relaxed break-words">{msg.content}</p>

              {/* Sugerencias */}
              {msg.suggestions && msg.suggestions.length > 0 && msg.type === 'bot' && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-600/50">
                  {msg.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestion(suggestion)}
                      className="block w-full text-left text-xs px-2 py-1.5
                               bg-white/50 dark:bg-slate-700/50 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 border border-slate-200/50 dark:border-slate-600/50
                               rounded-lg transition-colors text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <p className={`text-[10px] mt-1.5 ${msg.type === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl shadow-sm">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
              <span className="text-sm text-slate-600 dark:text-slate-300">Procesando...</span>
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

      {/* Input Area - Glass style */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-white/30 dark:border-white/10 p-3 bg-white/50 dark:bg-slate-800/50 rounded-b-2xl"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu consulta..."
            disabled={isLoading || isSending}
            className="flex-1 px-3 py-2 bg-white/70 dark:bg-slate-700/70 backdrop-blur-sm border border-white/50 dark:border-white/10 rounded-xl
                      text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500
                      focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50
                      disabled:bg-slate-100/50 dark:disabled:bg-slate-600/50 disabled:cursor-not-allowed
                      transition-all"
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading || isSending}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Helper text */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 px-1">
          Prueba: "Ver mis solicitudes", "Buscar materiales", "Analizar #123"
        </p>
      </form>
    </div>
  )
}
