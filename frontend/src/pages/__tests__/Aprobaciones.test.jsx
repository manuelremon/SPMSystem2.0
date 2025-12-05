/**
 * Tests para Aprobaciones
 * Testing de flujo de aprobación/rechazo de solicitudes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Aprobaciones from '../Aprobaciones'
import api from '../../services/api'

// Mock de servicios
vi.mock('../../services/api')

// Mock de react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock de auth store
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 1, nombre: 'Test Aprobador', rol: 'Coordinador' },
  }),
}))

// Mock de i18n context
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
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h2>{children}</h2>,
  CardDescription: ({ children }) => <p>{children}</p>,
  CardContent: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }) => <h1 data-testid="page-header">{title}</h1>,
}))

vi.mock('../../components/ui/DataTable', () => ({
  DataTable: ({ data, columns, onRowClick }) => (
    <table data-testid="data-table">
      <thead>
        <tr>
          {columns?.map((col, i) => (
            <th key={i}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data?.map((row, i) => (
          <tr key={i} onClick={() => onRowClick && onRowClick(row)} data-testid={"row-" + row.id}>
            {columns?.map((col, j) => (
              <td key={j}>{col.accessor ? row[col.accessor] : ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

vi.mock('../../components/ui/StatusBadge', () => ({
  StatusBadge: ({ status }) => <span data-testid="status-badge">{status}</span>,
}))

vi.mock('../../components/ui/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}))

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Aprobaciones', () => {
  const mockSolicitudesPendientes = [
    {
      id: 1,
      asunto: 'Solicitud de materiales',
      solicitante_nombre: 'Juan Pérez',
      created_at: '2024-01-15T10:00:00Z',
      criticidad: 'Normal',
      estado: 'submitted',
      centro: '1001',
      items_count: 5,
    },
    {
      id: 2,
      asunto: 'Solicitud urgente',
      solicitante_nombre: 'María García',
      created_at: '2024-01-16T14:30:00Z',
      criticidad: 'Alta',
      estado: 'submitted',
      centro: '1002',
      items_count: 3,
    },
  ]

  beforeEach(() => {
    api.get = vi.fn((url) => {
      if (url.includes('/solicitudes')) {
        return Promise.resolve({ data: { solicitudes: mockSolicitudesPendientes } })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
    api.post = vi.fn(() => Promise.resolve({ data: { ok: true } }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('debe renderizar el componente', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument()
      })
    })

    it('debe mostrar skeleton mientras carga', () => {
      renderWithRouter(<Aprobaciones />)
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('debe cargar solicitudes pendientes al montar', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(api.get).toHaveBeenCalled()
      })
    })

    it('debe mostrar tabla con solicitudes', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument()
      })
    })
  })

  describe('Lista de solicitudes', () => {
    it('debe mostrar todas las solicitudes pendientes', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('row-1')).toBeInTheDocument()
        expect(screen.getByTestId('row-2')).toBeInTheDocument()
      })
    })
  })

  describe('Interacción con solicitudes', () => {
    it('debe navegar al detalle al hacer clic', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('row-1')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('row-1'))
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/1')
      })
    })
  })

  describe('Estado vacío', () => {
    it('debe mostrar mensaje cuando no hay solicitudes', async () => {
      api.get = vi.fn(() => Promise.resolve({ data: { solicitudes: [] } }))
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByText(/no hay/i)).toBeInTheDocument()
      })
    })
  })

  describe('Manejo de errores', () => {
    it('debe mostrar error cuando falla la carga', async () => {
      api.get = vi.fn(() => Promise.reject(new Error('Network error')))
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
      })
    })
  })
})
