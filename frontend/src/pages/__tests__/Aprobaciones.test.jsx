/**
 * Tests para Aprobaciones
 * Testing de flujo de aprobacion/rechazo de solicitudes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Aprobaciones from '../Aprobaciones'
import api from '../../services/api'
import { solicitudes } from '../../services/spm'

// Mock de servicios
vi.mock('../../services/api')
vi.mock('../../services/spm', () => ({
  solicitudes: {
    listar: vi.fn(),
    aprobar: vi.fn(),
    rechazar: vi.fn(),
  },
}))

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

// Mock de i18n context - stable reference
const stableT = vi.fn((key, fallback) => fallback || key)
const stableI18n = { t: stableT, lang: 'es' }
vi.mock('../../context/i18n', () => ({
  useI18n: () => stableI18n,
}))

// Mock useDebounced to return value immediately
vi.mock('../../hooks/useDebounced', () => ({
  useDebounced: (val) => val,
  default: (val) => val,
}))

// Mock formatters
vi.mock('../../utils/formatters', () => ({
  formatDate: (val) => val || '-',
  formatCurrency: (val) => `$${val || 0}`,
  getSectorNombre: (id) => id || '-',
  formatAlmacen: (val) => val || '-',
}))

// Mock styleConfig
vi.mock('../../utils/styleConfig', () => ({
  getCriticidadConfig: (c) => ({ label: c || 'Normal', color: '#333', bg: '#eee' }),
}))

// Mock StatusBadge
vi.mock('../../components/ui/StatusBadge', () => ({
  __esModule: true,
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

// Mock SPMAgGrid - render rows as a simple table for testing
vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, loading, emptyMessage, onRowDoubleClick }) => {
    if (loading) {
      return <div data-testid="ag-grid-loading">Cargando...</div>
    }
    if (!rowData || rowData.length === 0) {
      return <div data-testid="ag-grid-empty">{emptyMessage}</div>
    }
    return (
      <div data-testid="ag-grid">
        <table>
          <tbody>
            {rowData.map((row) => (
              <tr
                key={row.id}
                data-testid={`row-${row.id}`}
                onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
              >
                <td>{row.id}</td>
                <td>{row.solicitante_nombre}</td>
                <td>{row.centro}</td>
                <td>{row.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
  default: ({ rowData, columnDefs, loading, emptyMessage, onRowDoubleClick }) => {
    if (loading) {
      return <div data-testid="ag-grid-loading">Cargando...</div>
    }
    if (!rowData || rowData.length === 0) {
      return <div data-testid="ag-grid-empty">{emptyMessage}</div>
    }
    return (
      <div data-testid="ag-grid">
        <table>
          <tbody>
            {rowData.map((row) => (
              <tr
                key={row.id}
                data-testid={`row-${row.id}`}
                onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
              >
                <td>{row.id}</td>
                <td>{row.solicitante_nombre}</td>
                <td>{row.centro}</td>
                <td>{row.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
}))

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Aprobaciones', () => {
  const mockSolicitudesPendientes = [
    {
      id: 1,
      asunto: 'Solicitud de materiales',
      solicitante_nombre: 'Juan Perez',
      created_at: '2024-01-15T10:00:00Z',
      criticidad: 'Normal',
      estado: 'submitted',
      centro: '1001',
      items: [{ codigo: 'MAT001', descripcion: 'Material 1', cantidad: 5, precio_unitario: 100 }],
    },
    {
      id: 2,
      asunto: 'Solicitud urgente',
      solicitante_nombre: 'Maria Garcia',
      created_at: '2024-01-16T14:30:00Z',
      criticidad: 'Alta',
      estado: 'submitted',
      centro: '1002',
      items: [{ codigo: 'MAT002', descripcion: 'Material 2', cantidad: 3, precio_unitario: 200 }],
    },
  ]

  const mockHistorial = [
    {
      id: 10,
      solicitante_nombre: 'Carlos Lopez',
      created_at: '2024-01-10T08:00:00Z',
      estado: 'approved',
      centro: '1001',
      items: [],
    },
    {
      id: 11,
      solicitante_nombre: 'Ana Diaz',
      created_at: '2024-01-11T09:00:00Z',
      estado: 'rejected',
      centro: '1002',
      items: [],
    },
  ]

  beforeEach(() => {
    // solicitudes.listar is called multiple times:
    // 1) for pending (estado: submitted)
    // 2) for historial approved
    // 3) for historial rejected
    solicitudes.listar.mockImplementation((params) => {
      if (params?.estado === 'submitted') {
        return Promise.resolve({ data: { solicitudes: mockSolicitudesPendientes } })
      }
      if (params?.estado === 'approved') {
        return Promise.resolve({ data: { solicitudes: [mockHistorial[0]] } })
      }
      if (params?.estado === 'rejected') {
        return Promise.resolve({ data: { solicitudes: [mockHistorial[1]] } })
      }
      return Promise.resolve({ data: { solicitudes: [] } })
    })

    solicitudes.aprobar.mockResolvedValue({ data: { ok: true } })
    solicitudes.rechazar.mockResolvedValue({ data: { ok: true } })

    // api.get is called for /catalogos/sectores
    api.get = vi.fn((url) => {
      if (url.includes('/catalogos/sectores')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: {} })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('debe renderizar el componente', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByText('Aprobaciones')).toBeInTheDocument()
      })
    })

    it('debe mostrar skeleton mientras carga', () => {
      // Make listar never resolve so loading stays true
      solicitudes.listar.mockImplementation(() => new Promise(() => {}))
      renderWithRouter(<Aprobaciones />)
      // The component sets loading=true before the fetch resolves,
      // so SPMAgGrid receives loading=true initially
      expect(screen.getByTestId('ag-grid-loading')).toBeInTheDocument()
    })

    it('debe cargar solicitudes pendientes al montar', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(solicitudes.listar).toHaveBeenCalled()
      })
    })

    it('debe mostrar tabla con solicitudes', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('ag-grid')).toBeInTheDocument()
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

  describe('Interaccion con solicitudes', () => {
    it('debe navegar al detalle al hacer clic', async () => {
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('row-1')).toBeInTheDocument()
      })
      // Component uses onRowDoubleClick to open detail modal, not navigate
      // Double-click opens the DetalleModal instead of navigating
      fireEvent.doubleClick(screen.getByTestId('row-1'))
      await waitFor(() => {
        // The modal should appear with "Solicitud #1" text
        expect(screen.getByText(/Solicitud #1/)).toBeInTheDocument()
      })
    })
  })

  describe('Estado vacio', () => {
    it('debe mostrar mensaje cuando no hay solicitudes', async () => {
      solicitudes.listar.mockImplementation(() =>
        Promise.resolve({ data: { solicitudes: [] } })
      )
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByTestId('ag-grid-empty')).toBeInTheDocument()
      })
    })
  })

  describe('Manejo de errores', () => {
    it('debe mostrar error cuando falla la carga', async () => {
      solicitudes.listar.mockImplementation((params) => {
        if (params?.estado === 'submitted') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ data: { solicitudes: [] } })
      })
      renderWithRouter(<Aprobaciones />)
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })
  })
})
