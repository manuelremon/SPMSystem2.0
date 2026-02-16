/**
 * Hook para notificaciones en tiempo real via WebSocket + SSE fallback
 *
 * Características:
 * - WebSocket como canal principal (entrega instantánea)
 * - Fallback automático a SSE si WS no conecta
 * - Fallback final a polling HTTP
 * - Reconexión automática con backoff exponencial
 * - Limpieza automática al desmontar
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Configuración
const WS_RECONNECT_BASE_DELAY = 1000
const WS_RECONNECT_MAX_DELAY = 30000
const SSE_RECONNECT_BASE_DELAY = 1000
const SSE_RECONNECT_MAX_DELAY = 30000
const POLLING_INTERVAL = 30000
const HEARTBEAT_TIMEOUT = 60000

/**
 * Hook para gestionar notificaciones en tiempo real
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Si las notificaciones están habilitadas
 * @param {Function} options.onNotification - Callback cuando llega nueva notificación
 * @returns {Object} Estado y métodos de notificaciones
 */
export function useNotifications({ enabled = true, onNotification } = {}) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Refs para manejar reconexión y cleanup
  const wsRef = useRef(null)
  const eventSourceRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const pollingIntervalRef = useRef(null)
  const isMountedRef = useRef(true)
  const heartbeatTimeoutRef = useRef(null)
  const lastHeartbeatRef = useRef(Date.now())
  const transportRef = useRef('none') // 'ws', 'sse', 'polling'

  /**
   * Obtener notificaciones del servidor (polling/inicial)
   */
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!isMountedRef.current) return

    setIsLoading(true)
    try {
      const response = await api.get('/notificaciones', {
        params: { unread_only: unreadOnly, limit: 50 }
      })

      if (isMountedRef.current && response.data?.ok) {
        setNotifications(response.data.notifications || [])
        setUnreadCount(response.data.unread_count || 0)
        setError(null)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Error al cargar notificaciones')
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  /**
   * Marcar notificación como leída
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.post(`/notificaciones/${notificationId}/marcar-leida`)
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, leido: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * Marcar todas como leídas
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/notificaciones/marcar-todas-leidas')
      setNotifications(prev => prev.map(n => ({ ...n, leido: true })))
      setUnreadCount(0)
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * Eliminar notificación
   */
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notificaciones/${notificationId}`)
      setNotifications(prev => {
        const notif = prev.find(n => n.id === notificationId)
        if (notif && !notif.leido) {
          setUnreadCount(c => Math.max(0, c - 1))
        }
        return prev.filter(n => n.id !== notificationId)
      })
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * Procesar notificación entrante (de cualquier canal)
   */
  const handleIncomingNotification = useCallback((notification) => {
    if (!isMountedRef.current) return

    setNotifications(prev => {
      if (prev.some(n => n.id === notification.id)) return prev
      return [notification, ...prev]
    })

    if (!notification.leido) {
      setUnreadCount(c => c + 1)
    }

    if (onNotification) {
      onNotification(notification)
    }
  }, [onNotification])

  /**
   * Conectar via WebSocket (skip si ya falló antes — fallback directo a SSE)
   */
  const wsFailedRef = useRef(false)

  const connectWS = useCallback(() => {
    if (!enabled || wsRef.current) return false

    // Si WS ya falló en esta sesión, ir directo a SSE
    if (wsFailedRef.current) return false

    try {
      // Construir URL WS desde API URL
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = API_BASE_URL.startsWith('http')
        ? new URL(API_BASE_URL).host
        : window.location.host
      const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (isMountedRef.current) {
          transportRef.current = 'ws'
          setIsConnected(true)
          setError(null)
          reconnectAttempts.current = 0
          lastHeartbeatRef.current = Date.now()

          // Detener SSE y polling
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // Iniciar heartbeat check
          startHeartbeatCheck()
        }
      }

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return
        lastHeartbeatRef.current = Date.now()

        try {
          const data = JSON.parse(event.data)

          if (data.type === 'pong' || data.event === 'pong') return

          if (data.event === 'notification' && data.data) {
            handleIncomingNotification(data.data)
          }
        } catch {
          // Ignorar mensajes no parseables
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (isMountedRef.current && enabled) {
          setIsConnected(false)
          clearHeartbeatCheck()
          // Marcar WS como no disponible para no reintentar
          wsFailedRef.current = true
          // Fallback a SSE
          connectSSE()
        }
      }

      ws.onerror = () => {
        ws.close()
      }

      return true
    } catch {
      wsFailedRef.current = true
      return false
    }
  }, [enabled, handleIncomingNotification])

  /**
   * Iniciar verificación de heartbeat
   */
  const startHeartbeatCheck = useCallback(() => {
    clearHeartbeatCheck()
    heartbeatTimeoutRef.current = setInterval(() => {
      const timeSince = Date.now() - lastHeartbeatRef.current
      if (timeSince > HEARTBEAT_TIMEOUT) {
        // Conexión estancada
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        clearHeartbeatCheck()
        if (isMountedRef.current && enabled) {
          setTimeout(connectWS, WS_RECONNECT_BASE_DELAY)
        }
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Send ping to keep alive
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }))
        } catch {
          // Ignore
        }
      }
    }, 15000)
  }, [enabled, connectWS])

  const clearHeartbeatCheck = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  /**
   * Conectar a SSE stream (fallback de WS)
   */
  const connectSSE = useCallback(() => {
    if (!enabled || eventSourceRef.current || wsRef.current) return

    try {
      const streamUrl = `${API_BASE_URL}/notificaciones/stream`
      const eventSource = new EventSource(streamUrl, { withCredentials: true })
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (isMountedRef.current) {
          transportRef.current = 'sse'
          setIsConnected(true)
          setError(null)
          reconnectAttempts.current = 0
          lastHeartbeatRef.current = Date.now()

          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          startHeartbeatCheck()
        }
      }

      eventSource.onmessage = (event) => {
        if (!isMountedRef.current) return
        lastHeartbeatRef.current = Date.now()

        try {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') return

          if (data.type === 'notification' || data.id) {
            const notification = data.data || data
            handleIncomingNotification(notification)
          }
        } catch {
          // Ignorar
        }
      }

      eventSource.onerror = () => {
        if (isMountedRef.current) {
          setIsConnected(false)
          eventSource.close()
          eventSourceRef.current = null
          clearHeartbeatCheck()

          const baseDelay = Math.min(
            SSE_RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
            SSE_RECONNECT_MAX_DELAY
          )
          const jitter = Math.floor(Math.random() * 1000)
          reconnectAttempts.current++

          if (reconnectAttempts.current > 5) {
            setError('Conexión inestable, usando modo polling')
            startPolling()
            return
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && enabled) {
              connectSSE()
            }
          }, baseDelay + jitter)
        }
      }
    } catch {
      setError('SSE no disponible')
      startPolling()
    }
  }, [enabled, handleIncomingNotification, startHeartbeatCheck, clearHeartbeatCheck])

  /**
   * Iniciar fallback polling
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return
    transportRef.current = 'polling'

    fetchNotifications().then(() => {
      if (isMountedRef.current) setIsConnected(true)
    })

    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) fetchNotifications()
    }, POLLING_INTERVAL)
  }, [fetchNotifications])

  /**
   * Desconectar todo
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    clearHeartbeatCheck()
    transportRef.current = 'none'
    setIsConnected(false)
  }, [clearHeartbeatCheck])

  // Efecto para conectar/desconectar
  useEffect(() => {
    isMountedRef.current = true

    if (enabled) {
      fetchNotifications()

      const isCrossOrigin = API_BASE_URL.startsWith('http') &&
        !API_BASE_URL.includes(window.location.host)

      if (!isCrossOrigin) {
        // Intentar WS primero, si falla cae a SSE, luego polling
        if (!connectWS()) {
          if (typeof EventSource !== 'undefined') {
            connectSSE()
          } else {
            startPolling()
          }
        }
      } else {
        startPolling()
      }
    }

    return () => {
      isMountedRef.current = false
      disconnect()
    }
  }, [enabled, fetchNotifications, connectWS, connectSSE, startPolling, disconnect])

  return {
    notifications,
    unreadCount,
    isConnected,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
    connect: connectWS,
    disconnect
  }
}

export default useNotifications
