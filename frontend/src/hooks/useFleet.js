/**
 * useFleet - Custom hook for FMS fleet operations
 */
import { useState, useCallback, useEffect } from 'react'
import { useFmsStore, useFmsVehicles, useFmsCurrentVehicle } from '../store/fmsStore'

export function useFleet(autoFetch = false) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const vehicles = useFmsVehicles()
  const currentVehicle = useFmsCurrentVehicle()
  const drivers = useFmsStore(s => s.drivers)
  const currentDriver = useFmsStore(s => s.currentDriver)
  const availableVehicles = useFmsStore(s => s.availableVehicles)
  const availableDrivers = useFmsStore(s => s.availableDrivers)
  const fetchVehicles = useFmsStore(s => s.fetchVehicles)
  const fetchVehicle = useFmsStore(s => s.fetchVehicle)
  const createVehicle = useFmsStore(s => s.createVehicle)
  const fetchAvailableVehicles = useFmsStore(s => s.fetchAvailableVehicles)
  const fetchDrivers = useFmsStore(s => s.fetchDrivers)
  const fetchDriver = useFmsStore(s => s.fetchDriver)
  const createDriver = useFmsStore(s => s.createDriver)
  const fetchAvailableDrivers = useFmsStore(s => s.fetchAvailableDrivers)

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
