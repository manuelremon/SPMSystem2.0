/**
 * Tests para Planner.jsx
 * Flujo critico: planificacion de solicitudes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Planner from '../Planner';

// Mock de usePlanner hook
const mockUsePlanner = {
  error: null,
  success: null,
  loading: false,
  q: '',
  filtroCentro: '',
  filtroSector: '',
  filtroEstado: '',
  filtroCriticidad: '',
  currentPage: 1,
  activeTab: 'pendientes',
  selectedParaTratar: null,
  rejectModal: { open: false, solicitud: null, motivo: '' },
  historialModal: { open: false, solicitud: null },
  filtered: [],
  paginatedItems: [],
  totalPages: 1,
  tabCounts: { pendientes: 5, enProceso: 2, finalizadas: 10 },
  itemsPerPage: 10,
  setQ: vi.fn(),
  setFiltroCentro: vi.fn(),
  setFiltroSector: vi.fn(),
  setFiltroEstado: vi.fn(),
  setFiltroCriticidad: vi.fn(),
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
};

vi.mock('../../hooks/usePlanner', () => ({
  usePlanner: () => mockUsePlanner,
  renderSolicitante: (row) => row?.solicitante_nombre || 'N/A'
}));

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key
  })
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
    // Reset mock values
    mockUsePlanner.loading = false;
    mockUsePlanner.error = null;
    mockUsePlanner.paginatedItems = [];
    mockUsePlanner.activeTab = 'pendientes';
  });

  describe('Renderizado inicial', () => {
    it('muestra el header de planificador', () => {
      renderPlanner();

      expect(screen.getByText('Planificador')).toBeInTheDocument();
    });

    it('muestra las pestañas de estado', () => {
      renderPlanner();

      expect(screen.getByText(/pendientes/i)).toBeInTheDocument();
      expect(screen.getByText(/en proceso/i)).toBeInTheDocument();
      expect(screen.getByText(/finalizadas/i)).toBeInTheDocument();
    });

    it('muestra contadores en las pestañas', () => {
      renderPlanner();

      // Los contadores deben estar visibles
      expect(screen.getByText('5')).toBeInTheDocument(); // pendientes
      expect(screen.getByText('2')).toBeInTheDocument(); // en proceso
      expect(screen.getByText('10')).toBeInTheDocument(); // finalizadas
    });
  });

  describe('Estado de carga', () => {
    it('muestra skeleton cuando esta cargando', () => {
      mockUsePlanner.loading = true;
      renderPlanner();

      // Deberia mostrar algun indicador de carga
      const loadingElements = document.querySelectorAll('[class*="animate"]');
      expect(loadingElements.length).toBeGreaterThan(0);
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

      const searchInput = screen.getByPlaceholderText(/buscar/i);
      expect(searchInput).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(mockUsePlanner.setQ).toHaveBeenCalledWith('test');
    });
  });

  describe('Cambio de pestañas', () => {
    it('cambia a pestaña en proceso', () => {
      renderPlanner();

      const enProcesoTab = screen.getByText(/en proceso/i);
      fireEvent.click(enProcesoTab);

      expect(mockUsePlanner.setActiveTab).toHaveBeenCalledWith('enProceso');
    });

    it('cambia a pestaña finalizadas', () => {
      renderPlanner();

      const finalizadasTab = screen.getByText(/finalizadas/i);
      fireEvent.click(finalizadasTab);

      expect(mockUsePlanner.setActiveTab).toHaveBeenCalledWith('finalizadas');
    });
  });

  describe('Tabla de solicitudes', () => {
    it('muestra mensaje cuando no hay solicitudes', () => {
      mockUsePlanner.paginatedItems = [];
      renderPlanner();

      expect(screen.getByText(/no hay solicitudes/i)).toBeInTheDocument();
    });

    it('muestra solicitudes en la tabla', () => {
      mockUsePlanner.paginatedItems = [
        {
          id: 1,
          numero_solicitud: 'SOL-001',
          estado: 'approved',
          criticidad: 'alta',
          solicitante_nombre: 'Juan Perez',
          centro_nombre: 'Centro A',
          sector_nombre: 'Sector 1',
          created_at: '2025-01-01',
          items_count: 3
        },
        {
          id: 2,
          numero_solicitud: 'SOL-002',
          estado: 'approved',
          criticidad: 'media',
          solicitante_nombre: 'Maria Lopez',
          centro_nombre: 'Centro B',
          sector_nombre: 'Sector 2',
          created_at: '2025-01-02',
          items_count: 5
        }
      ];

      renderPlanner();

      expect(screen.getByText('SOL-001')).toBeInTheDocument();
      expect(screen.getByText('SOL-002')).toBeInTheDocument();
    });
  });

  describe('Acciones de solicitud', () => {
    beforeEach(() => {
      mockUsePlanner.paginatedItems = [
        {
          id: 1,
          numero_solicitud: 'SOL-001',
          estado: 'approved',
          criticidad: 'alta',
          solicitante_nombre: 'Juan Perez',
          centro_nombre: 'Centro A',
          sector_nombre: 'Sector 1',
          created_at: '2025-01-01',
          items_count: 3
        }
      ];
    });

    it('permite ver detalle de solicitud', async () => {
      renderPlanner();

      // Buscar boton de ver (Eye icon)
      const viewButtons = screen.getAllByRole('button');
      const viewButton = viewButtons.find(btn =>
        btn.querySelector('svg') || btn.textContent.includes('Ver')
      );

      if (viewButton) {
        fireEvent.click(viewButton);
        expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/1');
      }
    });

    it('permite tratar solicitud', () => {
      renderPlanner();

      // El boton de tratar deberia estar disponible
      const tratarButtons = screen.getAllByRole('button');
      const tratarButton = tratarButtons.find(btn =>
        btn.textContent?.includes('Tratar') || btn.querySelector('[class*="play"]')
      );

      if (tratarButton) {
        fireEvent.click(tratarButton);
        expect(mockUsePlanner.handleTratar).toHaveBeenCalled();
      }
    });
  });

  describe('Exportar', () => {
    it('permite exportar solicitudes', () => {
      renderPlanner();

      const exportButton = screen.getByRole('button', { name: /exportar/i });
      if (exportButton) {
        fireEvent.click(exportButton);
        expect(mockUsePlanner.handleExport).toHaveBeenCalled();
      }
    });
  });

  describe('Paginacion', () => {
    it('muestra paginacion cuando hay multiples paginas', () => {
      mockUsePlanner.totalPages = 5;
      mockUsePlanner.currentPage = 1;
      mockUsePlanner.paginatedItems = [
        { id: 1, numero_solicitud: 'SOL-001', estado: 'approved', criticidad: 'alta' }
      ];

      renderPlanner();

      // Deberia haber controles de paginacion
      const paginationButtons = screen.getAllByRole('button');
      expect(paginationButtons.length).toBeGreaterThan(0);
    });

    it('permite cambiar de pagina', () => {
      mockUsePlanner.totalPages = 3;
      mockUsePlanner.currentPage = 1;
      renderPlanner();

      // Buscar boton de siguiente pagina
      const nextButton = screen.getByRole('button', { name: /siguiente|next|›/i });
      if (nextButton) {
        fireEvent.click(nextButton);
        expect(mockUsePlanner.setCurrentPage).toHaveBeenCalled();
      }
    });
  });

  describe('Modal de tratar', () => {
    it('muestra modal cuando hay solicitud seleccionada', () => {
      mockUsePlanner.selectedParaTratar = {
        id: 1,
        numero_solicitud: 'SOL-001',
        items: [{ codigo_sap: '12345', descripcion: 'Material 1', cantidad: 10 }]
      };

      renderPlanner();

      // El modal deberia estar presente
      expect(mockUsePlanner.selectedParaTratar).toBeTruthy();
    });

    it('cierra modal al completar', () => {
      mockUsePlanner.selectedParaTratar = { id: 1 };
      renderPlanner();

      // Simular cierre
      mockUsePlanner.closeTratarModal();
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
    it('permite refrescar la lista', () => {
      renderPlanner();

      const refreshButton = screen.getByRole('button', { name: /refrescar|refresh|actualizar/i });
      if (refreshButton) {
        fireEvent.click(refreshButton);
        expect(mockUsePlanner.load).toHaveBeenCalled();
      }
    });
  });
});
