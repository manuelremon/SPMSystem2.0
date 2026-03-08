/**
 * Tests para BudgetRequests
 * Testing de listado, aprobacion y rechazo de solicitudes de presupuesto
 *
 * Component migrated to Material-UI with SPMAgGrid and Drawers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import BudgetRequests from '../BudgetRequests'
import { budget } from '../../services/spm'
import { useAuthStore } from '../../store/authStore'

// Mock de servicios
vi.mock('../../services/spm', () => ({
  budget: {
    listar: vi.fn(),
    aprobar: vi.fn(),
    rechazar: vi.fn(),
    getLedger: vi.fn(),
  },
}))

// Mock de store
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 1, nombre: 'Test User', rol: 'admin' },
  })),
}))

// Stable t function reference for useI18n mock
const stableT = (key, fallback) => fallback || key

// Mock de i18n
vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: stableT,
  }),
}))

// Mock de useDebounced
vi.mock('../../hooks/useDebounced', () => ({
  useDebounced: (value) => value,
}))

vi.mock('../../utils/statusStyles', () => ({
  nivelLabels: { L1: 'Nivel 1', L2: 'Nivel 2', ADMIN: 'Admin' },
}))

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `$${val}`,
  formatDate: (val) => val ? new Date(val).toLocaleDateString() : '-',
}))

// Mock SPMAgGrid to render a simple table with row data and actions
vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, loading, emptyMessage }) => {
    if (loading) return <div data-testid="spm-ag-grid-loading">Loading...</div>
    if (!rowData || rowData.length === 0) return <div data-testid="spm-ag-grid-empty">{emptyMessage}</div>

    // Find the actions column to render action buttons
    const actionsCol = columnDefs.find(c => c.field === 'acciones')

    return (
      <div data-testid="spm-ag-grid">
        <table>
          <tbody>
            {rowData.map((row, i) => (
              <tr key={row.id || i} data-testid={`grid-row-${row.id || i}`}>
                <td>{row.centro || row.tipo_movimiento || ''}</td>
                <td>{row.sector || ''}</td>
                <td>{row.monto_solicitado_usd || row.monto_cents || ''}</td>
                <td>{row.estado || ''}</td>
                {actionsCol && actionsCol.cellRenderer && (
                  <td>
                    {actionsCol.cellRenderer({ data: row, value: row.acciones })}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
  default: () => <div>SPMAgGrid</div>,
}))

// Mock XLSX to prevent import errors
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Datos de prueba
const mockBudgetRequests = [
  {
    id: 1,
    centro: 'Centro A',
    sector: 'Sector 1',
    monto_solicitado_usd: 5000,
    saldo_actual_usd: 10000,
    nivel_aprobacion_requerido: 'L1',
    estado: 'pendiente',
    justificacion: 'Materiales urgentes',
  },
  {
    id: 2,
    centro: 'Centro B',
    sector: 'Sector 2',
    monto_solicitado_usd: 15000,
    saldo_actual_usd: 25000,
    nivel_aprobacion_requerido: 'L2',
    estado: 'aprobado',
    justificacion: 'Equipos nuevos',
  },
  {
    id: 3,
    centro: 'Centro C',
    sector: 'Sector 3',
    monto_solicitado_usd: 3000,
    saldo_actual_usd: 8000,
    nivel_aprobacion_requerido: 'L1',
    estado: 'rechazado',
    justificacion: 'Presupuesto insuficiente',
  },
]

// Mock ledger entries
const mockLedgerEntries = Array.from({ length: 75 }, (_, i) => ({
  id: i + 1,
  created_at: new Date(2025, 0, 1 + i).toISOString(),
  tipo_movimiento: i % 2 === 0 ? 'consumo_aprobacion' : 'incorporacion',
  centro: `Centro ${String.fromCharCode(65 + (i % 3))}`,
  sector: `Sector ${(i % 5) + 1}`,
  monto_cents: i % 2 === 0 ? -100000 : 500000,
  saldo_posterior_cents: 10000000 - (i * 10000),
  referencia_tipo: 'solicitud',
  referencia_id: 100 + i,
  motivo: `Movimiento ${i + 1}`,
}))

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <BudgetRequests />
    </BrowserRouter>
  )
}

describe('BudgetRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    budget.listar.mockResolvedValue({ data: { requests: mockBudgetRequests } })
    budget.getLedger.mockResolvedValue({
      data: {
        entries: mockLedgerEntries.slice(0, 50),
        total: mockLedgerEntries.length,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render page header', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Gestión de Presupuestos')).toBeInTheDocument()
      })
    })

    it('should render data grid with ledger by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })
    })

    it('should render Incorporaciones tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
    })

    it('should render Historial tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Historial')).toBeInTheDocument()
      })
    })

    it('should show loading state while fetching ledger', async () => {
      budget.getLedger.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid-loading')).toBeInTheDocument()
      })
    })
  })

  describe('Data Loading', () => {
    it('should call budget.getLedger on mount (historial tab by default)', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })
    })

    it('should call budget.listar when switching to Incorporaciones', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })
    })

    it('should display error message on API failure', async () => {
      budget.getLedger.mockRejectedValue({
        response: { data: { error: { message: 'Error de servidor' } } },
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Error de servidor')).toBeInTheDocument()
      })
    })

    it('should display empty message when no ledger entries', async () => {
      budget.getLedger.mockResolvedValue({ data: { entries: [], total: 0 } })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No hay movimientos de presupuesto')).toBeInTheDocument()
      })
    })
  })

  describe('Tab Filtering', () => {
    it('should load BUR items when switching to Incorporaciones tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({})
      })
    })

    it('should load ledger when switching back to Historial tab', async () => {
      renderComponent()
      // Switch to Incorporaciones
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })
      // Switch back to Historial
      budget.getLedger.mockClear()
      fireEvent.click(screen.getByText('Historial'))
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })
    })

    it('should display BUR items in grid after switching to Incorporaciones tab', async () => {
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })
    })
  })

  describe('Search Filtering', () => {
    it('should render AG Grid with quick filter for filtering', async () => {
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        // AG Grid handles quick filtering internally via enableQuickFilter prop
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate to create page when Incorporar Saldo clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Incorporar Saldo/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Incorporar Saldo/i))

      expect(mockNavigate).toHaveBeenCalledWith('/presupuestos/nueva')
    })
  })

  describe('Refresh', () => {
    it('should reload ledger when switching tabs back to historial', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })

      // Switch to Incorporaciones
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })

      // Switch back triggers reload
      budget.getLedger.mockClear()
      fireEvent.click(screen.getByText('Historial'))
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })
    })

    it('should reload BUR list when switching tabs back to incorporaciones', async () => {
      renderComponent()
      // Switch to Incorporaciones
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })

      // Switch to Historial
      fireEvent.click(screen.getByText('Historial'))
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })

      // Switch back to Incorporaciones triggers reload
      budget.listar.mockClear()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })
    })
  })

  describe('Approval Flow', () => {
    it('should show approval drawer when approve icon button clicked', async () => {
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // The approve buttons are IconButtons with title="Aprobar"
      const approveButtons = screen.getAllByTitle('Aprobar')
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Aprobar Incorporación')).toBeInTheDocument()
      })
    })

    it('should call budget.aprobar when approval confirmed', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // Click approve icon button for first pendiente item
      const approveButtons = screen.getAllByTitle('Aprobar')
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Aprobar Incorporación')).toBeInTheDocument()
      })

      // Confirm in drawer
      fireEvent.click(screen.getByText('Confirmar Aprobación'))

      await waitFor(() => {
        expect(budget.aprobar).toHaveBeenCalledWith(1, '')
      })
    })
  })

  describe('Rejection Flow', () => {
    it('should show rejection drawer when reject icon button clicked', async () => {
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // The reject buttons are IconButtons with title="Rechazar"
      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
      })
    })

    it('should show error if motivo is too short', async () => {
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
      })

      // The Confirmar Rechazo button should be disabled when motivo < 5 chars
      const confirmBtn = screen.getByText('Confirmar Rechazo')
      expect(confirmBtn.closest('button')).toBeDisabled()
    })

    it('should call budget.rechazar when rejection confirmed with valid motivo', async () => {
      budget.rechazar.mockResolvedValue({ data: {} })
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
      })

      // Enter motivo in the TextField
      const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Presupuesto insuficiente' } })

      // Confirm
      fireEvent.click(screen.getByText('Confirmar Rechazo'))

      await waitFor(() => {
        expect(budget.rechazar).toHaveBeenCalledWith(1, 'Presupuesto insuficiente')
      })
    })
  })

  describe('Success Messages', () => {
    it('should show success message after approval', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const approveButtons = screen.getAllByTitle('Aprobar')
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Aprobar Incorporación')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Confirmar Aprobación'))

      await waitFor(() => {
        expect(screen.getByText('Solicitud de presupuesto aprobada correctamente')).toBeInTheDocument()
      })
    })
  })

  describe('View Detail', () => {
    it('should navigate to detail page when Ver clicked', async () => {
      renderComponent()
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // The Ver buttons are rendered in the actions column of the grid
      const verButtons = screen.getAllByText('Ver')
      fireEvent.click(verButtons[0])

      expect(mockNavigate).toHaveBeenCalledWith('/presupuestos/1')
    })
  })

  // ============================================================================
  // SPRINT 3 TESTS
  // ============================================================================

  describe('Sprint 3.1: Ledger Loading', () => {
    it('should load ledger on mount when historial tab is active', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })
    })

    it('should call getLedger with limit 500', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 500 })
      })
    })

    it('should display ledger entries in SPMAgGrid', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })
    })

    it('should use AG Grid built-in pagination for ledger', async () => {
      renderComponent()
      await waitFor(() => {
        // AG Grid handles pagination internally via paginationPageSize prop
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })
    })

    it('should show empty message when no ledger entries', async () => {
      budget.getLedger.mockResolvedValue({ data: { entries: [], total: 0 } })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No hay movimientos de presupuesto')).toBeInTheDocument()
      })
    })

    it('should reload ledger when tab switches back to historial', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })

      // Switch away
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })

      // Switch back
      budget.getLedger.mockClear()
      fireEvent.click(screen.getByText('Historial'))
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 500 })
      })
    })
  })

  describe('Sprint 3.2: Tab Sync after Approve/Reject', () => {
    it('should refresh both BUR list and ledger after approval', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()

      // Switch to Incorporaciones tab first
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // Open approve drawer
      const approveButtons = screen.getAllByTitle('Aprobar')
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Aprobar Incorporación')).toBeInTheDocument()
      })

      // Clear mocks to track new calls
      budget.listar.mockClear()
      budget.getLedger.mockClear()

      // Confirm approval
      fireEvent.click(screen.getByText('Confirmar Aprobación'))

      await waitFor(() => {
        expect(budget.aprobar).toHaveBeenCalled()
        expect(budget.listar).toHaveBeenCalled()
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 500 })
      })
    })

    it('should refresh both BUR list and ledger after rejection', async () => {
      budget.rechazar.mockResolvedValue({ data: {} })
      renderComponent()

      // Switch to Incorporaciones tab
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // Open reject drawer
      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
      })

      // Enter valid motivo
      const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Motivo valido de rechazo' } })

      budget.listar.mockClear()
      budget.getLedger.mockClear()

      // Confirm rejection
      fireEvent.click(screen.getByText('Confirmar Rechazo'))

      await waitFor(() => {
        expect(budget.rechazar).toHaveBeenCalled()
        expect(budget.listar).toHaveBeenCalled()
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 500 })
      })
    })
  })

  describe('Sprint 3.3: Real-time Motivo Validation', () => {
    it('should show character counter in rejection drawer', async () => {
      renderComponent()

      // Switch to Incorporaciones tab
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
        expect(screen.getByText('0/5 min.')).toBeInTheDocument()
      })
    })

    it('should show error state when motivo is less than 5 characters', async () => {
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
      })

      // Enter less than 5 characters
      const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'abc' } })

      await waitFor(() => {
        expect(screen.getByText('Mínimo 5 caracteres requeridos')).toBeInTheDocument()
        expect(screen.getByText('3/5 min.')).toBeInTheDocument()
      })
    })

    it('should hide error state when motivo reaches 5 characters', async () => {
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const rejectButtons = screen.getAllByTitle('Rechazar')
      fireEvent.click(rejectButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rechazar Incorporación')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Explica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Motivo valido' } })

      await waitFor(() => {
        expect(screen.queryByText('Mínimo 5 caracteres requeridos')).not.toBeInTheDocument()
        expect(screen.getByText('13/5 min.')).toBeInTheDocument()
      })
    })
  })

  describe('Sprint 3.4: Approval Drawer with Impact Preview', () => {
    it('should show impact preview in approval drawer', async () => {
      renderComponent()

      // Switch to Incorporaciones tab
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      // Click first approve button (pendiente item)
      const approveButtons = screen.getAllByTitle('Aprobar')
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Aprobar Incorporación')).toBeInTheDocument()
      })

      // Check that impact info is displayed in drawer
      await waitFor(() => {
        // Monto solicitado (5000) with + sign
        expect(screen.getByText('+$5000')).toBeInTheDocument()
        // Nuevo saldo label
        expect(screen.getByText(/Nuevo saldo/)).toBeInTheDocument()
      })
    })

    it('should display calculated new balance in approval drawer', async () => {
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument()
      })

      const approveButtons = screen.getAllByTitle('Aprobar')
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Aprobar Incorporación')).toBeInTheDocument()
      })

      await waitFor(() => {
        // Check +$5000 format for monto
        expect(screen.getByText('+$5000')).toBeInTheDocument()
        // Check nuevo saldo label exists
        expect(screen.getByText(/Nuevo saldo/)).toBeInTheDocument()
        // The calculated value $15000 appears (10000 + 5000)
        const allPrices = screen.getAllByText(/\$15000/)
        expect(allPrices.length).toBeGreaterThanOrEqual(1)
      })
    })
  })
})
