/**
 * Tests para usePlanner hook
 * Verifica filtrado, paginacion, modales, acciones CRUD y estado del planificador
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// --- Mocks ---

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { centros: [], almacenes: [], sectores: [] } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('../../services/spm', () => ({
  planner: {
    listar: vi.fn(),
    aceptar: vi.fn(),
    finalizar: vi.fn(),
  },
  solicitudes: {
    rechazar: vi.fn(),
  },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 1, id_spm: 1, rol: 'admin' },
  }),
}))

vi.mock('../../hooks/useRealtime', () => ({
  useRealtimeEvent: vi.fn(),
}))

vi.mock('../../hooks/useDebounced', () => ({
  useDebounced: (value) => value,
}))

vi.mock('../../utils/formatters', () => ({
  getSectorNombre: (id) => `Sector-${id}`,
  formatDate: (d) => d || 'N/D',
  exportToExcel: vi.fn(),
}))

import { usePlanner, renderSolicitante } from '../usePlanner'
import { planner, solicitudes } from '../../services/spm'
import api from '../../services/api'
import { exportToExcel } from '../../utils/formatters'

// --- Test data ---

const mockItems = [
  { id: 1, status: 'aprobada', centro: 'C100', sector: 'S1', criticidad: 'Normal', justificacion: 'Test 1', solicitante_nombre: 'Ana', solicitante_apellido: 'Lopez' },
  { id: 2, status: 'En Progreso', centro: 'C200', sector: 'S2', criticidad: 'alta', justificacion: 'Test 2', solicitante_nombre: 'Juan', solicitante_apellido: 'Perez' },
  { id: 3, status: 'finalizada', centro: 'C100', sector: 'S1', criticidad: 'Normal', justificacion: 'Test 3', solicitante_nombre: 'Maria', solicitante_apellido: 'Garcia' },
]

const defaultOpts = {
  t: (_key, fallback) => fallback || _key,
  filterMode: undefined,
}

describe('usePlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planner.listar.mockResolvedValue({ data: mockItems })
    api.get.mockResolvedValue({ data: { centros: [], almacenes: [], sectores: [] } })
  })

  // ---- 1. Initial state ----
  it('should initialize with correct default state', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe('')
    expect(result.current.success).toBe('')
    expect(result.current.q).toBe('')
    expect(result.current.activeTab).toBe('pendientes')
    expect(result.current.currentPage).toBe(1)
    expect(result.current.selectedParaTratar).toBeNull()
    expect(result.current.rejectModal).toEqual({ open: false, solicitud: null, motivo: '' })
    expect(result.current.historialModal).toEqual({ open: false, solicitud: null })

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  // ---- 2. Loads items on mount ----
  it('should load items from API on mount', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(planner.listar).toHaveBeenCalled()
    expect(result.current.items).toEqual(mockItems)
  })

  // ---- 3. Error handling on load ----
  it('should set error when API load fails', async () => {
    planner.listar.mockRejectedValue({
      response: { data: { error: { message: 'Server error' } } },
    })

    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Server error')
  })

  // ---- 4. Tab counts ----
  it('should compute tab counts correctly', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Item 1: aprobada -> pendientes, Item 2: En Progreso -> en_progreso, Item 3: finalizada -> finalizadas
    expect(result.current.tabCounts.pendientes).toBe(1)
    expect(result.current.tabCounts.en_progreso).toBe(1)
    expect(result.current.tabCounts.finalizadas).toBe(1)
  })

  // ---- 5. Filtered by activeTab ----
  it('should filter items by active tab', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Default tab is "pendientes"
    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].id).toBe(1)

    act(() => {
      result.current.setActiveTab('en_progreso')
    })

    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].id).toBe(2)
  })

  // ---- 6. Text search filtering ----
  it('should filter items by search query', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setActiveTab('pendientes')
      result.current.setQ('Test 1')
    })

    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].justificacion).toBe('Test 1')
  })

  // ---- 7. Filter by centro multiselect ----
  it('should filter by centro multiselect', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Switch to finalizadas tab (item 3 is C100)
    act(() => {
      result.current.setActiveTab('finalizadas')
      result.current.setFiltroCentros([{ id: 'C200' }])
    })

    // Item 3 (finalizadas) has centro C100, not C200
    expect(result.current.filtered).toHaveLength(0)
  })

  // ---- 8. Pagination ----
  it('should paginate filtered results', async () => {
    // Create 25 pendientes items
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      status: 'aprobada',
      centro: 'C100',
      sector: 'S1',
      criticidad: 'Normal',
      justificacion: `Sol ${i + 1}`,
    }))
    planner.listar.mockResolvedValue({ data: manyItems })

    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.paginatedItems).toHaveLength(20) // ITEMS_PER_PAGE
    expect(result.current.totalPages).toBe(2)

    act(() => {
      result.current.setCurrentPage(2)
    })

    expect(result.current.paginatedItems).toHaveLength(5)
  })

  // ---- 9. Reset pagination on filter change ----
  it('should reset to page 1 when filters change', async () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      status: 'aprobada',
      centro: 'C100',
      criticidad: 'Normal',
    }))
    planner.listar.mockResolvedValue({ data: manyItems })

    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setCurrentPage(2)
    })

    expect(result.current.currentPage).toBe(2)

    act(() => {
      result.current.setQ('search')
    })

    // Page should reset to 1
    expect(result.current.currentPage).toBe(1)
  })

  // ---- 10. limpiarFiltros ----
  it('should clear all filters', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setQ('test')
      result.current.setFiltroCentros([{ id: 'C1' }])
      result.current.setFiltroEstados([{ value: 'aprobada' }])
    })

    expect(result.current.hayFiltrosActivos).toBe(true)

    act(() => {
      result.current.limpiarFiltros()
    })

    expect(result.current.q).toBe('')
    expect(result.current.filtroCentros).toEqual([])
    expect(result.current.filtroEstados).toEqual([])
    expect(result.current.hayFiltrosActivos).toBe(false)
  })

  // ---- 11. hayFiltrosActivos ----
  it('should detect active filters', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hayFiltrosActivos).toBe(false)

    act(() => {
      result.current.setFiltroCriticidades([{ value: 'alta' }])
    })

    expect(result.current.hayFiltrosActivos).toBe(true)
  })

  // ---- 12. handleTratar - aprobada item ----
  it('should accept and open treatment modal for aprobada item', async () => {
    planner.aceptar.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleTratar({ id: 1, status: 'aprobada' })
    })

    expect(planner.aceptar).toHaveBeenCalledWith(1)
    expect(result.current.selectedParaTratar).toEqual({ id: 1, status: 'aprobada' })
  })

  // ---- 13. handleTratar - non-aprobada item ----
  it('should open treatment modal without accepting for non-aprobada item', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleTratar({ id: 2, status: 'En Progreso' })
    })

    expect(planner.aceptar).not.toHaveBeenCalled()
    expect(result.current.selectedParaTratar).toEqual({ id: 2, status: 'En Progreso' })
  })

  // ---- 14. finalizar ----
  it('should finalize a solicitud and reload', async () => {
    planner.finalizar.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.clearAllMocks()
    planner.listar.mockResolvedValue({ data: mockItems })

    await act(async () => {
      await result.current.finalizar(1)
    })

    expect(planner.finalizar).toHaveBeenCalledWith(1)
    expect(result.current.success).toContain('finalizada')
    expect(planner.listar).toHaveBeenCalled()
  })

  // ---- 15. rechazar - missing motivo ----
  it('should require motivo when rejecting', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openRejectModal({ id: 1 })
    })

    await act(async () => {
      await result.current.rechazar()
    })

    expect(result.current.error).toContain('motivo')
    expect(solicitudes.rechazar).not.toHaveBeenCalled()
  })

  // ---- 16. rechazar - success ----
  it('should reject solicitud with motivo and reload', async () => {
    solicitudes.rechazar.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openRejectModal({ id: 1 })
      result.current.updateRejectMotivo('No cumple requisitos')
    })

    vi.clearAllMocks()
    planner.listar.mockResolvedValue({ data: mockItems })

    await act(async () => {
      await result.current.rechazar()
    })

    expect(solicitudes.rechazar).toHaveBeenCalledWith(1, 'No cumple requisitos')
    expect(result.current.rejectModal.open).toBe(false)
    expect(result.current.success).toContain('rechazada')
  })

  // ---- 17. Reject modal flow ----
  it('should open and close reject modal', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openRejectModal({ id: 5 })
    })

    expect(result.current.rejectModal.open).toBe(true)
    expect(result.current.rejectModal.solicitud).toEqual({ id: 5 })

    act(() => {
      result.current.closeRejectModal()
    })

    expect(result.current.rejectModal.open).toBe(false)
    expect(result.current.rejectModal.solicitud).toBeNull()
  })

  // ---- 18. Historial modal flow ----
  it('should open and close historial modal', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.openHistorialModal({ id: 3 })
    })

    expect(result.current.historialModal.open).toBe(true)
    expect(result.current.historialModal.solicitud).toEqual({ id: 3 })

    act(() => {
      result.current.closeHistorialModal()
    })

    expect(result.current.historialModal.open).toBe(false)
  })

  // ---- 19. handleExport ----
  it('should export filtered data to Excel', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleExport()
    })

    expect(exportToExcel).toHaveBeenCalledWith(
      expect.any(Array),
      expect.stringContaining('planificador-')
    )
    expect(result.current.success).toContain('exportados')
  })

  // ---- 20. Static options and constants ----
  it('should expose static options and message controls', async () => {
    const { result } = renderHook(() => usePlanner(defaultOpts))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Static options
    expect(result.current.estadosOptions).toHaveLength(4)
    expect(result.current.criticidadOptions).toHaveLength(2)
    expect(result.current.itemsPerPage).toBe(20)

    // Message controls
    act(() => {
      result.current.clearError()
      result.current.clearSuccess()
    })

    expect(result.current.error).toBe('')
    expect(result.current.success).toBe('')
  })
})

// ---- Exported helper ----

describe('renderSolicitante', () => {
  it('should render full name from nombre/apellido fields', () => {
    expect(renderSolicitante({ solicitante_nombre: 'Ana', solicitante_apellido: 'Lopez' })).toBe('Ana Lopez')
  })

  it('should fallback to id_usuario when no name', () => {
    expect(renderSolicitante({ id_usuario: 'USR42' })).toBe('USR42')
  })

  it('should return N/D when no data available', () => {
    expect(renderSolicitante({})).toBe('N/D')
  })
})
