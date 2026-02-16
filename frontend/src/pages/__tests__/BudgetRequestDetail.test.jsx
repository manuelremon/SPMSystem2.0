/**
 * Tests para BudgetRequestDetail
 * Testing de visualizacion, aprobacion y rechazo de solicitud individual
 *
 * Component uses Material-UI (not custom UI components)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import BudgetRequestDetail from '../BudgetRequestDetail'
import { budget } from '../../services/spm'
import { useAuthStore } from '../../store/authStore'

// Mock de react-router-dom useParams
const mockNavigate = vi.fn()
const mockId = '1'
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: mockId }),
    useNavigate: () => mockNavigate,
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

// Stable t function reference for i18n mock
const mockT = (key, fallback) => fallback || key

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: mockT,
  }),
}))

// Mock formatCurrency - the component imports and uses it
vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `$${val}`,
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
      // MUI CircularProgress renders with role="progressbar"
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('should render page header with BUR ID', async () => {
      renderComponent()
      await waitFor(() => {
        // Component renders "SOLICITUD #1" in an h5 Typography
        expect(screen.getByText('SOLICITUD #1')).toBeInTheDocument()
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
        // MUI Chip renders the estado label text
        expect(screen.getByText('Pendiente')).toBeInTheDocument()
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
        expect(screen.getByRole('button', { name: /Aprobar/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Rechazar/i })).toBeInTheDocument()
      })
    })

    it('should show approve and reject buttons for aprobado_l1 state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'aprobado_l1' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Aprobar/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Rechazar/i })).toBeInTheDocument()
      })
    })

    it('should show approve and reject buttons for aprobado_l2 state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'aprobado_l2' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Aprobar/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Rechazar/i })).toBeInTheDocument()
      })
    })

    it('should NOT show approve/reject buttons for fully approved state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'aprobado' } }
      })
      renderComponent()
      await waitFor(() => {
        // The "Aprobada" chip should appear
        expect(screen.getByText('Aprobada')).toBeInTheDocument()
      })
      // No Aprobar/Rechazar buttons should be present
      expect(screen.queryByRole('button', { name: /Aprobar/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Rechazar/i })).not.toBeInTheDocument()
    })

    it('should NOT show approve/reject buttons for rejected state', async () => {
      budget.obtener.mockResolvedValue({
        data: { request: { ...mockBUR, estado: 'rechazado', motivo_rechazo: 'Sin fondos' } }
      })
      renderComponent()
      await waitFor(() => {
        // "Rechazada" appears in both the status Chip and the timeline
        const matches = screen.getAllByText('Rechazada')
        expect(matches.length).toBeGreaterThanOrEqual(1)
      })
      // No Aprobar/Rechazar buttons should be present
      expect(screen.queryByRole('button', { name: /^Aprobar$/i })).not.toBeInTheDocument()
      // "Rechazar" button should not exist (only "Rechazada" text in chip)
      expect(screen.queryByRole('button', { name: /^Rechazar$/i })).not.toBeInTheDocument()
    })
  })

  describe('Approval Flow', () => {
    it('should open approve modal when Aprobar clicked', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Aprobar/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Aprobar/i }))

      await waitFor(() => {
        // MUI Modal opens with the title "Aprobar #1"
        expect(screen.getByText('Aprobar #1')).toBeInTheDocument()
      })
    })

    it('should call budget.aprobar when confirmed', async () => {
      budget.aprobar.mockResolvedValue({ data: {} })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Aprobar/i })).toBeInTheDocument()
      })

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: /Aprobar/i }))

      await waitFor(() => {
        expect(screen.getByText('Aprobar #1')).toBeInTheDocument()
      })

      // Confirm in modal - find all Aprobar buttons and click the last one (inside modal)
      const aprobarButtons = screen.getAllByRole('button', { name: /Aprobar/i })
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
        expect(screen.getByRole('button', { name: /Rechazar/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Rechazar/i }))

      await waitFor(() => {
        // MUI Modal opens with the title "Rechazar #1"
        expect(screen.getByText('Rechazar #1')).toBeInTheDocument()
      })
    })

    it('should show error if motivo is too short', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Rechazar/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Rechazar/i }))

      await waitFor(() => {
        expect(screen.getByText('Rechazar #1')).toBeInTheDocument()
      })

      // Try to confirm without motivo - find the confirm Rechazar button in modal
      const rechazarButtons = screen.getAllByRole('button', { name: /Rechazar/i })
      fireEvent.click(rechazarButtons[rechazarButtons.length - 1])

      // The error message is rendered in an MUI Alert (role="alert") outside the modal
      await waitFor(() => {
        expect(screen.getByText('Debe proporcionar un motivo')).toBeInTheDocument()
      })
    })

    it('should call budget.rechazar with valid motivo', async () => {
      budget.rechazar.mockResolvedValue({ data: {} })
      renderComponent()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Rechazar/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Rechazar/i }))

      await waitFor(() => {
        expect(screen.getByText('Rechazar #1')).toBeInTheDocument()
      })

      // Enter motivo - MUI TextField renders a textarea with the placeholder
      const textarea = screen.getByPlaceholderText('Indica el motivo del rechazo...')
      fireEvent.change(textarea, { target: { value: 'Presupuesto insuficiente' } })

      // Confirm
      const rechazarButtons = screen.getAllByRole('button', { name: /Rechazar/i })
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
        // MUI Alert with role="alert" contains the not found message
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

      // When API fails, bur is null so the not-found view shows with role="alert"
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
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
