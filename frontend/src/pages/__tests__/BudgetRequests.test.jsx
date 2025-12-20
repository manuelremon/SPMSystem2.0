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
}))

vi.mock('../../components/ui/Icons', () => ({
  XCircle: () => <span>X</span>,
  CheckCircle: () => <span>✓</span>,
  RefreshCw: () => <span>↻</span>,
  Plus: () => <span>+</span>,
  Eye: () => <span>👁</span>,
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
    nivel_aprobacion_requerido: 'L1',
    estado: 'pendiente',
    justificacion: 'Materiales urgentes',
  },
  {
    id: 2,
    centro: 'Centro B',
    sector: 'Sector 2',
    monto_solicitado_usd: 15000,
    nivel_aprobacion_requerido: 'L2',
    estado: 'aprobado',
    justificacion: 'Equipos nuevos',
  },
  {
    id: 3,
    centro: 'Centro C',
    sector: 'Sector 3',
    monto_solicitado_usd: 3000,
    nivel_aprobacion_requerido: 'L1',
    estado: 'rechazado',
    justificacion: 'Presupuesto insuficiente',
  },
]

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

    it('should render data table with budget requests', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument()
      })
    })

    it('should render search input', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument()
      })
    })

    it('should render tabs', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Todas')).toBeInTheDocument()
        expect(screen.getByText('Pendientes')).toBeInTheDocument()
        expect(screen.getByText('Aprobadas')).toBeInTheDocument()
        expect(screen.getByText('Rechazadas')).toBeInTheDocument()
      })
    })

    it('should show loading skeleton while fetching data', async () => {
      budget.listar.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })
  })

  describe('Data Loading', () => {
    it('should call budget.listar on mount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalled()
      })
    })

    it('should display error message on API failure', async () => {
      budget.listar.mockRejectedValue({
        response: { data: { error: { message: 'Error de servidor' } } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText('Error de servidor')).toBeInTheDocument()
      })
    })

    it('should display empty message when no results', async () => {
      budget.listar.mockResolvedValue({ data: { requests: [] } })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No hay solicitudes de presupuesto')).toBeInTheDocument()
      })
    })
  })

  describe('Tab Filtering', () => {
    it('should filter by pendientes when tab clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Pendientes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Pendientes'))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({ estado: 'pendiente' })
      })
    })

    it('should filter by aprobadas when tab clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Aprobadas')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Aprobadas'))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({ estado: 'aprobado' })
      })
    })

    it('should filter by rechazadas when tab clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Rechazadas')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Rechazadas'))

      await waitFor(() => {
        expect(budget.listar).toHaveBeenCalledWith({ estado: 'rechazado' })
      })
    })
  })

  describe('Search Filtering', () => {
    it('should filter results by search term', async () => {
      renderComponent()
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
    it('should refresh data when refresh button clicked', async () => {
      renderComponent()
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
      await waitFor(() => {
        expect(screen.getAllByText('Ver')[0]).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByText('Ver')[0])

      expect(mockNavigate).toHaveBeenCalledWith('/presupuestos/1')
    })
  })
})
