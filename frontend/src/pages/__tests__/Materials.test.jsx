/**
 * Tests para Materials
 * Testing de busqueda y agregado de materiales a solicitudes
 *
 * Component uses MUI components (TextField, Button, Dialog, etc.)
 * with sub-components: MaterialDetailModal, MaterialsTable,
 * SearchDropdown, BarcodeScanner, AssistantModal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// ─── Stable i18n mock (must be module-level) ────────────────────────────────
const stableT = (key, fallback) => fallback || key
const stableI18n = { t: stableT, locale: 'es' }
vi.mock('../../context/i18n', () => ({ useI18n: () => stableI18n }))

// ─── Mock services ──────────────────────────────────────────────────────────
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
    getFavoritos: vi.fn(),
    addFavorito: vi.fn(),
    removeFavorito: vi.fn(),
  },
}))

vi.mock('../../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: null }) },
}))

import * as spm from '../../services/spm'
import api from '../../services/api'

// ─── Mock router ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ─── Mock formatters / constants ────────────────────────────────────────────
vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `USD ${val?.toFixed(2) || '0.00'}`,
  formatAlmacen: (val) => val || '-',
}))

vi.mock('../../constants/sectores', () => ({
  renderSector: (sol) => sol?.sector || '-',
}))

// ─── Mock child components (they are MUI-heavy, so we mock them simply) ─────
vi.mock('../../components/materials', () => ({
  MaterialDetailModal: ({ isOpen, onClose, selectedMaterial, detail, loadingDetail }) => {
    if (!isOpen) return null
    return (
      <div data-testid="material-detail-modal">
        <span>Material Detail Modal</span>
        {detail && (
          <>
            <span>Stock: {detail.stock_total}</span>
            {detail.mrp && <span>Stock seguridad: {detail.mrp.stock_seguridad}</span>}
          </>
        )}
        <button onClick={onClose}>Cerrar modal detalle</button>
      </div>
    )
  },
  MaterialsTable: ({ items, onQtyChange, onDelete, onOpenComment }) => {
    if (!items || items.length === 0) {
      return <div data-testid="materials-table">Sin materiales agregados</div>
    }
    return (
      <div data-testid="materials-table">
        <table>
          <tbody>
            {items.map((it) => (
              <tr key={it.codigo} data-testid={`row-${it.codigo}`}>
                <td>{it.codigo}</td>
                <td>{it.descripcion}</td>
                <td>{it.unidad}</td>
                <td>
                  <input
                    type="number"
                    value={it.cantidad}
                    onChange={(e) => onQtyChange(it.codigo, e.target.value)}
                    data-testid={`qty-${it.codigo}`}
                  />
                </td>
                <td>USD {(it.precio_unitario || 0).toFixed(2)}</td>
                <td>USD {((it.cantidad || 0) * (it.precio_unitario || 0)).toFixed(2)}</td>
                <td>
                  <button onClick={() => onDelete(it.codigo)} data-testid={`delete-${it.codigo}`}>
                    Eliminar
                  </button>
                </td>
                <td>
                  <button onClick={() => onOpenComment(it.codigo)} data-testid={`comment-${it.codigo}`}>
                    Nota
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
  SearchDropdown: ({
    dropdownOpen,
    results,
    loadingSearch,
    selectedMaterial,
    onSelect,
    onClose,
    debouncedCodigo,
    debouncedDesc,
  }) => {
    if (!dropdownOpen) return null
    return (
      <div data-testid="search-dropdown">
        {loadingSearch && <span>Buscando...</span>}
        {!loadingSearch && results.map((m) => (
          <button
            key={m.codigo}
            onClick={() => onSelect(m)}
            data-testid={`result-${m.codigo}`}
          >
            <span>{m.codigo}</span>
            <span>{m.descripcion}</span>
          </button>
        ))}
        <button onClick={onClose}>Cerrar dropdown</button>
      </div>
    )
  },
  BarcodeScanner: ({ open, onClose, onScan }) => {
    if (!open) return null
    return <div data-testid="barcode-scanner">Scanner</div>
  },
}))

vi.mock('../../components/AssistantModal', () => ({
  AssistantModal: ({ isOpen, onClose }) => {
    if (!isOpen) return null
    return <div data-testid="assistant-modal">Assistant</div>
  },
}))

// ─── Import component under test (AFTER mocks) ─────────────────────────────
import Materials from '../Materials'

// ─── Helper: render with router + route param id=123 ────────────────────────
const renderWithRouter = (ui) => {
  return render(
    <MemoryRouter initialEntries={['/solicitud/123/materiales']}>
      <Routes>
        <Route path="/solicitud/:id/materiales" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════
describe('Materials', () => {
  const mockSolicitud = {
    id: 123,
    centro: '1001',
    sector: 'Compras',
    almacen_virtual: 'ALM001',
    estado: 'draft',
    items: [],
  }

  const mockMateriales = [
    {
      codigo: 'MAT001',
      descripcion: 'Tornillo M6x20',
      descripcion_larga: 'Tornillo metrico M6 x 20mm acero inoxidable',
      unidad: 'UNI',
      precio_usd: 0.50,
    },
    {
      codigo: 'MAT002',
      descripcion: 'Tuerca M6',
      descripcion_larga: 'Tuerca metrica M6 acero inoxidable',
      unidad: 'UNI',
      precio_usd: 0.25,
    },
  ]

  const mockDetalle = {
    centro_consultado: '1001',
    almacen_consultado: 'ALM001',
    stock_total: 500,
    pedidos_en_curso: 2,
    stock_detalle: [{ centro: '1001', almacen_consultado: 'ALM001', stock: 500 }],
    stock_detalle_full: [],
    mrp: {
      planificado_mrp: true,
      sector: 'Compras',
      stock_seguridad: 100,
      punto_pedido: 200,
      stock_maximo: 1000,
    },
    consumo: {
      total: 5000,
      promedio_anual: 1000,
      anio_desde: 2020,
      anio_hasta: 2024,
      registros: [
        { fecha: '2024-01', cantidad: 100 },
        { fecha: '2023-12', cantidad: 95 },
      ],
    },
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    spm.solicitudes.obtener.mockResolvedValue({
      data: { solicitud: mockSolicitud },
    })
    spm.materiales.buscar.mockResolvedValue({ data: mockMateriales })
    spm.materiales.detalle.mockResolvedValue({ data: mockDetalle })
    spm.materiales.getFavoritos.mockResolvedValue({ data: { data: [] } })
    spm.materiales.addFavorito.mockResolvedValue({ data: { ok: true } })
    spm.materiales.removeFavorito.mockResolvedValue({ data: { ok: true } })
    api.get.mockResolvedValue({ data: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ─── Helper: get the actual <input> inside a MUI TextField by its id ────
  const getInput = (id) => document.getElementById(id)

  // ─── Helper: wait for loading to finish ─────────────────────────────────
  const waitForLoaded = async () => {
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    // Wait for the solicitud to load and component to render past loading state
    await waitFor(() => {
      expect(screen.getByText('Agregar Materiales')).toBeInTheDocument()
      expect(screen.getByText('#123')).toBeInTheDocument()
    })
  }

  // ─── Helper: type in search and trigger debounce ────────────────────────
  const searchByDesc = async (text) => {
    const descInput = getInput('searchDesc')
    await act(async () => {
      fireEvent.change(descInput, { target: { value: text } })
    })
    // Advance past debounce (250ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    // Wait for search results
    await waitFor(() => {
      expect(spm.materiales.buscar).toHaveBeenCalled()
    })
    // Let the search promise resolve
    await act(async () => {
      await vi.runAllTimersAsync()
    })
  }

  // ─── Helper: select a material from results ────────────────────────────
  const selectMaterial = async (codigo = 'MAT001') => {
    await waitFor(() => {
      expect(screen.getByTestId(`result-${codigo}`)).toBeInTheDocument()
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId(`result-${codigo}`))
    })
    // Wait for detail to load
    await act(async () => {
      await vi.runAllTimersAsync()
    })
  }

  // ─── Helper: add a material (search + select + click Add) ──────────────
  const addMaterial = async () => {
    await searchByDesc('Tornillo')
    await selectMaterial('MAT001')
    // After selection, detail auto-loads and detailViewed becomes true
    await waitFor(() => {
      const addButtons = screen.getAllByText('Agregar')
      expect(addButtons.length).toBeGreaterThan(0)
    })
    const addButton = screen.getAllByText('Agregar').find(
      (btn) => !btn.closest('[data-testid="search-dropdown"]')
    )
    await act(async () => {
      fireEvent.click(addButton)
    })
    await act(async () => {
      await vi.runAllTimersAsync()
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Renderizado inicial
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Renderizado inicial', () => {
    it('debe renderizar el componente', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      // Title is rendered
      expect(screen.getByText('Agregar Materiales')).toBeInTheDocument()
    })

    it('debe mostrar el titulo "Agregar Materiales"', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      expect(screen.getByText('Agregar Materiales')).toBeInTheDocument()
    })

    it('debe cargar la solicitud al montar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      expect(spm.solicitudes.obtener).toHaveBeenCalledWith('123')
    })

    it('debe mostrar skeleton mientras carga', async () => {
      // Make the solicitud load hang
      spm.solicitudes.obtener.mockReturnValue(new Promise(() => {}))
      renderWithRouter(<Materials />)
      // The loading state shows "Cargando materiales" aria-label
      expect(screen.getByLabelText('Cargando materiales')).toBeInTheDocument()
    })

    it('debe mostrar informacion de la solicitud', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      expect(screen.getByText('#123')).toBeInTheDocument()
      expect(screen.getByText('1001')).toBeInTheDocument()
      expect(screen.getByText('Compras')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Busqueda de materiales
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Busqueda de materiales', () => {
    it('debe mostrar campos de busqueda', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      expect(getInput('searchCodigo')).toBeInTheDocument()
      expect(getInput('searchDesc')).toBeInTheDocument()
    })

    it('debe buscar materiales al escribir codigo', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()

      const codigoInput = getInput('searchCodigo')
      await act(async () => {
        fireEvent.change(codigoInput, { target: { value: 'MAT001' } })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })

      await waitFor(() => {
        expect(spm.materiales.buscar).toHaveBeenCalledWith(
          expect.objectContaining({ codigo: 'MAT001' })
        )
      })
    })

    it('debe buscar materiales al escribir descripcion', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()

      await searchByDesc('Tornillo')

      expect(spm.materiales.buscar).toHaveBeenCalledWith(
        expect.objectContaining({ descripcion: 'Tornillo' })
      )
    })

    it('debe mostrar resultados de busqueda', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')

      await waitFor(() => {
        expect(screen.getByTestId('search-dropdown')).toBeInTheDocument()
        expect(screen.getByTestId('result-MAT001')).toBeInTheDocument()
      })
    })

    it('debe limpiar busqueda al hacer clic en limpiar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()

      const descInput = getInput('searchDesc')
      await act(async () => {
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })

      // Click the clear search button (has aria-label "Limpiar busqueda")
      await waitFor(() => {
        expect(screen.getByLabelText('Limpiar busqueda')).toBeInTheDocument()
      })
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Limpiar busqueda'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // The input should be cleared
      expect(getInput('searchDesc').value).toBe('')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Seleccion de materiales
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Seleccion de materiales', () => {
    it('debe seleccionar un material al hacer clic', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      await waitFor(() => {
        expect(spm.materiales.detalle).toHaveBeenCalledWith(
          'MAT001',
          expect.any(Object)
        )
      })
    })

    it('debe mostrar el material seleccionado', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      // The selected material section should display the material code
      await waitFor(() => {
        // The component shows material code in the "selected material" section
        expect(screen.getByText('MAT001')).toBeInTheDocument()
      })
    })

    it('debe cargar detalles automaticamente al seleccionar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      await waitFor(() => {
        expect(spm.materiales.detalle).toHaveBeenCalled()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Agregar materiales a la solicitud
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Agregar materiales a la solicitud', () => {
    it('debe agregar material seleccionado al hacer clic en Agregar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      // Material should appear in the MaterialsTable mock
      await waitFor(() => {
        expect(screen.getByTestId('row-MAT001')).toBeInTheDocument()
      })
    })

    it('debe mostrar el material en la tabla de resumen', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      await waitFor(() => {
        expect(screen.getByText('Tornillo M6x20')).toBeInTheDocument()
      })
    })

    it('debe incrementar cantidad si el material ya existe', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      // Add the same material again: search again
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      await waitFor(() => {
        const addButtons = screen.getAllByText('Agregar')
        expect(addButtons.length).toBeGreaterThan(0)
      })

      const addButton = screen.getAllByText('Agregar').find(
        (btn) => !btn.closest('[data-testid="search-dropdown"]')
      )
      await act(async () => {
        fireEvent.click(addButton)
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // The quantity input should show 2
      await waitFor(() => {
        const qtyInput = screen.getByTestId('qty-MAT001')
        expect(Number(qtyInput.value)).toBe(2)
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Gestion de cantidad
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Gestion de cantidad', () => {
    it('debe permitir cambiar la cantidad de un material', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      const qtyInput = screen.getByTestId('qty-MAT001')
      await act(async () => {
        fireEvent.change(qtyInput, { target: { value: '10' } })
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(qtyInput.value).toBe('10')
    })

    it('debe calcular el subtotal correctamente', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      const qtyInput = screen.getByTestId('qty-MAT001')
      await act(async () => {
        fireEvent.change(qtyInput, { target: { value: '10' } })
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // MaterialsTable mock renders subtotal = cantidad * precio_unitario
      // 10 * 0.50 = 5.00 (may appear in both table row and context total)
      await waitFor(() => {
        const matches = screen.getAllByText('USD 5.00')
        expect(matches.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Eliminar materiales
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Eliminar materiales', () => {
    it('debe eliminar un material de la lista', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      // Click the delete button in our mocked MaterialsTable
      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-MAT001'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // The empty table message should appear
      await waitFor(() => {
        expect(screen.getByText('Sin materiales agregados')).toBeInTheDocument()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Guardar borrador
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Guardar borrador', () => {
    it('debe guardar borrador al hacer clic en Guardar como borrador', async () => {
      spm.solicitudes.guardarBorrador.mockResolvedValue({
        data: { solicitud: mockSolicitud },
      })

      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      // Click "Guardar como borrador"
      const guardarButton = screen.getByText('Guardar como borrador')
      await act(async () => {
        fireEvent.click(guardarButton)
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => {
        expect(spm.solicitudes.guardarBorrador).toHaveBeenCalled()
      })
    })

    it('debe mostrar mensaje de exito al guardar borrador', async () => {
      spm.solicitudes.guardarBorrador.mockResolvedValue({
        data: { solicitud: mockSolicitud },
      })

      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      await act(async () => {
        fireEvent.click(screen.getByText('Guardar como borrador'))
      })
      // Only advance enough for the async save, not the 3000ms auto-dismiss
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      await waitFor(() => {
        expect(screen.getByText('Borrador guardado.')).toBeInTheDocument()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Enviar solicitud
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Enviar solicitud', () => {
    it('debe abrir modal de confirmacion al enviar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      // Click "Enviar Solicitud"
      await act(async () => {
        fireEvent.click(screen.getByText('Enviar Solicitud'))
      })

      // The submit confirm dialog should open (MUI Dialog with "Si, enviar solicitud")
      await waitFor(() => {
        expect(screen.getByText('Si, enviar solicitud')).toBeInTheDocument()
      })
    })

    it('debe enviar solicitud al confirmar', async () => {
      spm.solicitudes.finalizar.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, estado: 'Enviada' } },
      })

      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      await act(async () => {
        fireEvent.click(screen.getByText('Enviar Solicitud'))
      })

      await waitFor(() => {
        expect(screen.getByText('Si, enviar solicitud')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Si, enviar solicitud'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => {
        expect(spm.solicitudes.finalizar).toHaveBeenCalled()
      })
    })

    it('debe navegar a Mis Solicitudes despues de enviar', async () => {
      spm.solicitudes.finalizar.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, estado: 'Enviada' } },
      })

      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      await act(async () => {
        fireEvent.click(screen.getByText('Enviar Solicitud'))
      })

      await waitFor(() => {
        expect(screen.getByText('Si, enviar solicitud')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Si, enviar solicitud'))
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/mis-solicitudes')
      })
    })

    it('debe validar que hay al menos un item antes de enviar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()

      // Without items, the Enviar Solicitud button should be disabled
      const enviarButton = screen.getByText('Enviar Solicitud').closest('button')
      expect(enviarButton).toBeDisabled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Cancelar solicitud
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Cancelar solicitud', () => {
    it('debe abrir modal de confirmacion al cancelar', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()

      await act(async () => {
        fireEvent.click(screen.getByText('Cancelar Solicitud'))
      })

      // ConfirmDialog opens with "Confirmar" button
      await waitFor(() => {
        expect(screen.getByText('Confirmar')).toBeInTheDocument()
      })
    })

    it('debe eliminar solicitud al confirmar cancelacion', async () => {
      spm.solicitudes.eliminar.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<Materials />)
      await waitForLoaded()

      await act(async () => {
        fireEvent.click(screen.getByText('Cancelar Solicitud'))
      })

      await waitFor(() => {
        expect(screen.getByText('Confirmar')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Confirmar'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => {
        expect(spm.solicitudes.eliminar).toHaveBeenCalledWith('123')
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Modal de detalle de material
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Modal de detalle de material', () => {
    it('debe abrir modal de detalle al hacer clic en Ver detalles', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      // Wait for the "Ver detalles" button to be present
      await waitFor(() => {
        expect(screen.getByText('Ver detalles')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Ver detalles'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => {
        expect(screen.getByTestId('material-detail-modal')).toBeInTheDocument()
      })
    })

    it('debe mostrar stock en el modal', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      await act(async () => {
        fireEvent.click(screen.getByText('Ver detalles'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument()
      })
    })

    it('debe mostrar informacion de MRP en el modal', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await searchByDesc('Tornillo')
      await selectMaterial('MAT001')

      await act(async () => {
        fireEvent.click(screen.getByText('Ver detalles'))
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      await waitFor(() => {
        expect(screen.getByText(/Stock seguridad/)).toBeInTheDocument()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Calculo de totales
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Calculo de totales', () => {
    it('debe calcular el total correctamente', async () => {
      renderWithRouter(<Materials />)
      await waitForLoaded()
      await addMaterial()

      const qtyInput = screen.getByTestId('qty-MAT001')
      await act(async () => {
        fireEvent.change(qtyInput, { target: { value: '10' } })
      })
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // Total = 10 * 0.50 = 5.00
      await waitFor(() => {
        const matches = screen.getAllByText('USD 5.00')
        expect(matches.length).toBeGreaterThanOrEqual(1)
      })
    })
  })
})
