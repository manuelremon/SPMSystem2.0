/**
 * Tests para Planner.jsx
 * Flujo critico: planificacion de solicitudes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Planner from '../Planner';

// Stable i18n mock reference
const stableT = vi.fn((key, fallback) => fallback || key);
const stableI18n = { t: stableT, lang: 'es' };
vi.mock('../../context/i18n', () => ({
  useI18n: () => stableI18n
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock useDebouncedValue to return value immediately
vi.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value) => value
}));

// Mock formatters and styleConfig
vi.mock('../../utils/formatters', () => ({
  formatDate: vi.fn((d) => d || ''),
  formatCurrency: vi.fn((v) => `$${v || 0}`),
  getSectorNombre: vi.fn((s) => s || ''),
  exportToExcel: vi.fn()
}));

vi.mock('../../utils/styleConfig', () => ({
  getCriticidadConfig: vi.fn((c) => ({ color: '#000', label: c || 'Normal' }))
}));

// Mock child components
vi.mock('../../components/ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>
}));

vi.mock('../../components/ui/SPMAgGrid', () => ({
  SPMAgGrid: ({ rowData, loading, emptyMessage, columnDefs, onRowDoubleClick }) => {
    if (loading) {
      return <div data-testid="ag-grid-loading" className="animate-pulse">Loading...</div>;
    }
    if (!rowData || rowData.length === 0) {
      return <div data-testid="ag-grid-empty">{emptyMessage || 'No data'}</div>;
    }
    return (
      <div data-testid="ag-grid">
        {rowData.map((row) => {
          // Render action buttons from column defs
          const accionesCol = columnDefs?.find((c) => c.field === 'acciones');
          return (
            <div key={row.id} data-testid={`ag-row-${row.id}`} onDoubleClick={() => onRowDoubleClick?.(row)}>
              <span>{row.id}</span>
              <span>{row.justificacion || ''}</span>
              {accionesCol?.cellRenderer?.({ data: row })}
            </div>
          );
        })}
      </div>
    );
  }
}));

vi.mock('../../components/Planner/TratarSolicitudModal', () => ({
  default: ({ solicitud, isOpen, onClose, onComplete }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="tratar-modal">
        <span>Tratar Modal - Solicitud #{solicitud?.id}</span>
        <button onClick={onClose}>Cerrar</button>
        <button onClick={onComplete}>Completar</button>
      </div>
    );
  }
}));

vi.mock('../../components/Planner/SolicitudDetalleModal', () => ({
  default: ({ isOpen, onClose, solicitud }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="detalle-modal">
        <span>Detalle - Solicitud #{solicitud?.id}</span>
        <button onClick={onClose}>Cerrar</button>
      </div>
    );
  }
}));

// Mock usePlanner hook with proper API shape
const mockUsePlanner = {
  error: '',
  success: '',
  loading: false,
  q: '',
  filtroCentros: [],
  filtroAlmacenes: [],
  filtroSectores: [],
  filtroEstados: [],
  filtroCriticidades: [],
  currentPage: 1,
  activeTab: 'pendientes',
  selectedParaTratar: null,
  rejectModal: { open: false, solicitud: null, motivo: '' },
  historialModal: { open: false, solicitud: null },
  filtered: [],
  paginatedItems: [],
  totalPages: 1,
  tabCounts: { pendientes: 5, en_progreso: 2, finalizadas: 10 },
  itemsPerPage: 20,
  catalogos: { centros: [], almacenes: [], sectores: [] },
  estadosOptions: [
    { value: 'aprobada', label: 'Aprobada' },
    { value: 'progreso', label: 'En Progreso' },
    { value: 'finalizada', label: 'Finalizada' },
    { value: 'rechazada', label: 'Rechazada' },
  ],
  criticidadOptions: [
    { value: 'normal', label: 'Normal' },
    { value: 'alta', label: 'Alta' },
  ],
  hayFiltrosActivos: false,
  setQ: vi.fn(),
  setFiltroCentros: vi.fn(),
  setFiltroAlmacenes: vi.fn(),
  setFiltroSectores: vi.fn(),
  setFiltroEstados: vi.fn(),
  setFiltroCriticidades: vi.fn(),
  setCurrentPage: vi.fn(),
  setActiveTab: vi.fn(),
  load: vi.fn(),
  handleTratar: vi.fn(),
  rechazar: vi.fn(),
  handleExport: vi.fn(),
  closeTratarModal: vi.fn(),
  onTratarComplete: vi.fn(),
  closeRejectModal: vi.fn(),
  updateRejectMotivo: vi.fn(),
  openHistorialModal: vi.fn(),
  closeHistorialModal: vi.fn(),
  clearError: vi.fn(),
  clearSuccess: vi.fn(),
  limpiarFiltros: vi.fn(),
};

vi.mock('../../hooks/usePlanner', () => ({
  usePlanner: () => mockUsePlanner,
  renderSolicitante: (row) => row?.solicitante_nombre || 'N/A'
}));

const renderPlanner = () => {
  return render(
    <BrowserRouter>
      <Planner />
    </BrowserRouter>
  );
};

describe('Planner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock values to defaults
    mockUsePlanner.loading = false;
    mockUsePlanner.error = '';
    mockUsePlanner.success = '';
    mockUsePlanner.filtered = [];
    mockUsePlanner.paginatedItems = [];
    mockUsePlanner.activeTab = 'pendientes';
    mockUsePlanner.selectedParaTratar = null;
    mockUsePlanner.rejectModal = { open: false, solicitud: null, motivo: '' };
    mockUsePlanner.tabCounts = { pendientes: 5, en_progreso: 2, finalizadas: 10 };
    mockUsePlanner.totalPages = 1;
    mockUsePlanner.currentPage = 1;
    mockUsePlanner.q = '';
    mockUsePlanner.catalogos = { centros: [], almacenes: [], sectores: [] };
  });

  describe('Renderizado inicial', () => {
    it('muestra el header de planificador', () => {
      renderPlanner();

      // The title is rendered via t('planner_title', 'Planificador')
      expect(screen.getByText('Planificador')).toBeInTheDocument();
    });

    it('muestra las pestanas de estado', () => {
      renderPlanner();

      expect(screen.getByText('Pendientes')).toBeInTheDocument();
      expect(screen.getByText('En Progreso')).toBeInTheDocument();
      expect(screen.getByText('Finalizadas')).toBeInTheDocument();
    });

    it('muestra contadores en las pestanas', () => {
      renderPlanner();

      // Tab counts are rendered inside Chip components
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('Estado de carga', () => {
    it('muestra indicador de carga cuando esta cargando', () => {
      mockUsePlanner.loading = true;
      renderPlanner();

      // SPMAgGrid mock shows a loading div with animate-pulse class
      expect(screen.getByTestId('ag-grid-loading')).toBeInTheDocument();
    });
  });

  describe('Manejo de errores', () => {
    it('muestra mensaje de error cuando hay error', () => {
      mockUsePlanner.error = 'Error al cargar solicitudes';
      renderPlanner();

      expect(screen.getByText('Error al cargar solicitudes')).toBeInTheDocument();
    });
  });

  describe('Filtros', () => {
    it('permite buscar por texto', () => {
      renderPlanner();

      // The search field has placeholder "ID, asunto..."
      const searchInput = screen.getByPlaceholderText('ID, asunto...');
      expect(searchInput).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(mockUsePlanner.setQ).toHaveBeenCalledWith('test');
    });
  });

  describe('Cambio de pestanas', () => {
    it('cambia a pestana en progreso', () => {
      renderPlanner();

      // MUI Tabs: click the "En Progreso" tab text
      const enProgresoTab = screen.getByText('En Progreso');
      fireEvent.click(enProgresoTab);

      // setActiveTab is called via handleTabChange which calls setActiveTab(newValue)
      // MUI Tabs call onChange with the new value
      expect(mockUsePlanner.setActiveTab).toHaveBeenCalled();
    });

    it('cambia a pestana finalizadas', () => {
      renderPlanner();

      const finalizadasTab = screen.getByText('Finalizadas');
      fireEvent.click(finalizadasTab);

      expect(mockUsePlanner.setActiveTab).toHaveBeenCalled();
    });
  });

  describe('Tabla de solicitudes', () => {
    it('muestra mensaje cuando no hay solicitudes', () => {
      mockUsePlanner.filtered = [];
      renderPlanner();

      // SPMAgGrid mock shows emptyMessage when rowData is empty
      expect(screen.getByTestId('ag-grid-empty')).toBeInTheDocument();
    });

    it('muestra solicitudes en la grilla', () => {
      mockUsePlanner.filtered = [
        {
          id: 1,
          justificacion: 'Material urgente',
          estado: 'approved',
          criticidad: 'alta',
          solicitante_nombre: 'Juan Perez',
          centro: 'Centro A',
          sector: 'Sector 1',
          created_at: '2025-01-01',
          items: [{ codigo_sap: '12345' }]
        },
        {
          id: 2,
          justificacion: 'Repuestos motor',
          estado: 'approved',
          criticidad: 'media',
          solicitante_nombre: 'Maria Lopez',
          centro: 'Centro B',
          sector: 'Sector 2',
          created_at: '2025-01-02',
          items: [{ codigo_sap: '67890' }]
        }
      ];

      renderPlanner();

      expect(screen.getByTestId('ag-grid')).toBeInTheDocument();
      expect(screen.getByTestId('ag-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('ag-row-2')).toBeInTheDocument();
    });
  });

  describe('Acciones de solicitud', () => {
    beforeEach(() => {
      mockUsePlanner.filtered = [
        {
          id: 1,
          justificacion: 'Material urgente',
          estado: 'approved',
          criticidad: 'alta',
          solicitante_nombre: 'Juan Perez',
          centro: 'Centro A',
          sector: 'Sector 1',
          created_at: '2025-01-01',
          items: [{ codigo_sap: '12345' }]
        }
      ];
    });

    it('permite ver detalle de solicitud', async () => {
      renderPlanner();

      // The AG Grid mock renders action buttons from columnDefs
      // The "Ver" button has aria-label like "Ver solicitud #1"
      const verButton = screen.getByLabelText('Ver solicitud #1');
      fireEvent.click(verButton);

      // Clicking "Ver" opens the detalle modal via setDetalleModal
      await waitFor(() => {
        expect(screen.getByTestId('detalle-modal')).toBeInTheDocument();
      });
    });

    it('permite tratar solicitud', () => {
      renderPlanner();

      // The "Tratar" button has aria-label like "Tratar solicitud #1"
      const tratarButton = screen.getByLabelText('Tratar solicitud #1');
      fireEvent.click(tratarButton);

      expect(mockUsePlanner.handleTratar).toHaveBeenCalled();
    });
  });

  describe('Exportar', () => {
    it('permite exportar solicitudes via SPMAgGrid', () => {
      // SPMAgGrid handles export internally via exportFileName prop
      // We verify the component renders with the export prop
      renderPlanner();

      // The grid is rendered (export is handled internally by SPMAgGrid)
      // This test verifies the grid renders without errors
      expect(screen.getByTestId('ag-grid-empty')).toBeInTheDocument();
    });
  });

  describe('Paginacion', () => {
    it('muestra la grilla cuando hay solicitudes', () => {
      mockUsePlanner.filtered = [
        { id: 1, estado: 'approved', criticidad: 'alta', items: [] }
      ];

      renderPlanner();

      expect(screen.getByTestId('ag-grid')).toBeInTheDocument();
    });

    it('muestra grilla vacia cuando no hay solicitudes', () => {
      mockUsePlanner.filtered = [];
      renderPlanner();

      expect(screen.getByTestId('ag-grid-empty')).toBeInTheDocument();
    });
  });

  describe('Modal de tratar', () => {
    it('muestra modal cuando hay solicitud seleccionada', () => {
      mockUsePlanner.selectedParaTratar = {
        id: 1,
        items: [{ codigo_sap: '12345', descripcion: 'Material 1', cantidad: 10 }]
      };

      renderPlanner();

      expect(screen.getByTestId('tratar-modal')).toBeInTheDocument();
      expect(screen.getByText(/Tratar Modal - Solicitud #1/)).toBeInTheDocument();
    });

    it('cierra modal al hacer click en cerrar', () => {
      mockUsePlanner.selectedParaTratar = { id: 1, items: [] };
      renderPlanner();

      const cerrarBtn = within(screen.getByTestId('tratar-modal')).getByText('Cerrar');
      fireEvent.click(cerrarBtn);

      expect(mockUsePlanner.closeTratarModal).toHaveBeenCalled();
    });
  });

  describe('Mensaje de exito', () => {
    it('muestra mensaje de exito', () => {
      mockUsePlanner.success = 'Solicitud procesada correctamente';
      renderPlanner();

      expect(screen.getByText('Solicitud procesada correctamente')).toBeInTheDocument();
    });
  });

  describe('Refrescar datos', () => {
    it('permite navegar hacia atras con boton volver', () => {
      renderPlanner();

      // The back button has aria-label 'Volver'
      const backButton = screen.getByLabelText('Volver');
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });
});
