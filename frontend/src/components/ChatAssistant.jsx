import { useState, useRef, useEffect, useCallback } from 'react'
import { useVertexStore, selectFormattedMessages } from '../store/vertexStore'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../context/i18n'
import vertexService, { sendVertexMessage, loadVertexAlerts, initializeVertex } from '../services/vertex'
import api from '../services/api'

// MUI Components
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Badge from '@mui/material/Badge'

// MUI Icons
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import NotificationsIcon from '@mui/icons-material/Notifications'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'

/**
 * Componente ChatAssistant - Vertex IA
 *
 * Chat flotante con personalidad argentina que usa Gemini para generar respuestas.
 * Incluye:
 * - Memoria persistente entre sesiones
 * - Alertas proactivas
 * - Sugerencias contextuales
 * - Voz: Text-to-Speech y Speech-to-Text
 */
export default function ChatAssistant() {
  const { t } = useI18n()
  const messagesEndRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  // Voice state
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState(null)
  const recognitionRef = useRef(null)
  const synthesisRef = useRef(null)
  const audioRef = useRef(null)  // Para audio de Google Cloud TTS

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

  // Buscar la mejor voz espanola femenina con acento ARGENTINO
  // Prioridad: Argentina > Rioplatense > LATAM > Espana
  const findBestVoice = useCallback(() => {
    if (!synthesisRef.current) return null

    const voices = synthesisRef.current.getVoices()
    if (!voices.length) return null

    // Filtrar voces en espanol
    const spanishVoices = voices.filter(v => v.lang.startsWith('es'))

    // Orden de prioridad: ARGENTINA primero, luego otras LATAM
    // Buscamos voz femenina con tonada argentina/rioplatense
    const voicePreferences = [
      // ARGENTINA - Maxima prioridad
      { match: (v) => v.name.includes('Elena') && v.lang === 'es-AR', name: 'Elena Argentina' },
      { match: (v) => v.lang === 'es-AR' && v.name.includes('Female'), name: 'Female Argentina' },
      { match: (v) => v.lang === 'es-AR', name: 'es-AR any' },
      { match: (v) => v.name.includes('Microsoft') && v.name.includes('Elena'), name: 'Microsoft Elena' },

      // Google voces argentinas (neural, excelente calidad)
      { match: (v) => v.name.includes('Google') && v.lang === 'es-AR', name: 'Google Argentina' },

      // Uruguay (acento similar al argentino)
      { match: (v) => v.lang === 'es-UY', name: 'es-UY Uruguay' },

      // LATAM generico (puede tener buen acento)
      { match: (v) => v.name.includes('Google') && v.lang === 'es-419', name: 'Google LATAM' },
      { match: (v) => v.lang === 'es-419', name: 'es-419 LATAM' },

      // Colombia (acento neutro, agradable)
      { match: (v) => v.name.includes('Salome') || v.name.includes('Salomé'), name: 'Salome Colombia' },
      { match: (v) => v.lang === 'es-CO', name: 'es-CO Colombia' },

      // Mexico (muy claro, buena alternativa)
      { match: (v) => v.name.toLowerCase().includes('sabina'), name: 'Sabina Mexico' },
      { match: (v) => v.name.includes('Dalia'), name: 'Dalia Mexico' },
      { match: (v) => v.lang === 'es-MX', name: 'es-MX Mexico' },

      // Venezuela, Chile, Peru
      { match: (v) => v.name.includes('Paola') && v.lang.startsWith('es'), name: 'Paola Venezuela' },
      { match: (v) => v.lang === 'es-VE', name: 'es-VE Venezuela' },
      { match: (v) => v.lang === 'es-CL', name: 'es-CL Chile' },
      { match: (v) => v.lang === 'es-PE', name: 'es-PE Peru' },

      // US Spanish (puede ser neutro)
      { match: (v) => v.name.includes('Google') && v.lang === 'es-US', name: 'Google US Spanish' },
      { match: (v) => v.lang === 'es-US', name: 'es-US' },

      // Microsoft Online (neural, buena calidad)
      { match: (v) => v.name.includes('Microsoft') && v.name.includes('Online') && v.lang.startsWith('es'), name: 'Microsoft Online' },

      // Apple voices (macOS/iOS)
      { match: (v) => v.name.toLowerCase().includes('paulina'), name: 'Paulina Mexico' },

      // Cualquier voz Google en espanol
      { match: (v) => v.name.includes('Google') && v.lang.startsWith('es'), name: 'Google Spanish' },

      // Voz femenina espanola
      { match: (v) => v.lang.startsWith('es') && v.name.toLowerCase().includes('female'), name: 'Female Spanish' },

      // Espana (ultimo recurso, acento diferente)
      { match: (v) => v.name.toLowerCase().includes('monica') || v.name.toLowerCase().includes('mónica'), name: 'Monica Spain' },
      { match: (v) => v.lang === 'es-ES', name: 'es-ES Spain' },

      // Fallback: cualquier voz en espanol
      { match: (v) => v.lang.startsWith('es'), name: 'Spanish fallback' },
    ]

    for (const pref of voicePreferences) {
      const voice = voices.find(pref.match)
      if (voice) {
        return voice
      }
    }

    return voices[0]
  }, [])

  // Initialize Speech Recognition
  useEffect(() => {
    // Check for speech synthesis support
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis

      // Load voices (may be async)
      const loadVoices = () => {
        const voice = findBestVoice()
        if (voice) setSelectedVoice(voice)
      }

      // Some browsers load voices async
      if (synthesisRef.current.getVoices().length) {
        loadVoices()
      }
      synthesisRef.current.onvoiceschanged = loadVoices
    }

    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'es-AR' // Argentinian Spanish

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')

        setInputValue(transcript)

        // If final result, send message
        if (event.results[0].isFinal) {
          setIsListening(false)
        }
      }

      recognition.onerror = (event) => {
        // Only log non-permission errors once
        if (event.error !== 'not-allowed' && event.error !== 'aborted') {
        }
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setMicPermissionDenied(true)
          // Don't spam the error - only show once
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  /**
   * Fallback: hablar usando Web Speech API del navegador
   * Se usa cuando Google Cloud TTS no esta disponible
   */
  const fallbackSpeak = useCallback((text) => {
    if (!synthesisRef.current || !text) return

    const utterance = new SpeechSynthesisUtterance(text)

    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang
    } else {
      utterance.lang = 'es-AR'
    }

    // Parametros optimizados para Web Speech API
    const isNeuralVoice = selectedVoice?.name?.includes('Online') ||
                          selectedVoice?.name?.includes('Google') ||
                          selectedVoice?.name?.includes('Neural')

    if (isNeuralVoice) {
      utterance.rate = 1.12
      utterance.pitch = 1.08
    } else {
      utterance.rate = 1.1
      utterance.pitch = 1.08
    }

    utterance.volume = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synthesisRef.current.speak(utterance)
  }, [selectedVoice])

  /**
   * Speak text using Google Cloud TTS Neural voices
   * Falls back to Web Speech API if TTS service is unavailable
   */
  const speak = useCallback(async (text) => {
    if (!voiceEnabled || !text) return

    // Cancel any ongoing audio/speech
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (synthesisRef.current) {
      synthesisRef.current.cancel()
    }

    // Clean text for better TTS (remove markdown, extra spaces)
    const cleanText = text
      .replace(/\*\*/g, '')  // Remove bold markdown
      .replace(/\*/g, '')    // Remove italic markdown
      .replace(/`/g, '')     // Remove code backticks
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\n+/g, '. ') // Replace newlines with pauses
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim()

    if (!cleanText) return

    setIsSpeaking(true)

    try {
      // Llamar al endpoint de Google Cloud TTS
      const response = await api.post('/vertex/tts', { text: cleanText, voice: 'tomas' }, {
        responseType: 'blob',
        timeout: 30000, // 30 segundos timeout para textos largos
      })

      // Crear audio desde blob
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      audio.onerror = () => {
        // CSP puede bloquear blob: URLs - usar fallback Web Speech API
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        fallbackSpeak(cleanText)
      }

      await audio.play()

    } catch {
      // Si falla Edge TTS, usar fallback Web Speech API del navegador
      fallbackSpeak(cleanText)
    }
  }, [voiceEnabled])

  /**
   * Toggle voice input (microphone)
   */
  const toggleListening = () => {
    if (!recognitionRef.current) return

    // Don't try if permission was denied
    if (micPermissionDenied) {
      setError('Permiso de microfono denegado. Habilitalo en la configuracion del navegador.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInputValue('')
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        // Recognition already started or other error
        if (err.name !== 'InvalidStateError') {
        }
      }
    }
  }

  /**
   * Toggle voice output (speaker)
   */
  const toggleVoice = () => {
    if (isSpeaking) {
      // Parar Google Cloud TTS audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      // Parar Web Speech API
      if (synthesisRef.current) {
        synthesisRef.current.cancel()
      }
      setIsSpeaking(false)
    }
    setVoiceEnabled(!voiceEnabled)
  }

  // Speak new assistant messages
  useEffect(() => {
    if (messages.length > 0 && voiceEnabled) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        // Small delay to ensure UI updates first
        setTimeout(() => speak(lastMessage.content), 100)
      }
    }
  }, [messages, voiceEnabled, speak])

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

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }

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
    }
  }

  // Contador de alertas no mostradas
  const unshownAlertsCount = getUnshownAlertsCount()

  if (!isOpen) return null

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        bottom: 96,
        right: 24,
        zIndex: 50,
        width: '100%',
        maxWidth: 384,
        height: 520,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 4,
        overflow: 'hidden',
        animation: 'scaleIn 0.2s ease-out',
        '@keyframes scaleIn': {
          '0%': { transform: 'scale(0.9)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      }}
    >
      {/* Header - Vertex IA */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#093170',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {/* Avatar Vertex */}
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fc1b80',
                boxShadow: 2,
                animation: isSpeaking ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            >
              <Typography
                sx={{
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                }}
              >
                V
              </Typography>
            </Box>
            {/* Indicador de estado */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '2px solid white',
                backgroundColor: isSpeaking ? 'var(--info)' : 'var(--success)',
                animation: isSpeaking ? 'pulse 1.5s infinite' : 'none',
              }}
            />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
              }}
            >
              Vertex IA
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'var(--primary-bg-light)',
              }}
            >
              {isSpeaking ? 'Hablando...' : isListening ? 'Escuchando...' : 'Tu asistente SPM'}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          {/* Toggle Voice Output */}
          <IconButton
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
            title={voiceEnabled ? t("chat_voice_off", "Desactivar voz") : t("chat_voice_on", "Activar voz")}
            size="small"
            sx={{
              color: voiceEnabled ? 'white' : 'var(--primary-bg-light)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            {voiceEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
          </IconButton>

          {/* Badge de alertas */}
          {unshownAlertsCount > 0 && (
            <Badge
              badgeContent={unshownAlertsCount}
              color="warning"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.625rem',
                  fontWeight: 'bold',
                },
              }}
            >
              <NotificationsIcon sx={{ color: 'var(--warning)', fontSize: 20 }} />
            </Badge>
          )}

          <IconButton
            onClick={closeChat}
            aria-label={t("aria_close_chat", "Cerrar chat")}
            size="small"
            sx={{
              color: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Alertas Proactivas */}
      {pendingAlerts.length > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            backgroundColor: 'var(--warning-bg-light)',
            borderBottom: 1,
            borderColor: 'var(--warning)',
          }}
        >
          {pendingAlerts.slice(0, 1).map(alert => (
            <Stack key={alert.id} direction="row" alignItems="flex-start" spacing={1}>
              <ErrorOutlineIcon sx={{ color: 'var(--warning)', fontSize: 16, mt: 0.25, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--warning)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {alert.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.6875rem',
                    color: 'var(--warning)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {alert.message}
                </Typography>
              </Box>
              <IconButton
                onClick={() => handleDismissAlert(alert.id)}
                size="small"
                sx={{ color: 'var(--warning)', p: 0.5 }}
              >
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Stack>
          ))}
        </Box>
      )}

      {/* Messages Container */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          backgroundColor: '#faf1e1',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {formattedMessages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              justifyContent: msg.isUser ? 'flex-end' : 'flex-start',
            }}
          >
            <Box
              sx={{
                maxWidth: '85%',
                px: 1.5,
                py: 1,
                borderRadius: 3,
                boxShadow: 1,
                backgroundColor: msg.isUser ? 'var(--primary)' : 'var(--bg-soft)',
                color: msg.isUser ? 'white' : 'var(--fg-muted)',
                border: msg.isUser ? 'none' : '1px solid var(--border)',
              }}
            >
              {/* Contenido del mensaje */}
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </Typography>

              {/* Sugerencias */}
              {msg.suggestions && msg.suggestions.length > 0 && msg.isAssistant && (
                <Stack spacing={0.75} sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
                  {msg.suggestions.map((suggestion, idx) => (
                    <Button
                      key={idx}
                      onClick={() => handleSuggestion(suggestion)}
                      variant="outlined"
                      size="small"
                      sx={{
                        justifyContent: 'flex-start',
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        px: 1,
                        py: 0.75,
                        borderColor: 'grey.300',
                        color: 'var(--fg-muted)',
                        backgroundColor: 'var(--card)',
                        '&:hover': {
                          backgroundColor: 'var(--primary-bg-light)',
                          color: 'var(--primary)',
                          borderColor: 'var(--primary)',
                        },
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </Stack>
              )}

              {/* Timestamp */}
              <Typography
                sx={{
                  fontSize: '0.625rem',
                  mt: 0.75,
                  color: msg.isUser ? 'var(--primary-bg-light)' : 'var(--fg-subtle)',
                }}
              >
                {msg.formattedTime}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Indicador de Vertex pensando */}
        {isTyping && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 1.5,
                py: 1,
                backgroundColor: 'var(--primary-bg-light)',
                border: 1,
                borderColor: 'var(--info)',
                borderRadius: 3,
              }}
            >
              <Stack direction="row" spacing={0.5}>
                {[0, 150, 300].map((delay) => (
                  <Box
                    key={delay}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      animation: 'bounce 1s infinite',
                      animationDelay: `${delay}ms`,
                      '@keyframes bounce': {
                        '0%, 100%': { transform: 'translateY(0)' },
                        '50%': { transform: 'translateY(-4px)' },
                      },
                    }}
                  />
                ))}
              </Stack>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                Vertex esta pensando...
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Loading sin typing */}
        {isLoading && !isTyping && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 1.5,
                py: 1,
                backgroundColor: 'var(--card)',
                border: 1,
                borderColor: 'grey.300',
                borderRadius: 3,
                boxShadow: 1,
              }}
            >
              <CircularProgress size={16} sx={{ color: 'var(--primary)' }} />
              <Typography sx={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
                Conectando...
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Error Message */}
        {error && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Box
              sx={{
                px: 1.5,
                py: 1,
                backgroundColor: 'var(--danger-bg-light)',
                border: 1,
                borderColor: 'var(--danger)',
                borderRadius: 3,
              }}
            >
              <Typography sx={{ fontSize: '0.875rem', color: 'var(--danger)' }}>
                {error}
              </Typography>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          borderTop: 1,
          borderColor: 'grey.200',
          p: 1.5,
          backgroundColor: 'var(--card)',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        <Stack direction="row" spacing={1}>
          {/* Microphone Button */}
          {speechSupported && !micPermissionDenied && (
            <IconButton
              type="button"
              onClick={toggleListening}
              disabled={isLoading}
              title={isListening ? t("chat_stop", "Detener") : t("chat_speak", "Hablar")}
              sx={{
                backgroundColor: isListening ? 'var(--danger)' : 'var(--primary-bg-light)',
                animation: isListening ? 'pulse 1.5s infinite' : 'none',
                '&:hover': {
                  backgroundColor: isListening ? 'var(--danger)' : 'var(--info)',
                },
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            >
              {isListening ? (
                <MicOffIcon sx={{ color: 'white', fontSize: 18 }} />
              ) : (
                <MicIcon sx={{ color: 'var(--primary)', fontSize: 18 }} />
              )}
            </IconButton>
          )}

          <TextField
            inputRef={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? 'Escuchando...' : 'Escribi o habla tu consulta...'}
            disabled={isLoading}
            autoComplete="off"
            size="small"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: '0.875rem',
                backgroundColor: 'var(--card)',
                '& fieldset': {
                  borderColor: isListening ? 'var(--danger)' : 'grey.300',
                  ...(isListening && { borderWidth: 2, boxShadow: '0 0 0 2px var(--danger-bg-light)' }),
                },
                '&:hover fieldset': {
                  borderColor: isListening ? 'var(--danger)' : 'var(--primary)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: isListening ? 'var(--danger)' : 'var(--primary)',
                },
              },
            }}
          />
          <IconButton
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            sx={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: 3,
              boxShadow: 2,
              '&:hover': {
                backgroundColor: 'var(--primary-dark)',
                boxShadow: 4,
              },
              '&.Mui-disabled': {
                backgroundColor: 'grey.300',
                color: 'grey.500',
              },
            }}
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>

        {/* Helper text con sugerencias rapidas */}
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
          {(suggestions.length > 0 ? suggestions.slice(0, 3) : ['Ver solicitudes', 'Buscar material', 'Stock']).map((sug, idx) => (
            <Button
              key={idx}
              type="button"
              onClick={() => handleSuggestion(sug)}
              disabled={isLoading}
              size="small"
              sx={{
                fontSize: '0.625rem',
                px: 1,
                py: 0.25,
                minHeight: 'auto',
                backgroundColor: 'var(--primary-bg-light)',
                color: 'var(--primary)',
                borderRadius: 4,
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: 'var(--info)',
                },
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
              }}
            >
              {sug}
            </Button>
          ))}
        </Stack>
      </Box>
    </Paper>
  )
}
