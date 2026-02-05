/**
 * useFleet - Custom hook for FMS fleet operations
 */
import { useState, useCallback, useEffect } from 'react'
import { useFmsStore } from '../store/fmsStore'

export function useFleet(autoFetch = false) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const {
    vehicles,
    currentVehicle,
    drivers,
    currentDriver,
    availableVehicles,
    availableDrivers,
    fetchVehicles,
    fetchVehicle,
    createVehicle,
    fetchAvailableVehicles,
    fetchDrivers,
    fetchDriver,
    createDriver,
    fetchAvailableDrivers,
  } = useFmsStore()

  const loadVehicles = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      await fetchVehicles(params)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchVehicles])

  const loadVehicle = useCallback(async (id) => {
    setLoading(true)
    try {
      const res = await fetchVehicle(id)
      if (!res.ok) setError('No se pudo cargar el vehiculo')
      return res
    } catch (err) {
      setError(err.message)
      return { ok: false }
    } finally {
      setLoading(false)
    }
  }, [fetchVehicle])

  const loadDrivers = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      await fetchDrivers(params)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchDrivers])

  const loadDriver = useCallback(async (id) => {
    setLoading(true)
    try {
      const res = await fetchDriver(id)
      return res
    } catch (err) {
      setError(err.message)
      return { ok: false }
    } finally {
      setLoading(false)
    }
  }, [fetchDriver])

  const loadAvailableVehicles = useCallback(async (params = {}) => {
    try {
      return await fetchAvailableVehicles(params)
    } catch (err) {
      return { ok: false }
    }
  }, [fetchAvailableVehicles])

  const loadAvailableDrivers = useCallback(async (params = {}) => {
    try {
      return await fetchAvailableDrivers(params)
    } catch (err) {
      return { ok: false }
    }
  }, [fetchAvailableDrivers])

  const handleCreateVehicle = useCallback(async (data) => {
    setLoading(true)
    try {
      const res = await createVehicle(data)
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [createVehicle])

  const handleCreateDriver = useCallback(async (data) => {
    setLoading(true)
    try {
      const res = await createDriver(data)
      return res
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [createDriver])

  useEffect(() => {
    if (autoFetch) {
      loadVehicles()
      loadDrivers()
    }
  }, [autoFetch])

  return {
    // State
    vehicles,
    currentVehicle,
    drivers,
    currentDriver,
    availableVehicles,
    availableDrivers,
    loading,
    error,
    // Actions
    loadVehicles,
    loadVehicle,
    loadDrivers,
    loadDriver,
    loadAvailableVehicles,
    loadAvailableDrivers,
    createVehicle: handleCreateVehicle,
    createDriver: handleCreateDriver,
  }
}
