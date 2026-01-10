import { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2 } from './ui/Icons'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
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

  // Zustand stores
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

  const { user } = useAuthStore()

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

    // Enrich context with user data
    if (user) {
      context.usuario_id = user.id
      context.centro = user.centro || context.centro
    }

    // Material/product search keywords
    const materialKeywords = ['comprar', 'buscar', 'necesito', 'brida', 'tornillo', 'tubo',
      'válvula', 'bomba', 'filtro', 'cable', 'motor', 'sensor', 'repuesto', 'pieza']

    // Mapear consultas comunes a objetivos del agente
    if (lowerInput.includes('solicitud') || lowerInput.includes('mis solicitud') || lowerInput === 'listar solicitudes') {
      agentGoal = 'Cargar y summarizar todas las solicitudes del usuario actual'
      context.action = 'load_solicitudes'
    } else if (lowerInput.includes('material') || lowerInput.includes('buscar material') ||
               materialKeywords.some(kw => lowerInput.includes(kw))) {
      // Extract search term - remove common words
      const searchTerm = userInput
        .replace(/quiero|necesito|buscar|comprar|un|una|el|la|los|las|de|para/gi, '')
        .trim()
      agentGoal = `Buscar materiales: ${searchTerm || 'todos'}`
      context.action = 'load_materiales'
      if (searchTerm) {
        context.search = searchTerm
      }
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
    } else if (lowerInput.includes('stock')) {
      agentGoal = 'Consultar stock disponible'
      context.action = 'load_stock'
    }

    return { agentGoal, context }
  }

  /**
   * Envía un mensaje y obtiene respuesta del agente
   */
  const sendMessage = async (message) => {
    if (!message.trim() || isSending) return

    const lowerMessage = message.toLowerCase()

    // Handle special commands that don't need agent
    if (lowerMessage === 'nueva consulta') {
      addUserMessage(message)
      addBotMessage('¿En qué puedo ayudarte?', [
        'Ver mis solicitudes',
        'Buscar materiales',
        'Consultar presupuesto'
      ])
      return
    }

    if (lowerMessage === 'ver más detalles') {
      addUserMessage(message)
      addBotMessage('Para ver más detalles, visita la sección correspondiente en el menú lateral.', [
        'Ver mis solicitudes',
        'Buscar materiales'
      ])
      return
    }

    // Agregar mensaje del usuario
    addUserMessage(message)
    setInputValue('')
    setIsSending(true)
    setLoading(true)
    clearError()

    try {
      // Procesar la consulta
      const { agentGoal, context } = await processQuery(message)

      // Ejecutar el agente
      const agentResponse = await agentService.execute(
        agentGoal,
        context,
        8  // max_iterations
      )

      // Procesar respuesta del agente
      // Agent returns: { success, iterations_used, execution_log: [{result, params, error, ...}], summary, observations }
      if (agentResponse.success) {
        let botMessage = ''

        // Extract result from execution_log (last successful tool execution)
        const executionLog = agentResponse.execution_log || []
        const successfulExecution = executionLog.filter(e => e.success && e.result).pop()
        const failedExecution = executionLog.filter(e => !e.success).pop()
        const result = successfulExecution?.result

        if (result && typeof result === 'object') {
          // Format result based on data_type
          if (result.data && Array.isArray(result.data)) {
            const count = result.count || result.data.length
            if (count > 0) {
              botMessage = `Encontré ${count} registros.`
              // Show first few items summary
              const items = result.data.slice(0, 3)
              if (result.data_type === 'solicitudes') {
                const summaries = items.map(s =>
                  `• #${s.id}: ${s.status || 'pendiente'} - $${(s.total_monto || 0).toLocaleString()}`
                )
                botMessage += '\n\n' + summaries.join('\n')
                if (count > 3) botMessage += `\n...y ${count - 3} más`
              } else if (result.data_type === 'materiales') {
                const summaries = items.map(m =>
                  `• ${m.codigo}: ${m.descripcion?.substring(0, 40) || 'Sin descripción'}`
                )
                botMessage += '\n\n' + summaries.join('\n')
                if (count > 3) botMessage += `\n...y ${count - 3} más`
              } else {
                botMessage += ` Tipo: ${result.data_type || 'datos'}`
              }
            } else {
              botMessage = 'No se encontraron registros con los filtros especificados.'
            }
          } else if (result.status === 'fitted') {
            botMessage = `Modelo entrenado exitosamente. Score: ${(result.train_score * 100).toFixed(2)}%`
          } else if (result.predictions) {
            botMessage = `Predicción completada. ${result.n_predictions} predicciones realizadas.`
          } else if (result.error) {
            botMessage = `Error al cargar datos: ${result.error}`
          } else {
            botMessage = JSON.stringify(result, null, 2).substring(0, 300)
          }
        } else if (failedExecution?.error) {
          // Check for errors in failed executions
          botMessage = `Error en la consulta: ${failedExecution.error}`
        }

        // Fallback to summary or iteration count
        if (!botMessage) {
          if (agentResponse.summary && agentResponse.summary !== 'Sin resultado') {
            botMessage = agentResponse.summary
          } else {
            const iterations = agentResponse.iterations_used || agentResponse.iterations || 0
            botMessage = `Análisis completado en ${iterations} iteraciones.`
          }
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
   * Maneja el envío del formulario
   */
  const handleSendMessage = async (e) => {
    e.preventDefault()
    await sendMessage(inputValue)
  }

  /**
   * Maneja el click en sugerencias - auto-envía el mensaje
   */
  const handleSuggestion = (suggestion) => {
    sendMessage(suggestion)
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
