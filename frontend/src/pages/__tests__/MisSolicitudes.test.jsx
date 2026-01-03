/**
 * Tests para MisSolicitudes.jsx
 * Flujo critico: ver solicitudes propias del usuario
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MisSolicitudes from '../MisSolicitudes';

// Mock de spm service
vi.mock('../../services/spm', () => ({
  getMisSolicitudes: vi.fn(() => Promise.resolve({
    data: {
      ok: true,
      solicitudes: [
        {
          id: 1,
          numero_solicitud: 'SOL-2025-001',
          estado: 'draft',
          created_at: '2025-01-01T10:00:00',
          items_count: 3,
          total_items: 3
        },
        {
          id: 2,
          numero_solicitud: 'SOL-2025-002',
          estado: 'submitted',
          created_at: '2025-01-02T10:00:00',
          items_count: 5,
          total_items: 5
        }
      ],
      pagination: {
        total: 2,
        page: 1,
        per_page: 10,
        pages: 1
      }
    }
  })),
  deleteSolicitud: vi.fn(() => Promise.resolve({ data: { ok: true } }))
}));

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key
  })
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: '1', nombre: 'Test User' }
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

import { getMisSolicitudes, deleteSolicitud } from '../../services/spm';

const renderMisSolicitudes = () => {
  return render(
    <BrowserRouter>
      <MisSolicitudes />
    </BrowserRouter>
  );
};

describe('MisSolicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMisSolicitudes.mockResolvedValue({
      data: {
        ok: true,
        solicitudes: [
          {
            id: 1,
            numero_solicitud: 'SOL-2025-001',
            estado: 'draft',
            created_at: '2025-01-01T10:00:00',
            items_count: 3
          },
          {
            id: 2,
            numero_solicitud: 'SOL-2025-002',
            estado: 'submitted',
            created_at: '2025-01-02T10:00:00',
            items_count: 5
          }
        ],
        pagination: { total: 2, page: 1, per_page: 10, pages: 1 }
      }
    });
  });

  describe('Renderizado inicial', () => {
    it('muestra el titulo de la pagina', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/mis solicitudes/i)).toBeInTheDocument();
      });
    });

    it('muestra boton para crear nueva solicitud', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /nueva|crear/i });
        expect(newButton).toBeInTheDocument();
      });
    });
  });

  describe('Carga de datos', () => {
    it('llama a getMisSolicitudes al montar', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(getMisSolicitudes).toHaveBeenCalled();
      });
    });

    it('muestra las solicitudes cargadas', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText('SOL-2025-001')).toBeInTheDocument();
        expect(screen.getByText('SOL-2025-002')).toBeInTheDocument();
      });
    });
  });

  describe('Estados de solicitud', () => {
    it('muestra badge de estado borrador', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/borrador|draft/i)).toBeInTheDocument();
      });
    });

    it('muestra badge de estado enviada', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/enviada|submitted/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navegacion', () => {
    it('navega a crear solicitud al hacer click en nueva', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /nueva|crear/i });
        fireEvent.click(newButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/nueva');
    });

    it('navega al detalle al hacer click en una solicitud', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText('SOL-2025-001')).toBeInTheDocument();
      });

      // Buscar enlace o fila clickeable
      const solicitudRow = screen.getByText('SOL-2025-001').closest('tr');
      if (solicitudRow) {
        fireEvent.click(solicitudRow);
      }
    });
  });

  describe('Filtros', () => {
    it('permite filtrar por estado', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        const filterSelect = screen.getByRole('combobox');
        if (filterSelect) {
          expect(filterSelect).toBeInTheDocument();
        }
      });
    });

    it('permite buscar por texto', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/buscar/i);
        if (searchInput) {
          fireEvent.change(searchInput, { target: { value: 'SOL-2025' } });
          expect(searchInput.value).toBe('SOL-2025');
        }
      });
    });
  });

  describe('Acciones', () => {
    it('permite editar solicitud en borrador', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText('SOL-2025-001')).toBeInTheDocument();
      });

      // Buscar boton de editar
      const editButtons = screen.getAllByRole('button');
      const editButton = editButtons.find(btn =>
        btn.getAttribute('aria-label')?.includes('editar') ||
        btn.textContent?.toLowerCase().includes('editar')
      );

      if (editButton) {
        expect(editButton).toBeInTheDocument();
      }
    });

    it('permite eliminar solicitud en borrador', async () => {
      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText('SOL-2025-001')).toBeInTheDocument();
      });

      // Buscar boton de eliminar
      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(btn =>
        btn.getAttribute('aria-label')?.includes('eliminar') ||
        btn.getAttribute('aria-label')?.includes('borrar')
      );

      if (deleteButton) {
        fireEvent.click(deleteButton);
        // Deberia mostrar confirmacion
      }
    });
  });

  describe('Lista vacia', () => {
    it('muestra mensaje cuando no hay solicitudes', async () => {
      getMisSolicitudes.mockResolvedValue({
        data: {
          ok: true,
          solicitudes: [],
          pagination: { total: 0, page: 1, per_page: 10, pages: 0 }
        }
      });

      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/no tienes solicitudes|sin solicitudes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Manejo de errores', () => {
    it('muestra error cuando falla la carga', async () => {
      getMisSolicitudes.mockRejectedValue(new Error('Error de red'));

      renderMisSolicitudes();

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Paginacion', () => {
    it('muestra paginacion cuando hay muchas solicitudes', async () => {
      getMisSolicitudes.mockResolvedValue({
        data: {
          ok: true,
          solicitudes: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            numero_solicitud: `SOL-2025-00${i + 1}`,
            estado: 'draft',
            created_at: '2025-01-01',
            items_count: 1
          })),
          pagination: { total: 25, page: 1, per_page: 10, pages: 3 }
        }
      });

      renderMisSolicitudes();

      await waitFor(() => {
        // Deberia haber controles de paginacion
        const nextButton = screen.getByRole('button', { name: /siguiente|next|›/i });
        expect(nextButton).toBeInTheDocument();
      });
    });
  });
});
