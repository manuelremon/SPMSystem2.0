/**
 * Tests para BudgetRequestDetail
 * Testing de visualizacion, aprobacion y rechazo de solicitud individual
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import BudgetRequestDetail from '../BudgetRequestDetail'
import { budget } from '../../services/spm'
import { useAuthStore } from '../../store/authStore'

// Mock de react-router-dom useParams
const mockId = '1'
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: mockId }),
    useNavigate: () => vi.fn(),
  }
})

// Mock de servicios
vi.mock('../../services/spm', () => ({
  budget: {
    obtener: vi.fn(),
    getInfo: vi.fn(),
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

// Mock de componentes UI
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h3 data-testid="card-title">{children}</h3>,
  CardDescription: ({ children }) => <p data-testid="card-description">{children}</p>,
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

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `$${val}`,
}))

vi.mock('../../components/ui/Icons', () => ({
  ArrowLeft: () => <span>←</span>,
  CheckCircle: () => <span>✓</span>,
  XCircle: () => <span>X</span>,
  DollarSign: () => <span>$</span>,
  Building: () => <span>🏢</span>,
  MapPin: () => <span>📍</span>,
  User: () => <span>👤</span>,
  Calendar: () => <span>📅</span>,
  FileText: () => <span>📄</span>,
  Shield: () => <span>🛡</span>,
}))

// Datos de prueba
const mockBUR = {
  id: 1,
  centro: 'Centro A',
  sector: 'Sector 1',
  monto_solicitado_usd: 5000,
  nivel_aprobacion_requerido: 'L1',
  estado: 'pendiente',
  justificacion: 'Materiales urgentes para proyecto X',
  solicitante_id: 'user123',
  solicitante_rol: 'coordinador',
  created_at: '2025-01-01T10:00:00Z',
  updated_at: '2025-01-01T10:00:00Z',
}

const mockPresupuesto = {
  centro: 'Centro A',
  sector: 'Sector 1',
  monto_usd: 100000,
  saldo_usd: 50000,
}

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <BudgetRequestDetail />
    </BrowserRouter>
  )
}

describe('BudgetRequestDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    budget.obtener.mockResolvedValue({ data: { request: mockBUR } })
    budget.getInfo.mockResolvedValue({ data: { presupuesto: mockPresupuesto } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      budget.obtener.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Cargando...')).toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('should render page header with BUR ID', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toHaveTextContent('#1')
      })
    })

    it('should display BUR details', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Centro A')).toBeInTheDocument()
        expect(screen.getByText('Sector 1')).toBeInTheDocument()
        expect(screen.getByText('$5000')).toBeInTheDocument()
      })
    })

    it('should display status badge', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('status-badge')).toHaveTextContent('Pendiente')
      })
    })

    it('should display justification', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Materiales urgentes para proyecto X')).toBeInTheDocument()
      })
    })

    it('should display solicitante info', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('user123')).toBeInTheDocument()
      })
    })
  })

  describe('Budget Impact', () => {
    it('should display current budget balance', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('$50000')).toBeInTheDocument()
      })
    })

    it('should display new balance calculation', async () => {
      renderComponent()
      await waitFor(() => {
        // 50000 + 5000 = 55000
        expect(screen.getByText('$55000')).toBeInTheDocument()
      })
    })
  })

  describe('Approve/Reject Buttons', () => {
    it('should show approve and reject buttons for pending state', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Aprobar')).toBeInTheDocument()
        expect(screen.getByText('Rechazar')).toBeInTheDocument()
      })
    })

    it('should show approve and reject buttons for aprobado_l1 state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'aprobado_l1' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Aprobar')).toBeInTheDocument()
        expect(screen.getByText('Rechazar')).toBeInTheDocument()
      })
    })

    it('should show approve and reject buttons for aprobado_l2 state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'aprobado_l2' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Aprobar')).toBeInTheDocument()
        expect(screen.getByText('Rechazar')).toBeInTheDocument()
      })
    })

    it('should NOT show approve/reject buttons for fully approved state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'aprobado' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('status-badge')).toHaveTextContent('Aprobada')
      })
      // Only "Volver" button should be in actions
      const actions = screen.getByTestId('page-header-actions')
      expect(actions.querySelectorAll('button').length).toBe(1)
    })

    it('should NOT show approve/reject buttons for rejected state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'rechazado', motivo_rechazo: 'Sin fondos' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('status-badge')).toHaveTextContent('Rechazada')
      })
      const actions = screen.getByTestId('page-header-actions')
      expect(actions.querySelectorAll('button').length).toBe(1)
    })
  })

  describe('Approval Flow', () => {
    it('should open approve modal when Aprobar clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Aprobar')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Aprobar'))

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByTestId('modal-title')).toHaveTextContent('Aprobar')
      })
    })

    it('should call budget.aprobar when confirmed', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Aprobar')).toBeInTheDocument()
      })

      // Open modal
      fireEvent.click(screen.getByText('Aprobar'))

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Confirm in modal (find the second Aprobar button)
      const aprobarButtons = screen.getAllByText('Aprobar')
      fireEvent.click(aprobarButtons[aprobarButtons.length - 1])

      await waitFor(() => {
        expect(budget.aprobar).toHaveBeenCalledWith('1', '')
      })
    })
  })

  describe('Rejection Flow', () => {
    it('should open reject modal when Rechazar clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Rechazar')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Rechazar'))

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByTestId('modal-title')).toHaveTextContent('Rechazar')
      })
    })

    it('should show error if motivo is too short', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Rechazar')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Rechazar'))

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Try to confirm without motivo
      const rechazarButtons = screen.getAllByText('Rechazar')
      fireEvent.click(rechazarButtons[rechazarButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Debe proporcionar un motivo')).toBeInTheDocument()
      })
    })

    it('should call budget.rechazar with valid motivo', async () => {
      budget.rechazar.mockResolvedValue({ data: {} })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Rechazar')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Rechazar'))

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })

      // Enter motivo
      const textarea = screen.getByPlaceholderText('Indica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Presupuesto insuficiente' } })

      // Confirm
      const rechazarButtons = screen.getAllByText('Rechazar')
      fireEvent.click(rechazarButtons[rechazarButtons.length - 1])

      await waitFor(() => {
        expect(budget.rechazar).toHaveBeenCalledWith('1', 'Presupuesto insuficiente')
      })
    })
  })

  describe('Not Found', () => {
    it('should show not found message when BUR does not exist', async () => {
      budget.obtener.mockResolvedValue({ data: { request: null } })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Solicitud no encontrada')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display not found when API fails', async () => {
      budget.obtener.mockRejectedValue({
        response: { data: { error: { message: 'Error de servidor' } } }
      })
      renderComponent()

      // When API fails, component shows "not found" with error alert
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
      })
    })
  })

  describe('Rejected State Display', () => {
    it('should display rejection reason when rejected', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'rechazado', motivo_rechazo: 'Sin fondos disponibles' } }
      })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Sin fondos disponibles')).toBeInTheDocument()
      })
    })
  })

  describe('Timeline/History', () => {
    it('should display creation date in timeline', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Creada')).toBeInTheDocument()
      })
    })
  })
})
