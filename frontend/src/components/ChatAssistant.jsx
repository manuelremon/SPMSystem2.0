import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Loader } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import agentService from '../services/agent'

/**
 * Componente ChatAssistant
 * Chat flotante estilo C40/Neubrutalism que comunica con el agente ML
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
    toggleChat,
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

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 z-50 w-full max-w-md h-[600px] bg-[var(--bg)]
                        border-4 border-black shadow-[12px_12px_0_0_#000]
                        flex flex-col rounded-none m-4 md:m-0"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b-4 border-black bg-primary-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-black rounded-full animate-pulse"></div>
              <h3 className="text-base font-black text-black uppercase tracking-wider">
                Asistente SPM
              </h3>
            </div>
            <button
              onClick={closeChat}
              className="p-2 hover:bg-primary-600 transition-colors"
              aria-label="Cerrar chat"
            >
              <X className="w-5 h-5 text-black" strokeWidth={3} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-3 border-2 border-black rounded-none
                    ${msg.type === 'user'
                      ? 'bg-primary-500 text-black font-semibold shadow-[4px_4px_0_0_#000]'
                      : 'bg-[var(--bg)] text-black shadow-[4px_4px_0_0_#000]'
                    }`}
                >
                  <p className="text-sm leading-relaxed break-words">{msg.content}</p>

                  {/* Sugerencias */}
                  {msg.suggestions && msg.suggestions.length > 0 && msg.type === 'bot' && (
                    <div className="mt-3 space-y-2 pt-3 border-t-2 border-gray-300">
                      {msg.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestion(suggestion)}
                          className="block w-full text-left text-xs px-2 py-1
                                   bg-gray-100 hover:bg-gray-200 border border-gray-300
                                   rounded-none transition-colors font-medium"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-gray-500 mt-2">
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
                <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg)] border-2 border-black
                              rounded-none shadow-[4px_4px_0_0_#000]">
                  <Loader className="w-4 h-4 text-black animate-spin" strokeWidth={3} />
                  <span className="text-sm text-gray-600">Procesando tu consulta...</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex justify-start">
                <div className="px-4 py-3 bg-[var(--danger-bg)] border-2 border-[var(--danger)] rounded-none
                              shadow-[4px_4px_0_0_var(--danger)] text-sm text-[var(--danger)]">
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            className="border-t-4 border-black p-4 bg-[var(--bg)] space-y-3"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Escribe tu consulta..."
                disabled={isLoading || isSending}
                className="flex-1 px-4 py-2 border-2 border-black rounded-none
                          text-sm font-medium placeholder-gray-500
                          focus:outline-none focus:ring-2 focus:ring-primary-500
                          disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || isSending}
                className="px-4 py-2 bg-primary-500 border-2 border-black rounded-none
                          font-black text-black shadow-[3px_3px_0_0_#000]
                          hover:bg-primary-600 active:translate-y-[2px] active:shadow-[1px_1px_0_0_#000]
                          disabled:bg-gray-300 disabled:cursor-not-allowed
                          transition-all duration-100"
                aria-label="Enviar mensaje"
              >
                <Send className="w-5 h-5" strokeWidth={3} />
              </button>
            </div>

            {/* Helper text */}
            <p className="text-xs text-gray-500">
              💡 Prueba: "Ver mis solicitudes", "Buscar materiales", "Analizar solicitud #123"
            </p>
          </form>
        </div>
      )}
    </>
  )
}
