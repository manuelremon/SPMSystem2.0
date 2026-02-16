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

// Stable t function for i18n mock (module-level const)
const mockT = (key, fallback) => fallback || key

// Mock de i18n
vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: mockT,
  }),
}))

// Mock authStore
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 1, rol: 'admin', roles: ['admin'] },
  }),
}))

// Mock StatusBadge
vi.mock('../../components/ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

// Mock SPMAgGrid - renders rows as simple table for testing
vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, emptyMessage }) => {
    if (!rowData || rowData.length === 0) {
      return <div data-testid="ag-grid-empty">{emptyMessage}</div>
    }
    return (
      <table data-testid="ag-grid">
        <thead>
          <tr>
            {columnDefs.map((col) => (
              <th key={col.field}>{col.headerName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowData.map((row, idx) => (
            <tr key={idx}>
              {columnDefs.map((col) => {
                // Handle valueFormatter
                if (col.valueFormatter) {
                  return (
                    <td key={col.field}>
                      {col.valueFormatter({ data: row })}
                    </td>
                  )
                }
                // Handle cellRenderer
                if (col.cellRenderer) {
                  return (
                    <td key={col.field}>
                      {col.cellRenderer({ data: row })}
                    </td>
                  )
                }
                return <td key={col.field}>{row[col.field]}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
}))

// Mock formatters
vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `$${val || 0}`,
  formatDate: (val) => val || '-',
  getSectorNombre: (val) => val || '-',
  formatAlmacen: (val) => val || '-',
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
      // The component uses an MUI IconButton with ArrowBackIcon, no text "Volver"
      // We look for the back arrow icon by its test id
      expect(screen.getByTestId('ArrowBackIcon')).toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('should render page header with solicitud ID', async () => {
      renderComponent()
      await waitFor(() => {
        // The component renders an h1 with "Solicitud #123"
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('#123')
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
    it('should display normal criticidad with default chip', async () => {
      renderComponent()
      await waitFor(() => {
        // Component uses MUI Chip for criticidad
        const chip = screen.getByText('Normal')
        expect(chip).toBeInTheDocument()
      })
    })

    it('should display alta criticidad with error chip', async () => {
      solicitudes.obtener.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, criticidad: 'Alta' } }
      })
      renderComponent()
      await waitFor(() => {
        const chip = screen.getByText('Alta')
        expect(chip).toBeInTheDocument()
        // MUI Chip with color="error" gets a class containing "colorError"
        expect(chip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorError')
      })
    })
  })

  describe('Not Found', () => {
    it('should show not found when API returns no data', async () => {
      solicitudes.obtener.mockResolvedValue({ data: null })
      renderComponent()
      await waitFor(() => {
        // The component sets error "No se encontro la solicitud" (without accent)
        // but then falls through to !solicitud check which renders the alert
        expect(screen.getByText(/no.*encontr/i)).toBeInTheDocument()
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
        expect(screen.getByText('Error de servidor')).toBeInTheDocument()
      })
    })

    it('should show generic error when no message provided', async () => {
      solicitudes.obtener.mockRejectedValue(new Error('Network Error'))
      renderComponent()
      await waitFor(() => {
        // Falls back to err.message which is "Network Error"
        expect(screen.getByText('Network Error')).toBeInTheDocument()
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
        // Component uses MUI Paper with variant="outlined"
        const papers = document.querySelectorAll('.MuiPaper-outlined')
        expect(papers.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('should render card titles', async () => {
      renderComponent()
      await waitFor(() => {
        // i18n mock returns fallback strings which do NOT have accents
        expect(screen.getByText('Informacion General')).toBeInTheDocument()
        expect(screen.getByText('Ubicacion y Costos')).toBeInTheDocument()
        expect(screen.getByText('Justificacion')).toBeInTheDocument()
      })
    })
  })
})
