/**
 * Tests para useMaterials hook
 * Verifica state management, busqueda, cart, modals y operaciones de solicitud
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// --- Mocks ---

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '42' }),
  useNavigate: () => mockNavigate,
}))

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || _key }),
}))

vi.mock('../useDebounced', () => ({
  useDebounced: (value) => value,
}))

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('../../services/spm', () => ({
  solicitudes: {
    obtener: vi.fn(),
    guardarBorrador: vi.fn(),
    finalizar: vi.fn(),
    eliminar: vi.fn(),
  },
  materiales: {
    buscar: vi.fn(),
    detalle: vi.fn(),
  },
}))

import { useMaterials } from '../useMaterials'
import { solicitudes, materiales } from '../../services/spm'
import api from '../../services/api'

// --- Helpers ---

const mockSolicitud = {
  id: 42,
  centro: 'C100',
  sector: 'S200',
  almacen: 'A300',
  items: [
    { codigo: 'MAT-001', descripcion: 'Tuerca', unidad: 'UNI', cantidad: 5, precio_unitario: 10 },
  ],
}

function setupObtener(data = mockSolicitud) {
  solicitudes.obtener.mockResolvedValue({ data: { solicitud: data } })
}

// --- Tests ---

describe('useMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    setupObtener()
    // Suppress the presupuesto fetch that happens after sol loads
    api.get.mockResolvedValue({ data: {} })
    // Default: buscar returns empty to avoid search side-effect triggering
    materiales.buscar.mockResolvedValue({ data: { data: [] } })
  })

  // ---- 1. Initial state ----
  it('should initialize with default state values', () => {
    const { result } = renderHook(() => useMaterials())

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe('')
    expect(result.current.actionMsg).toBe('')
    expect(result.current.searchCodigo).toBe('')
    expect(result.current.searchDesc).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.loadingSearch).toBe(false)
    expect(result.current.dropdownOpen).toBe(false)
    expect(result.current.highlightedIndex).toBe(-1)
    expect(result.current.selectedMaterial).toBeNull()
    expect(result.current.showDetailModal).toBe(false)
    expect(result.current.showCancelModal).toBe(false)
    expect(result.current.showSubmitModal).toBe(false)
    expect(result.current.submitting).toBe(false)
    expect(result.current.savingDraft).toBe(false)
  })

  // ---- 2. Load solicitud ----
  it('should load solicitud and items on mount', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(solicitudes.obtener).toHaveBeenCalledWith('42')
    expect(result.current.sol).toEqual(mockSolicitud)
    expect(result.current.items).toEqual(mockSolicitud.items)
  })

  // ---- 3. Error on solicitud load ----
  it('should set error when solicitud load fails', async () => {
    solicitudes.obtener.mockRejectedValue({
      response: { data: { error: { message: 'Not found' } } },
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Not found')
    expect(result.current.sol).toBeNull()
  })

  // ---- 4. Computed: total ----
  it('should compute total from items', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // 5 * 10 = 50
    expect(result.current.total).toBe(50)
  })

  // ---- 5. Computed: hasUnsavedChanges ----
  it('should track unsaved changes', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => {
      result.current.handleQtyChange('MAT-001', 10)
    })

    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  // ---- 6. Computed: itemsSorted ----
  it('should sort items by codigo descending', async () => {
    setupObtener({
      ...mockSolicitud,
      items: [
        { codigo: 'AAA', descripcion: 'A', unidad: 'UNI', cantidad: 1, precio_unitario: 1 },
        { codigo: 'ZZZ', descripcion: 'Z', unidad: 'UNI', cantidad: 1, precio_unitario: 1 },
      ],
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.itemsSorted[0].codigo).toBe('ZZZ')
    expect(result.current.itemsSorted[1].codigo).toBe('AAA')
  })

  // ---- 7. Computed: presupuestoInsuf ----
  it('should detect insufficient budget when presupuesto is set', async () => {
    // Presupuesto is loaded via api.get inside the effect
    api.get.mockResolvedValue({ data: { saldo_usd: 10 } })

    setupObtener({
      ...mockSolicitud,
      items: [
        { codigo: 'MAT-001', descripcion: 'Tuerca', unidad: 'UNI', cantidad: 5, precio_unitario: 10 },
      ],
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // total = 50 > saldo_usd 10
    await waitFor(() => expect(result.current.presupuesto).toBeTruthy())
    expect(result.current.presupuestoInsuf).toBe(true)
  })

  // ---- 8. handleQtyChange ----
  it('should update item quantity', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleQtyChange('MAT-001', 20)
    })

    const item = result.current.items.find((i) => i.codigo === 'MAT-001')
    expect(item.cantidad).toBe(20)
  })

  // ---- 9. handleQtyChange ignores invalid values ----
  it('should reject invalid quantity values', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleQtyChange('MAT-001', 0)
    })

    // quantity should remain original (5)
    const item = result.current.items.find((i) => i.codigo === 'MAT-001')
    expect(item.cantidad).toBe(5)

    act(() => {
      result.current.handleQtyChange('MAT-001', 'abc')
    })

    const item2 = result.current.items.find((i) => i.codigo === 'MAT-001')
    expect(item2.cantidad).toBe(5)
  })

  // ---- 10. handleDelete ----
  it('should remove item from cart', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleDelete('MAT-001')
    })

    expect(result.current.items).toEqual([])
  })

  // ---- 11. handleClearSearch ----
  it('should clear search state', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleClearSearch()
    })

    expect(result.current.searchCodigo).toBe('')
    expect(result.current.searchDesc).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.dropdownOpen).toBe(false)
    expect(result.current.selectedMaterial).toBeNull()
  })

  // ---- 12. handleAdd - new item ----
  it('should add a new material to the cart', async () => {
    materiales.detalle.mockResolvedValue({
      data: { codigo: 'MAT-NEW', stock: 100 },
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Simulate selecting a material first
    await act(async () => {
      await result.current.handleSelect({
        codigo: 'MAT-NEW',
        descripcion: 'Material Nuevo',
        descripcion_larga: 'Desc larga',
        unidad_medida: 'KG',
        precio_usd: 25,
      })
    })

    await act(async () => {
      await result.current.handleAdd()
    })

    const added = result.current.items.find((i) => i.codigo === 'MAT-NEW')
    expect(added).toBeDefined()
    expect(added.cantidad).toBe(1)
    expect(added.precio_unitario).toBe(25)
    expect(added.unidad).toBe('KG')
  })

  // ---- 13. handleAdd - existing item increments qty ----
  it('should increment quantity when adding existing material', async () => {
    materiales.detalle.mockResolvedValue({
      data: { codigo: 'MAT-001', stock: 50 },
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSelect({
        codigo: 'MAT-001',
        descripcion: 'Tuerca',
        unidad_medida: 'UNI',
        precio_usd: 10,
      })
    })

    await act(async () => {
      await result.current.handleAdd()
    })

    const item = result.current.items.find((i) => i.codigo === 'MAT-001')
    expect(item.cantidad).toBe(6) // was 5, now 5+1
  })

  // ---- 14. handleSaveDraft ----
  it('should save draft and clear unsaved changes flag', async () => {
    solicitudes.guardarBorrador.mockResolvedValue({
      data: { solicitud: mockSolicitud },
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleQtyChange('MAT-001', 99)
    })

    expect(result.current.hasUnsavedChanges).toBe(true)

    await act(async () => {
      await result.current.handleSaveDraft()
    })

    expect(solicitudes.guardarBorrador).toHaveBeenCalledWith('42', expect.any(Array), expect.any(Number))
    expect(result.current.savingDraft).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  // ---- 15. handleSaveDraft error ----
  it('should set error when draft save fails', async () => {
    solicitudes.guardarBorrador.mockRejectedValue({
      response: { data: { error: { message: 'Save failed' } } },
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.handleSaveDraft()
    })

    expect(result.current.error).toBe('Save failed')
    expect(result.current.savingDraft).toBe(false)
  })

  // ---- 16. handleFinalizar - no items ----
  it('should set error when finalizing with no items', async () => {
    setupObtener({ ...mockSolicitud, items: [] })
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleFinalizar()
    })

    expect(result.current.error).toContain('al menos')
    expect(result.current.showSubmitModal).toBe(false)
  })

  // ---- 17. handleFinalizar - opens submit modal ----
  it('should open submit modal when items exist', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleFinalizar()
    })

    expect(result.current.showSubmitModal).toBe(true)
  })

  // ---- 18. confirmFinalizar ----
  it('should submit solicitud and set success message', async () => {
    solicitudes.finalizar.mockResolvedValue({
      data: { solicitud: { ...mockSolicitud, status: 'submitted' } },
    })

    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.confirmFinalizar()
    })

    expect(solicitudes.finalizar).toHaveBeenCalledWith('42', expect.objectContaining({
      items: mockSolicitud.items,
    }))
    expect(result.current.submitting).toBe(false)
    expect(result.current.actionMsg).toContain('aprobaci')
  })

  // ---- 19. Comment modal flow ----
  it('should open, update, and save comment', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleOpenComment('MAT-001')
    })

    expect(result.current.commentModal.open).toBe(true)
    expect(result.current.commentModal.codigo).toBe('MAT-001')

    act(() => {
      result.current.updateCommentText('Urgente')
    })

    expect(result.current.commentModal.comment).toBe('Urgente')

    act(() => {
      result.current.handleSaveComment()
    })

    expect(result.current.commentModal.open).toBe(false)
    const item = result.current.items.find((i) => i.codigo === 'MAT-001')
    expect(item.comentario).toBe('Urgente')
  })

  // ---- 20. handleAddSuggestedItems ----
  it('should add suggested items avoiding duplicates', async () => {
    const { result } = renderHook(() => useMaterials())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.handleAddSuggestedItems([
        { codigo: 'MAT-001', descripcion: 'Tuerca', cantidad: 3 }, // duplicate
        { codigo: 'MAT-NEW', descripcion: 'Tornillo', cantidad: 10, precio_unitario: 5 },
      ])
    })

    // Only 1 new item should be added (MAT-001 already exists)
    expect(result.current.items).toHaveLength(2)
    const newItem = result.current.items.find((i) => i.codigo === 'MAT-NEW')
    expect(newItem).toBeDefined()
    expect(newItem.cantidad).toBe(10)
    expect(result.current.showAssistant).toBe(false)
  })
})
