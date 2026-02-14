/**
 * Tests para useForecast hook
 * Verifica forecast, backtesting, comparacion de modelos, simulacion y catalogos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// --- Mocks ---

vi.mock('../../services/forecast', () => ({
  default: {
    getCentros: vi.fn(),
    getAlmacenes: vi.fn(),
    getModelsDisponibles: vi.fn(),
    getForecast: vi.fn(),
    runBacktest: vi.fn(),
    compareModels: vi.fn(),
    autoSelectModel: vi.fn(),
  },
}))

import { useForecast } from '../useForecast'
import forecastService from '../../services/forecast'

// --- Test data ---

const mockModelsResponse = {
  modelos: ['random_forest', 'gradient_boosting', 'linear'],
  nombres: {
    random_forest: 'Random Forest',
    gradient_boosting: 'Gradient Boosting',
    linear: 'Regression Lineal',
  },
}

const mockForecastResult = {
  predicciones: [
    { fecha: '2026-03-01', cantidad_predicha: 100, limite_inferior: 80, limite_superior: 120 },
    { fecha: '2026-04-01', cantidad_predicha: 110, limite_inferior: 85, limite_superior: 135 },
  ],
  historico: [
    { fecha: '2026-01-01', cantidad: 90 },
    { fecha: '2026-02-01', cantidad: 95 },
  ],
  metricas: { mae: 5.2, rmse: 7.1 },
  nombre_modelo: 'Random Forest',
}

const mockBacktestResult = {
  resultados: [{ paso: 1, real: 100, predicho: 98 }],
  metricas: { mae: 3.5 },
}

const mockCompareResult = {
  comparacion: [
    { modelo: 'random_forest', mae: 5.2 },
    { modelo: 'linear', mae: 8.1 },
  ],
}

const mockAutoSelectResult = {
  mejor_modelo: 'gradient_boosting',
  metricas: { mae: 3.2 },
}

// --- Tests ---

describe('useForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    forecastService.getCentros.mockResolvedValue([{ id: 'C1', nombre: 'Centro 1' }])
    forecastService.getAlmacenes.mockResolvedValue([{ id: 'A1', nombre: 'Almacen 1' }])
    forecastService.getModelsDisponibles.mockResolvedValue(mockModelsResponse)
  })

  // ---- 1. Initial state ----
  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useForecast())

    expect(result.current.materialCodigo).toBe('')
    expect(result.current.modeloSeleccionado).toBe('')
    expect(result.current.diasPrediccion).toBe(30)
    expect(result.current.mesesHistorico).toBe(0)
    expect(result.current.centro).toBe('')
    expect(result.current.almacen).toBe('')
    expect(result.current.forecastData).toBeNull()
    expect(result.current.backtestData).toBeNull()
    expect(result.current.comparacionData).toBeNull()
    expect(result.current.autoSelectData).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.loadingBacktest).toBe(false)
    expect(result.current.loadingComparacion).toBe(false)
    expect(result.current.loadingAutoSelect).toBe(false)
    expect(result.current.loadingCatalogos).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.simulationMode).toBe(false)
    expect(result.current.simulationParams).toBeNull()
  })

  // ---- 2. Loads catalogos on mount ----
  it('should load centros, almacenes and modelos on mount', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    expect(forecastService.getCentros).toHaveBeenCalled()
    expect(forecastService.getAlmacenes).toHaveBeenCalled()
    expect(forecastService.getModelsDisponibles).toHaveBeenCalled()

    expect(result.current.centrosDisponibles).toEqual([{ id: 'C1', nombre: 'Centro 1' }])
    expect(result.current.almacenesDisponibles).toEqual([{ id: 'A1', nombre: 'Almacen 1' }])
    expect(result.current.modelosDisponibles).toHaveLength(3)
    expect(result.current.modeloSeleccionado).toBe('random_forest')
  })

  // ---- 3. Fallback models when API fails ----
  it('should use fallback models when models API fails', async () => {
    forecastService.getModelsDisponibles.mockRejectedValue(new Error('Auth error'))

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    expect(result.current.modelosDisponibles).toHaveLength(3)
    expect(result.current.modelosDisponibles[0].id).toBe('random_forest')
    expect(result.current.modeloSeleccionado).toBe('random_forest')
  })

  // ---- 4. Models without nombres ----
  it('should handle models response without nombres map', async () => {
    forecastService.getModelsDisponibles.mockResolvedValue({
      modelos: ['xgboost', 'prophet'],
    })

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    expect(result.current.modelosDisponibles).toHaveLength(2)
    expect(result.current.modelosDisponibles[0].nombre).toBe('XGBoost')
    expect(result.current.modelosDisponibles[1].nombre).toBe('Prophet')
  })

  // ---- 5. ejecutarForecast - success ----
  it('should execute forecast and store results', async () => {
    forecastService.getForecast.mockResolvedValue(mockForecastResult)

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    act(() => {
      result.current.setMaterialCodigo('MAT-001')
    })

    let forecastResult
    await act(async () => {
      forecastResult = await result.current.ejecutarForecast('MAT-001')
    })

    expect(forecastService.getForecast).toHaveBeenCalledWith('MAT-001', expect.objectContaining({
      dias: 30,
      modelo: 'random_forest',
    }))
    expect(result.current.forecastData).toEqual(mockForecastResult)
    expect(result.current.loading).toBe(false)
    expect(forecastResult).toEqual(mockForecastResult)
  })

  // ---- 6. ejecutarForecast - no material code ----
  it('should set error when forecast is run without material code', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    let forecastResult
    await act(async () => {
      forecastResult = await result.current.ejecutarForecast('')
    })

    expect(result.current.error).toBe('Debe ingresar un c\u00f3digo de material')
    expect(forecastResult).toBeNull()
  })

  // ---- 7. ejecutarForecast - API error ----
  it('should handle forecast API errors', async () => {
    forecastService.getForecast.mockRejectedValue({
      response: { data: { error: 'Datos insuficientes' } },
    })

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.ejecutarForecast('MAT-001')
    })

    expect(result.current.error).toBe('Datos insuficientes')
    expect(result.current.forecastData).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  // ---- 8. ejecutarBacktest - success ----
  it('should execute backtesting and store results', async () => {
    forecastService.runBacktest.mockResolvedValue(mockBacktestResult)

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.ejecutarBacktest('MAT-001', { ventana: 60, pasos: 10 })
    })

    expect(forecastService.runBacktest).toHaveBeenCalledWith('MAT-001', expect.objectContaining({
      modelo: 'random_forest',
      ventana: 60,
      pasos: 10,
    }))
    expect(result.current.backtestData).toEqual(mockBacktestResult)
    expect(result.current.loadingBacktest).toBe(false)
  })

  // ---- 9. ejecutarBacktest - no material code ----
  it('should set error when backtest is run without material code', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    const btResult = await act(async () => {
      return await result.current.ejecutarBacktest('')
    })

    expect(result.current.error).toContain('c\u00f3digo')
    expect(btResult).toBeNull()
  })

  // ---- 10. compararModelos - success ----
  it('should compare models and store results', async () => {
    forecastService.compareModels.mockResolvedValue(mockCompareResult)

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.compararModelos('MAT-001')
    })

    expect(forecastService.compareModels).toHaveBeenCalledWith('MAT-001', expect.objectContaining({
      modelos: expect.any(Array),
    }))
    expect(result.current.comparacionData).toEqual(mockCompareResult)
    expect(result.current.loadingComparacion).toBe(false)
  })

  // ---- 11. compararModelos - API error ----
  it('should handle comparison API errors', async () => {
    forecastService.compareModels.mockRejectedValue({
      response: { data: { error: { message: 'Timeout' } } },
    })

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.compararModelos('MAT-001')
    })

    expect(result.current.error).toBe('Timeout')
    expect(result.current.comparacionData).toBeNull()
  })

  // ---- 12. autoSeleccionarModelo - success ----
  it('should auto-select best model and update selection', async () => {
    forecastService.autoSelectModel.mockResolvedValue(mockAutoSelectResult)

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.autoSeleccionarModelo('MAT-001')
    })

    expect(forecastService.autoSelectModel).toHaveBeenCalledWith('MAT-001', expect.objectContaining({
      criterio: 'mae',
      optimizar: false,
    }))
    expect(result.current.autoSelectData).toEqual(mockAutoSelectResult)
    expect(result.current.modeloSeleccionado).toBe('gradient_boosting')
    expect(result.current.loadingAutoSelect).toBe(false)
  })

  // ---- 13. autoSeleccionarModelo - no material code ----
  it('should require material code for auto-select', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.autoSeleccionarModelo('')
    })

    expect(result.current.error).toContain('c\u00f3digo')
  })

  // ---- 14. generateSyntheticData ----
  it('should generate synthetic forecast data for cold start', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    act(() => {
      result.current.generateSyntheticData({
        consumoMensual: 100,
        volatilidad: 0.2,
        leadTime: 15,
      })
    })

    expect(result.current.simulationMode).toBe(true)
    expect(result.current.simulationParams).toEqual({
      consumoMensual: 100,
      volatilidad: 0.2,
      leadTime: 15,
    })
    expect(result.current.forecastData).toBeDefined()
    expect(result.current.forecastData.simulationMode).toBe(true)
    expect(result.current.forecastData.predicciones).toHaveLength(12)
    expect(result.current.forecastData.historico).toEqual([])
    expect(result.current.forecastData.nombre_modelo).toBe('Simulaci\u00f3n')
    expect(result.current.backtestData).toBeNull()
    expect(result.current.comparacionData).toBeNull()
    expect(result.current.error).toBeNull()
  })

  // ---- 15. generateSyntheticData with custom predictions ----
  it('should accept custom predictions for cold start', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    const customPreds = [
      { fecha: '2026-03-01', prediccion: 150, limiteInferior: 120, limiteSuperior: 180 },
    ]

    act(() => {
      result.current.generateSyntheticData({
        consumoMensual: 100,
        volatilidad: 0.2,
        leadTime: 15,
        customPredictions: customPreds,
      })
    })

    expect(result.current.forecastData.predicciones).toHaveLength(1)
    expect(result.current.forecastData.predicciones[0].prediccion).toBe(150)
    expect(result.current.forecastData.safetyStock).toBeGreaterThan(0)
  })

  // ---- 16. exitSimulationMode ----
  it('should exit simulation mode and clear data', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    act(() => {
      result.current.generateSyntheticData({
        consumoMensual: 50,
        volatilidad: 0.1,
        leadTime: 7,
      })
    })

    expect(result.current.simulationMode).toBe(true)

    act(() => {
      result.current.exitSimulationMode()
    })

    expect(result.current.simulationMode).toBe(false)
    expect(result.current.simulationParams).toBeNull()
    expect(result.current.forecastData).toBeNull()
  })

  // ---- 17. limpiar ----
  it('should clear all forecast data', async () => {
    forecastService.getForecast.mockResolvedValue(mockForecastResult)

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.ejecutarForecast('MAT-001')
    })

    expect(result.current.forecastData).not.toBeNull()

    act(() => {
      result.current.limpiar()
    })

    expect(result.current.forecastData).toBeNull()
    expect(result.current.backtestData).toBeNull()
    expect(result.current.comparacionData).toBeNull()
    expect(result.current.autoSelectData).toBeNull()
    expect(result.current.simulationMode).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // ---- 18. getNombreModelo ----
  it('should return readable model names', async () => {
    const { result } = renderHook(() => useForecast())

    expect(result.current.getNombreModelo('random_forest')).toBe('Random Forest')
    expect(result.current.getNombreModelo('gradient_boosting')).toBe('Gradient Boosting')
    expect(result.current.getNombreModelo('linear')).toBe('Regresi\u00f3n Lineal')
    expect(result.current.getNombreModelo('xgboost')).toBe('XGBoost')
    expect(result.current.getNombreModelo('prophet')).toBe('Prophet')
    expect(result.current.getNombreModelo('arima')).toBe('ARIMA')
    expect(result.current.getNombreModelo('unknown_model')).toBe('unknown_model')
    expect(result.current.getNombreModelo(null)).toBe('Sin modelo')
  })

  // ---- 19. prediccionesParaGrafico / historicoParaGrafico ----
  it('should format predictions and history for charts', async () => {
    forecastService.getForecast.mockResolvedValue(mockForecastResult)

    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    await act(async () => {
      await result.current.ejecutarForecast('MAT-001')
    })

    expect(result.current.prediccionesParaGrafico).toHaveLength(2)
    expect(result.current.prediccionesParaGrafico[0]).toEqual({
      fecha: '2026-03-01',
      prediccion: 100,
      limiteInferior: 80,
      limiteSuperior: 120,
      indice: 0,
    })

    expect(result.current.historicoParaGrafico).toHaveLength(2)
    expect(result.current.historicoParaGrafico[0]).toEqual({
      fecha: '2026-01-01',
      cantidad: 90,
      indice: 0,
    })

    expect(result.current.metricas).toEqual({ mae: 5.2, rmse: 7.1 })
  })

  // ---- 20. State setters ----
  it('should allow setting individual state values', async () => {
    const { result } = renderHook(() => useForecast())

    await waitFor(() => expect(result.current.loadingCatalogos).toBe(false))

    act(() => {
      result.current.setMaterialCodigo('MAT-999')
    })
    expect(result.current.materialCodigo).toBe('MAT-999')

    act(() => {
      result.current.setDiasPrediccion(90)
    })
    expect(result.current.diasPrediccion).toBe(90)

    act(() => {
      result.current.setMesesHistorico(6)
    })
    expect(result.current.mesesHistorico).toBe(6)

    act(() => {
      result.current.setCentro('C100')
    })
    expect(result.current.centro).toBe('C100')

    act(() => {
      result.current.setAlmacen('A200')
    })
    expect(result.current.almacen).toBe('A200')

    act(() => {
      result.current.setModeloSeleccionado('linear')
    })
    expect(result.current.modeloSeleccionado).toBe('linear')

    act(() => {
      result.current.setError('Test error')
    })
    expect(result.current.error).toBe('Test error')
  })
})
