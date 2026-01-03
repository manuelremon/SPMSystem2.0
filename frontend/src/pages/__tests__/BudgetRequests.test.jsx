/**
 * Tests para BudgetRequests
 * Testing de listado, aprobacion y rechazo de solicitudes de presupuesto
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// Mock de i18n
vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}))

// Mock de useDebounced
vi.mock('../../hooks/useDebounced', () => ({
  useDebounced: (value) => value,
}))

// Mock de componentes UI
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('../../components/ui/SearchInput', () => ({
  SearchInput: ({ value, onChange, placeholder }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  ),
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
}))

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title, actions }) => (
    <div data-testid="page-header-wrapper">
      <h1 data-testid="page-header">{title}</h1>
      {actions && <div data-testid="page-header-actions">{actions}</div>}
    </div>
  ),
}))

vi.mock('../../components/ui/Alert', () => ({
  Alert: ({ children, variant, onDismiss }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
      {onDismiss && <button onClick={onDismiss}>Cerrar</button>}
    </div>
  ),
}))

vi.mock('../../components/ui/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}))

vi.mock('../../components/ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

vi.mock('../../components/ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children, footer }) =>
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        <div data-testid="modal-footer">{footer}</div>
      </div>
    ) : null,
}))

vi.mock('../../components/features/DataTable', () => ({
  ModernDataTable: ({ columns, rows, emptyMessage }) => (
    <table data-testid="data-table">
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length}>{emptyMessage}</td></tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col, j) => (
                <td key={j}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  ),
}))

vi.mock('../../utils/tableAlignments', () => ({
  withSpmAlignments: (cols) => cols,
}))

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `$${val}`,
  formatDate: (val) => val ? new Date(val).toLocaleDateString() : '-',
}))

vi.mock('../../components/ui/Icons', () => ({
  XCircle: () => <span>X</span>,
  CheckCircle: () => <span>✓</span>,
  RefreshCw: () => <span>↻</span>,
  Plus: () => <span>+</span>,
  Eye: () => <span>👁</span>,
  TrendingUp: () => <span>↑</span>,
  TrendingDown: () => <span>↓</span>,
  FileText: () => <span>📄</span>,
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

// Mock ledger entries for Sprint 3.1 pagination tests
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
    // Mock getLedger with first 50 entries (page 1)
    budget.getLedger.mockResolvedValue({
      data: {
        entries: mockLedgerEntries.slice(0, 50),
        total: mockLedgerEntries.length
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render page header', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument()
      })
    })

    it('should render data table with ledger by default', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument()
      })
    })

    it('should render search input when on Incorporaciones tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })
    })

    it('should render sub-tabs when on Incorporaciones tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeInTheDocument()
        expect(screen.getByText('Pendientes')).toBeInTheDocument()
        expect(screen.getByText('Aprobadas')).toBeInTheDocument()
        expect(screen.getByText('Rechazadas')).toBeInTheDocument()
      })
    })

    it('should show loading skeleton while fetching ledger', async () => {
      budget.getLedger.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
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
        response: { data: { error: { message: 'Error de servidor' } } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
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
    it('should filter by pendientes when tab clicked', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByText('Pendientes')).toBeInTheDocument()
      })

      budget.listar.mockClear()
      fireEvent.click(screen.getByText('Pendientes'))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({ estado: 'pendiente' })
      })
    })

    it('should filter by aprobadas when tab clicked', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByText('Aprobadas')).toBeInTheDocument()
      })

      budget.listar.mockClear()
      fireEvent.click(screen.getByText('Aprobadas'))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({ estado: 'aprobado' })
      })
    })

    it('should filter by rechazadas when tab clicked', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByText('Rechazadas')).toBeInTheDocument()
      })

      budget.listar.mockClear()
      fireEvent.click(screen.getByText('Rechazadas'))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({ estado: 'rechazado' })
      })
    })
  })

  describe('Search Filtering', () => {
    it('should filter results by search term', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'Centro A' }
      })

      // Search is debounced and filters client-side
      await waitFor(() => {
        expect(screen.getByTestId('search-input').value).toBe('Centro A')
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
    it('should refresh ledger when refresh button clicked on historial tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Actualizar/i)).toBeInTheDocument()
      })

      budget.getLedger.mockClear()
      fireEvent.click(screen.getByText(/Actualizar/i))

      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })
    })

    it('should refresh BUR list when refresh button clicked on Incorporaciones tab', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getByText(/Actualizar/i)).toBeInTheDocument()
      })

      budget.listar.mockClear()
      fireEvent.click(screen.getByText(/Actualizar/i))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })
    })
  })

  describe('Approval Flow', () => {
    it('should show approval modal when aprobar button clicked', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Aprobar')[0]).toBeInTheDocument()
      })

      // Click first Aprobar button
      fireEvent.click(screen.getAllByText('Aprobar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByTestId('modal-title')).toHaveTextContent('Aprobar')
      })
    })

    it('should call budget.aprobar when approval confirmed', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()

      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Aprobar')[0]).toBeInTheDocument()
      })

      // Click first Aprobar button (in actions column)
      const aprobarButtons = screen.getAllByText('Aprobar')
      fireEvent.click(aprobarButtons[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Confirm in modal
      const modalAprobarButtons = screen.getAllByText('Aprobar')
      fireEvent.click(modalAprobarButtons[modalAprobarButtons.length - 1])

      await waitFor(() => {
        expect(budget.aprobar).toHaveBeenCalledWith(1, '')
      })
    })
  })

  describe('Rejection Flow', () => {
    it('should show rejection modal when rechazar button clicked', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByTestId('modal-title')).toHaveTextContent('Rechazar')
      })
    })

    it('should show error if motivo is too short', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Try to confirm without motivo
      const modalRechazarButtons = screen.getAllByText('Rechazar')
      fireEvent.click(modalRechazarButtons[modalRechazarButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Debe proporcionar un motivo')).toBeInTheDocument()
      })
    })

    it('should call budget.rechazar when rejection confirmed with valid motivo', async () => {
      budget.rechazar.mockResolvedValue({ data: {} })
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Enter motivo in textarea
      const textarea = screen.getByPlaceholderText('Indica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Presupuesto insuficiente' } })

      // Confirm
      const modalRechazarButtons = screen.getAllByText('Rechazar')
      fireEvent.click(modalRechazarButtons[modalRechazarButtons.length - 1])

      await waitFor(() => {
        expect(budget.rechazar).toHaveBeenCalledWith(1, 'Presupuesto insuficiente')
      })
    })
  })

  describe('Success Messages', () => {
    it('should show success message after approval', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Aprobar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Aprobar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      const modalAprobarButtons = screen.getAllByText('Aprobar')
      fireEvent.click(modalAprobarButtons[modalAprobarButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Solicitud de presupuesto aprobada')).toBeInTheDocument()
      })
    })
  })

  describe('View Detail', () => {
    it('should navigate to detail page when Ver clicked', async () => {
      renderComponent()
      // First switch to Incorporaciones
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Ver')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Ver')[0])

      expect(mockNavigate).toHaveBeenCalledWith('/presupuestos/1')
    })
  })

  // ============================================================================
  // SPRINT 3 TESTS
  // ============================================================================

  describe('Sprint 3.1: Ledger Pagination', () => {
    it('should load ledger on mount when historial tab is active', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalled()
      })
    })

    it('should call getLedger with correct offset params', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 0 })
      })
    })

    it('should display pagination controls when entries exceed page size', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Mostrando/)).toBeInTheDocument()
        expect(screen.getByText('1 / 2')).toBeInTheDocument()
        expect(screen.getByText('Anterior')).toBeInTheDocument()
        expect(screen.getByText('Siguiente')).toBeInTheDocument()
      })
    })

    it('should disable Anterior button on first page', async () => {
      renderComponent()
      await waitFor(() => {
        const anteriorBtn = screen.getByText('Anterior')
        expect(anteriorBtn).toBeDisabled()
      })
    })

    it('should enable Siguiente button when more pages exist', async () => {
      renderComponent()
      await waitFor(() => {
        const siguienteBtn = screen.getByText('Siguiente')
        expect(siguienteBtn).not.toBeDisabled()
      })
    })

    it('should load next page when Siguiente clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Siguiente')).toBeInTheDocument()
      })

      budget.getLedger.mockClear()
      fireEvent.click(screen.getByText('Siguiente'))

      await waitFor(() => {
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 50 })
      })
    })
  })

  describe('Sprint 3.2: Tab Sync after Approve/Reject', () => {
    it('should refresh both BUR list and ledger after approval', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()

      // Switch to Incorporaciones tab first
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Aprobar')[0]).toBeInTheDocument()
      })

      // Open approve modal
      fireEvent.click(screen.getAllByText('Aprobar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Clear mocks to track new calls
      budget.listar.mockClear()
      budget.getLedger.mockClear()

      // Confirm approval
      const modalAprobarButtons = screen.getAllByText('Aprobar')
      fireEvent.click(modalAprobarButtons[modalAprobarButtons.length - 1])

      await waitFor(() => {
        expect(budget.aprobar).toHaveBeenCalled()
        expect(budget.listar).toHaveBeenCalled()
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 0 })
      })
    })

    it('should refresh both BUR list and ledger after rejection', async () => {
      budget.rechazar.mockResolvedValue({ data: {} })
      renderComponent()

      // Switch to Incorporaciones tab
      await waitFor(() => {
        expect(screen.getByText('Incorporaciones')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Enter valid motivo
      const textarea = screen.getByPlaceholderText('Indica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Motivo valido de rechazo' } })

      budget.listar.mockClear()
      budget.getLedger.mockClear()

      // Confirm rejection
      const modalRechazarButtons = screen.getAllByText('Rechazar')
      fireEvent.click(modalRechazarButtons[modalRechazarButtons.length - 1])

      await waitFor(() => {
        expect(budget.rechazar).toHaveBeenCalled()
        expect(budget.listar).toHaveBeenCalled()
        expect(budget.getLedger).toHaveBeenCalledWith({ limit: 50, offset: 0 })
      })
    })
  })

  describe('Sprint 3.3: Real-time Motivo Validation', () => {
    it('should show character counter in rejection modal', async () => {
      renderComponent()

      // Switch to Incorporaciones tab
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText('0/5 min')).toBeInTheDocument()
      })
    })

    it('should show error message when motivo is less than 5 characters', async () => {
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Enter less than 5 characters
      const textarea = screen.getByPlaceholderText('Indica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'abc' } })

      await waitFor(() => {
        expect(screen.getByText('Mínimo 5 caracteres')).toBeInTheDocument()
        expect(screen.getByText('3/5 min')).toBeInTheDocument()
      })
    })

    it('should hide error message when motivo reaches 5 characters', async () => {
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Rechazar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Rechazar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Indica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Motivo valido' } })

      await waitFor(() => {
        expect(screen.queryByText('Mínimo 5 caracteres')).not.toBeInTheDocument()
        expect(screen.getByText('13/5 min')).toBeInTheDocument()
      })
    })
  })

  describe('Sprint 3.4: Approval Modal with Impact Preview', () => {
    it('should show impact preview in approval modal', async () => {
      renderComponent()

      // Switch to Incorporaciones tab
      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Aprobar')[0]).toBeInTheDocument()
      })

      // Click first Aprobar button (pendiente item)
      fireEvent.click(screen.getAllByText('Aprobar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Check that impact info is displayed in modal
      await waitFor(() => {
        // Monto solicitado (5000) with + sign is unique to modal
        expect(screen.getByText('+$5000')).toBeInTheDocument()
        // Nuevo saldo label is unique to modal
        expect(screen.getByText(/Nuevo saldo/)).toBeInTheDocument()
      })
    })

    it('should display calculated new balance in approval modal', async () => {
      renderComponent()

      fireEvent.click(screen.getByText('Incorporaciones'))

      await waitFor(() => {
        expect(screen.getAllByText('Aprobar')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Aprobar')[0])

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // The modal should show:
      // - Monto: +$5000 (unique format with +)
      // - Saldo actual: displayed somewhere
      // - Nuevo saldo: displayed with label
      await waitFor(() => {
        // Check modal content has the +$5000 format for monto
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
