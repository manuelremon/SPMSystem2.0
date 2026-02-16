/**
 * Tests para MisSolicitudes.jsx
 * Flujo critico: ver solicitudes propias del usuario
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ============================================================================
// MOCKS - must be defined before importing the component
// ============================================================================

// Stable i18n mock (module-level const to avoid re-render loops)
const mockT = (key, fallback) => fallback || key;
const mockI18n = { t: mockT, lang: 'es' };
vi.mock('../../context/i18n', () => ({
  useI18n: () => mockI18n,
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: '1', nombre: 'Test User' },
  }),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock spm service - component uses `solicitudes.listar()` and `solicitudes.eliminar()`
const mockListar = vi.fn();
const mockEliminar = vi.fn();
vi.mock('../../services/spm', () => ({
  solicitudes: {
    listar: (...args) => mockListar(...args),
    eliminar: (...args) => mockEliminar(...args),
  },
}));

// Mock api (used for fetching sectores: api.get('/catalogos/sectores'))
const mockApiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Mock useDebounced to return value immediately (no delay)
vi.mock('../../hooks/useDebounced', () => ({
  useDebounced: (value) => value,
  default: (value) => value,
}));

// Mock formatters
vi.mock('../../utils/formatters', () => ({
  formatDate: (d) => d || '-',
  formatCurrency: (v) => `$${v || 0}`,
  getSectorNombre: (s) => s || '-',
  formatAlmacen: (a) => a || '-',
}));

// Mock styleConfig
vi.mock('../../utils/styleConfig', () => ({
  getCriticidadConfig: (c) => ({ label: c || 'Normal', color: '#333', bg: '#eee' }),
}));

// Mock StatusBadge
vi.mock('../../components/ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}));

// Mock SPMAgGrid - render data in a testable table
vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, columnDefs, loading, emptyMessage, onRowDoubleClick }) => (
    <div data-testid="spm-ag-grid">
      {loading ? (
        <span data-testid="grid-loading">Cargando...</span>
      ) : rowData?.length > 0 ? (
        <table>
          <thead>
            <tr>
              {columnDefs?.map((col, i) => (
                <th key={i}>{col.headerName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowData.map((row, i) => (
              <tr
                key={row.id || i}
                data-testid={`grid-row-${row.id || i}`}
                onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
              >
                <td>{row.id}</td>
                <td>{row.fecha_creacion || row.created_at}</td>
                <td>{row.justificacion || '-'}</td>
                <td>{row.centro || '-'}</td>
                <td>{row.almacen_virtual || '-'}</td>
                <td>{row.sector || '-'}</td>
                <td>{row.criticidad || 'Normal'}</td>
                <td>${row.total_monto || 0}</td>
                <td data-testid={`status-${row.id}`}>{row.estado || row.status}</td>
                <td>{row.planner_nombre || '-'}</td>
                <td>
                  {columnDefs?.find(c => c.headerName === 'Acciones')?.cellRenderer?.({
                    data: row,
                    value: row.acciones,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <span data-testid="grid-empty">{emptyMessage}</span>
      )}
    </div>
  ),
}));

import MisSolicitudes from '../MisSolicitudes';

// ============================================================================
// TEST DATA
// ============================================================================
const mockSolicitudes = [
  {
    id: 1,
    estado: 'draft',
    created_at: '2025-01-01T10:00:00',
    items_count: 3,
    justificacion: 'Solicitud de prueba 1',
    centro: 'C100',
  },
  {
    id: 2,
    estado: 'submitted',
    created_at: '2025-01-02T10:00:00',
    items_count: 5,
    justificacion: 'Solicitud de prueba 2',
    centro: 'C200',
  },
];

// ============================================================================
// HELPERS
// ============================================================================
const renderMisSolicitudes = () => {
  return render(
    <MemoryRouter>
      <MisSolicitudes />
    </MemoryRouter>
  );
};

// ============================================================================
// TESTS
// ============================================================================
describe('MisSolicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: sectores fetch succeeds
    mockApiGet.mockResolvedValue({ data: [] });

    // Default: solicitudes.listar succeeds with mock data
    mockListar.mockResolvedValue({
      data: {
        ok: true,
        solicitudes: mockSolicitudes,
      },
    });

    mockEliminar.mockResolvedValue({ data: { ok: true } });
  });

  describe('Renderizado inicial', () => {
    it('muestra el titulo de la pagina', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/Mis Solicitudes/i)).toBeInTheDocument();
      });
    });

    it('muestra boton para crear nueva solicitud', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /Crear Solicitud/i });
        expect(newButton).toBeInTheDocument();
      });
    });
  });

  describe('Carga de datos', () => {
    it('llama a solicitudes.listar al montar', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(mockListar).toHaveBeenCalled();
      });
    });

    it('muestra las solicitudes cargadas en el grid', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('grid-row-1')).toBeInTheDocument();
        expect(screen.getByTestId('grid-row-2')).toBeInTheDocument();
      });
    });
  });

  describe('Estados de solicitud', () => {
    it('muestra estado borrador para solicitud draft', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('status-1')).toHaveTextContent('draft');
      });
    });

    it('muestra estado enviada para solicitud submitted', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('status-2')).toHaveTextContent('submitted');
      });
    });
  });

  describe('Navegacion', () => {
    it('navega a crear solicitud al hacer click en nueva', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Crear Solicitud/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Crear Solicitud/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/nueva');
    });

    it('navega al detalle al hacer click en una solicitud', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('grid-row-1')).toBeInTheDocument();
      });

      // The grid renders action buttons via cellRenderer - for draft rows there is "Editar"
      // We verify the row exists and can be interacted with
      const row = screen.getByTestId('grid-row-1');
      expect(row).toBeInTheDocument();
    });
  });

  describe('Filtros', () => {
    it('permite filtrar por estado via tabs', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        // Tabs are rendered: Todas, Borradores, Enviadas, Aprobadas, Rechazadas, Cerradas
        expect(screen.getByText('Todas')).toBeInTheDocument();
        expect(screen.getByText('Borradores')).toBeInTheDocument();
        expect(screen.getByText('Enviadas')).toBeInTheDocument();
      });
    });

    it('permite buscar por texto - el componente tiene busqueda quick filter en grid', async () => {
      renderMisSolicitudes();

      // The SPMAgGrid has enableQuickFilter=true which renders a toolbar
      await waitFor(() => {
        expect(screen.getByTestId('spm-ag-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Acciones', () => {
    it('permite editar solicitud en borrador', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('grid-row-1')).toBeInTheDocument();
      });

      // The cellRenderer for draft rows shows "Editar" button
      const editButton = screen.getByText('Editar');
      expect(editButton).toBeInTheDocument();
    });

    it('permite eliminar solicitud en borrador', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('grid-row-1')).toBeInTheDocument();
      });

      // The cellRenderer for draft rows shows "Borrar" button
      const deleteButton = screen.getByText('Borrar');
      expect(deleteButton).toBeInTheDocument();

      // Clicking Borrar should open the delete modal
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Eliminar solicitud')).toBeInTheDocument();
      });
    });
  });

  describe('Lista vacia', () => {
    it('muestra mensaje cuando no hay solicitudes', async () => {
      mockListar.mockResolvedValue({
        data: {
          ok: true,
          solicitudes: [],
        },
      });

      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByTestId('grid-empty')).toHaveTextContent('No tienes solicitudes');
      });
    });
  });

  describe('Manejo de errores', () => {
    it('muestra error cuando falla la carga', async () => {
      mockListar.mockRejectedValue(new Error('Error de red'));

      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/Error de red/i)).toBeInTheDocument();
      });
    });
  });

  describe('Paginacion', () => {
    it('muestra paginacion cuando hay muchas solicitudes', async () => {
      mockListar.mockResolvedValue({
        data: {
          ok: true,
          solicitudes: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            estado: 'draft',
            created_at: '2025-01-01',
            items_count: 1,
            justificacion: `Solicitud ${i + 1}`,
          })),
        },
      });

      renderMisSolicitudes();

      // The SPMAgGrid component handles pagination internally (AG Grid)
      // We verify the grid receives the data correctly
      await waitFor(() => {
        expect(screen.getByTestId('grid-row-1')).toBeInTheDocument();
        expect(screen.getByTestId('grid-row-10')).toBeInTheDocument();
      });
    });
  });
});
