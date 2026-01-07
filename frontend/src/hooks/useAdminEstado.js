/**
 * useAdminEstado - Custom hook para el dashboard de estado del sistema
 *
 * Centraliza toda la logica de estado, fetching y handlers de AdminEstado
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { system } from '../services/spm'

const AUTO_REFRESH_INTERVAL = 30000 // 30 segundos

/**
 * Hook principal para el estado del sistema
 * @param {Object} options - Opciones de configuracion
 * @param {number} options.initialHours - Horas iniciales para historico (default: 24)
 * @param {boolean} options.enableAutoRefresh - Habilitar auto-refresh (default: true)
 * @returns {Object} Estado y handlers del sistema
 */
export function useAdminEstado(options = {}) {
  const {
    initialHours = 24,
    enableAutoRefresh = true,
  } = options

  // Estado de datos
  const [health, setHealth] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [cacheMetrics, setCacheMetrics] = useState(null)
  const [dbMetrics, setDbMetrics] = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [businessMetrics, setBusinessMetrics] = useState(null)
  const [infrastructure, setInfrastructure] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [systemAlerts, setSystemAlerts] = useState([])

  // Estado de UI
  const [selectedHours, setSelectedHours] = useState(initialHours)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(enableAutoRefresh)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [acknowledging, setAcknowledging] = useState(null)

  // Ref para evitar race conditions
  const isMountedRef = useRef(true)

  /**
   * Fetch de todos los datos del sistema
   */
  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return

    try {
      setError('')

      const [
        healthRes,
        metricsRes,
        cacheRes,
        dbRes,
        dbStatsRes,
        sysRes,
        businessRes,
        infraRes,
        historyRes,
        alertsRes
      ] = await Promise.all([
        system.health().catch(() => ({ data: null })),
        system.metricsRequests().catch(() => ({ data: null })),
        system.metricsCache().catch(() => ({ data: null })),
        system.metricsDb().catch(() => ({ data: null })),
        system.metricsDbStats().catch(() => ({ data: null })),
        system.metricsSystem().catch(() => ({ data: null })),
        system.businessMetrics().catch(() => ({ data: null })),
        system.infrastructure().catch(() => ({ data: null })),
        system.metricsHistory('all', selectedHours).catch(() => ({ data: null })),
        system.alerts().catch(() => ({ data: null }))
      ])

      if (!isMountedRef.current) return

      setHealth(healthRes.data)
      setMetrics(metricsRes.data?.data)
      setCacheMetrics(cacheRes.data?.data)
      setDbMetrics(dbRes.data?.data)
      setDbStats(dbStatsRes.data?.data)
      setSystemMetrics(sysRes.data?.data)
      setBusinessMetrics(businessRes.data?.data)
      setInfrastructure(infraRes.data)
      setHistoryData(historyRes.data?.data || {})
      setSystemAlerts(alertsRes.data?.data || [])
      setLastUpdate(new Date())
    } catch (e) {
      if (isMountedRef.current) {
        setError(e.response?.data?.error || e.message)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [selectedHours])

  /**
   * Reiniciar metricas
   */
  const handleResetMetrics = useCallback(async () => {
    setResetting(true)
    try {
      await system.resetMetrics()
      await fetchData()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al reiniciar metricas')
    } finally {
      setResetting(false)
    }
  }, [fetchData])

  /**
   * Exportar datos a JSON
   */
  const handleExport = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      health,
      metrics,
      cache: cacheMetrics,
      database: dbMetrics,
      dbStats,
      system: systemMetrics,
      infrastructure,
      businessMetrics
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-status-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [health, metrics, cacheMetrics, dbMetrics, dbStats, systemMetrics, infrastructure, businessMetrics])

  /**
   * Reconocer una alerta
   */
  const handleAcknowledgeAlert = useCallback(async (alertId) => {
    setAcknowledging(alertId)
    try {
      await system.acknowledgeAlert(alertId)
      setSystemAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Error al reconocer alerta')
    } finally {
      setAcknowledging(null)
    }
  }, [])

  /**
   * Reconocer todas las alertas
   */
  const handleAcknowledgeAllAlerts = useCallback(async () => {
    setAcknowledging('all')
    try {
      await system.acknowledgeAllAlerts()
      setSystemAlerts([])
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Error al reconocer alertas')
    } finally {
      setAcknowledging(null)
    }
  }, [])

  /**
   * Toggle auto-refresh
   */
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev)
  }, [])

  /**
   * Limpiar error
   */
  const clearError = useCallback(() => {
    setError('')
  }, [])

  // Valores calculados
  const errorRate = metrics?.total_requests > 0
    ? (metrics.total_errors / metrics.total_requests * 100)
    : 0

  const overallCacheHit = cacheMetrics?.overall_hit_rate || 0

  const activeAlerts = systemAlerts.filter(a => !a.acknowledged)

  // Effect: Fetch inicial
  useEffect(() => {
    isMountedRef.current = true
    fetchData()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchData])

  // Effect: Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchData, AUTO_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  return {
    // Datos del sistema
    health,
    metrics,
    cacheMetrics,
    dbMetrics,
    dbStats,
    systemMetrics,
    businessMetrics,
    infrastructure,
    historyData,
    systemAlerts,
    activeAlerts,

    // Valores calculados
    errorRate,
    overallCacheHit,

    // Estado de UI
    selectedHours,
    setSelectedHours,
    error,
    loading,
    autoRefresh,
    lastUpdate,
    resetting,
    acknowledging,

    // Handlers
    fetchData,
    handleResetMetrics,
    handleExport,
    handleAcknowledgeAlert,
    handleAcknowledgeAllAlerts,
    toggleAutoRefresh,
    clearError,
  }
}

export default useAdminEstado
