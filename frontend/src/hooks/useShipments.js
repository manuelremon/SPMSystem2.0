/**
 * useShipments - Custom hook for TMS shipment operations
 */
import { useState, useCallback, useEffect } from 'react'
import { useTmsStore } from '../store/tmsStore'

export function useShipments(autoFetch = true) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    estado: '',
    prioridad: '',
    fecha_desde: '',
    fecha_hasta: '',
    search: '',
    page: 1,
    per_page: 20,
  })

  const {
    shipments,
    shipmentsTotal,
    currentShipment,
    fetchShipments,
    fetchShipment,
    createShipment,
    transitionShipment,
    assignShipment,
  } = useTmsStore()

  const loadShipments = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const mergedParams = { ...filters, ...params }
      // Remove empty values
      Object.keys(mergedParams).forEach(k => {
        if (mergedParams[k] === '' || mergedParams[k] === null) delete mergedParams[k]
      })
      await fetchShipments(mergedParams)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters, fetchShipments])

  const loadShipment = useCallback(async (id) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchShipment(id)
      if (!res.ok) setError('No se pudo cargar el envio')
      return res
    } catch (err) {
      setError(err.message)
      return { ok: false }
    } finally {
      setLoading(false)
    }
  }, [fetchShipment])

  const handleCreate = useCallback(async (data) => {
    setLoading(true)
    try {
      const res = await createShipment(data)
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [createShipment])

  const handleTransition = useCallback(async (id, estado, razon) => {
    try {
      const res = await transitionShipment(id, estado, razon)
      if (res.ok) loadShipments()
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [transitionShipment, loadShipments])

  const handleAssign = useCallback(async (id, data) => {
    try {
      return await assignShipment(id, data)
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }, [assignShipment])

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }, [])

  const setPage = useCallback((page) => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  useEffect(() => {
    if (autoFetch) loadShipments()
  }, [filters.page])

  return {
    // State
    shipments,
    total: shipmentsTotal,
    currentShipment,
    loading,
    error,
    filters,
    // Actions
    loadShipments,
    loadShipment,
    createShipment: handleCreate,
    transitionShipment: handleTransition,
    assignShipment: handleAssign,
    updateFilters,
    setPage,
    setFilters,
  }
}
