/**
 * Tests para SolicitudDetalle
 * Testing de visualización de detalle de solicitud
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import SolicitudDetalle from '../SolicitudDetalle'
import { solicitudes } from '../../services/spm'

// Mock de react-router-dom useParams
const mockId = '123'
const mockNavigate = vi.fn()
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
  solicitudes: {
    obtener: vi.fn(),
  },
}))

// Mock de i18n
vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}))

// Mock de componentes UI
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, variant }) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h3 data-testid="card-title">{children}</h3>,
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
  Alert: ({ children, variant }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
}))

vi.mock('../../components/ui/Badge', () => ({
  Badge: ({ children, variant }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('../../components/ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

vi.mock('../../components/ui/ScrollReveal', () => ({
  ScrollReveal: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `$${val || 0}`,
  formatDate: (val) => val || '-',
  getSectorNombre: (val) => val || '-',
  formatAlmacen: (val) => val || '-',
}))

vi.mock('../../components/ui/Icons', () => ({
  ArrowLeft: () => <span>←</span>,
  Calendar: () => <span>📅</span>,
  Building2: () => <span>🏢</span>,
  MapPin: () => <span>📍</span>,
  FileText: () => <span>📄</span>,
  Package: () => <span>📦</span>,
  DollarSign: () => <span>$</span>,
  AlertTriangle: () => <span>⚠</span>,
  Clock: () => <span>⏰</span>,
  User: () => <span>👤</span>,
  Hash: () => <span>#</span>,
  ICON_COLORS: { money: 'text-blue-500', logistics: 'text-amber-500' },
}))

// Datos de prueba
const mockSolicitud = {
  id: 123,
  id_usuario: 'user001',
  centro: 'Centro A',
  sector: 'Sector 1',
  almacen_virtual: 'ALM001',
  centro_costos: 'CC-123',
  estado: 'pendiente',
  criticidad: 'Normal',
  justificacion: 'Materiales para proyecto X',
  total_monto: 15000,
  created_at: '2025-01-01T10:00:00Z',
  fecha_necesidad: '2025-02-01',
  items: [
    {
      codigo: 'MAT001',
      descripcion: 'Material de prueba',
      cantidad: 10,
      precio_unitario: 1500,
      unidad: 'UN',
    },
  ],
}

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <SolicitudDetalle />
    </BrowserRouter>
  )
}

describe('SolicitudDetalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    solicitudes.obtener.mockResolvedValue({ data: { solicitud: mockSolicitud } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      solicitudes.obtener.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Cargando solicitud...')).toBeInTheDocument()
    })

    it('should show back button during loading', () => {
      solicitudes.obtener.mockImplementation(() => new Promise(() => {}))
      renderComponent()
      expect(screen.getByText('Volver')).toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('should render page header with solicitud ID', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toHaveTextContent('#123')
      })
    })

    it('should display status badge', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('status-badge')).toHaveTextContent('pendiente')
      })
    })

    it('should display centro', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Centro A')).toBeInTheDocument()
      })
    })

    it('should display sector', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Sector 1')).toBeInTheDocument()
      })
    })

    it('should display justification', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Materiales para proyecto X')).toBeInTheDocument()
      })
    })

    it('should display total amount', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getAllByText('$15000').length).toBeGreaterThan(0)
      })
    })

    it('should display solicitante', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('user001')).toBeInTheDocument()
      })
    })
  })

  describe('Items Table', () => {
    it('should display materials count', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/Materiales.*\(1\)/)).toBeInTheDocument()
      })
    })

    it('should display item codigo', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('MAT001')).toBeInTheDocument()
      })
    })

    it('should display item descripcion', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Material de prueba')).toBeInTheDocument()
      })
    })

    it('should display item cantidad', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText(/10.*UN/)).toBeInTheDocument()
      })
    })

    it('should show empty state when no items', async () => {
      solicitudes.obtener.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, items: [] } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No hay materiales en esta solicitud')).toBeInTheDocument()
      })
    })
  })

  describe('Criticidad Display', () => {
    it('should display normal criticidad with default badge', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('badge')).toHaveTextContent('Normal')
      })
    })

    it('should display alta criticidad with danger badge', async () => {
      solicitudes.obtener.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, criticidad: 'Alta' } }
      })
      renderComponent()
      await waitFor(() => {
        const badge = screen.getByTestId('badge')
        expect(badge).toHaveTextContent('Alta')
        expect(badge).toHaveAttribute('data-variant', 'danger')
      })
    })
  })

  describe('Not Found', () => {
    it('should show not found when API returns no data', async () => {
      solicitudes.obtener.mockResolvedValue({ data: null })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('No se encontró la solicitud')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      solicitudes.obtener.mockRejectedValue({
        response: { data: { error: { message: 'Error de servidor' } } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText('Error de servidor')).toBeInTheDocument()
      })
    })

    it('should show generic error when no message provided', async () => {
      solicitudes.obtener.mockRejectedValue(new Error('Network Error'))
      renderComponent()
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
      })
    })
  })

  describe('Estado Borrador Actions', () => {
    it('should show edit button when estado is borrador', async () => {
      solicitudes.obtener.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, estado: 'borrador' } }
      })
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Editar Solicitud')).toBeInTheDocument()
      })
    })

    it('should NOT show edit button when estado is pendiente', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.queryByText('Editar Solicitud')).not.toBeInTheDocument()
      })
    })
  })

  describe('Cards Structure', () => {
    it('should render information cards', async () => {
      renderComponent()
      await waitFor(() => {
        const cards = screen.getAllByTestId('card')
        expect(cards.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('should render card titles', async () => {
      renderComponent()
      await waitFor(() => {
        expect(screen.getByText('Información General')).toBeInTheDocument()
        expect(screen.getByText('Ubicación y Costos')).toBeInTheDocument()
        expect(screen.getByText('Justificación')).toBeInTheDocument()
      })
    })
  })
})
