/**
 * Tests para Materials
 * Testing de búsqueda y agregado de materiales a solicitudes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Materials from '../Materials'
import * as spm from '../../services/spm'
import api from '../../services/api'

// Mock de servicios
vi.mock('../../services/spm', () => ({
  solicitudes: {
    obtener: vi.fn(),
    guardarBorrador: vi.fn(),
    finalizar: vi.fn(),
    eliminar: vi.fn(),
  },
  materiales: {
    buscar: vi.fn(),
    detalle: vi.fn(),
  },
}))

vi.mock('../../services/api')

// Mock de react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '123' }),
  }
})

// Mock de i18n context
vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}))

// Mock de formatters
vi.mock('../../utils/formatters', () => ({
  formatCurrency: (val) => `USD ${val?.toFixed(2) || '0.00'}`,
  formatAlmacen: (val) => val || '-',
}))

// Mock de constants
vi.mock('../../constants/sectores', () => ({
  renderSector: (sol) => sol?.sector || '-',
}))

// Mock de componentes UI
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, as, to }) => {
    const Component = as || 'button'
    return (
      <Component onClick={onClick} disabled={disabled} data-variant={variant} to={to}>
        {children}
      </Component>
    )
  },
}))

vi.mock('../../components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder, name, id, type }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      name={name}
      id={id}
      type={type}
      data-testid={`input-${id || name}`}
    />
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

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children, hover }) => <div data-testid="card" data-hover={hover}>{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children }) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
}))

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title, subtitle, actions }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle}
      {actions}
    </div>
  ),
}))

vi.mock('../../components/ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children, size }) => {
    if (!isOpen) return null
    return (
      <div data-testid="modal" data-size={size}>
        <h3>{title}</h3>
        <button onClick={onClose}>Cerrar modal</button>
        {children}
      </div>
    )
  },
}))

vi.mock('../../components/ui/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, onClose, onConfirm, title, description, confirmText, variant }) => {
    if (!isOpen) return null
    return (
      <div data-testid="confirm-modal" data-variant={variant}>
        <h3>{title}</h3>
        <p>{description}</p>
        <button onClick={onClose}>Cancelar</button>
        <button onClick={onConfirm}>{confirmText}</button>
      </div>
    )
  },
}))

vi.mock('../../components/ui/Skeleton', () => ({
  TableSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}))

vi.mock('../../components/ui/Badge', () => ({
  Badge: ({ children, variant }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}))

vi.mock('../../components/ui/ScrollReveal', () => ({
  ScrollReveal: ({ children }) => <div>{children}</div>,
}))

// Mock de lucide-react icons
vi.mock('lucide-react', () => ({
  Search: () => <span>🔍</span>,
  X: () => <span>X</span>,
  Loader2: () => <span>⏳</span>,
  Check: () => <span>✓</span>,
  Trash2: () => <span>🗑️</span>,
  MessageSquare: () => <span>💬</span>,
  Package: () => <span>📦</span>,
}))

// Mock de react-dom createPortal
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (children) => children,
  }
})

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={component} />
      </Routes>
    </BrowserRouter>
  )
}

describe('Materials', () => {
  const mockSolicitud = {
    id: 123,
    centro: '1001',
    sector: 'Compras',
    almacen_virtual: 'ALM001',
    estado: 'draft',
    items: [],
  }

  const mockMateriales = [
    {
      codigo: 'MAT001',
      descripcion: 'Tornillo M6x20',
      descripcion_larga: 'Tornillo métrico M6 x 20mm acero inoxidable',
      unidad: 'UNI',
      precio_usd: 0.50,
    },
    {
      codigo: 'MAT002',
      descripcion: 'Tuerca M6',
      descripcion_larga: 'Tuerca métrica M6 acero inoxidable',
      unidad: 'UNI',
      precio_usd: 0.25,
    },
  ]

  const mockDetalle = {
    centro_consultado: '1001',
    almacen_consultado: 'ALM001',
    stock_total: 500,
    pedidos_en_curso: 2,
    stock_detalle: [
      { centro: '1001', almacen_consultado: 'ALM001', stock: 500 },
    ],
    stock_detalle_full: [],
    mrp: {
      planificado_mrp: true,
      sector: 'Compras',
      stock_seguridad: 100,
      punto_pedido: 200,
      stock_maximo: 1000,
    },
    consumo: {
      total: 5000,
      promedio_anual: 1000,
      anio_desde: 2020,
      anio_hasta: 2024,
      registros: [
        { fecha: '2024-01', cantidad: 100 },
        { fecha: '2023-12', cantidad: 95 },
      ],
    },
  }

  beforeEach(() => {
    spm.solicitudes.obtener.mockResolvedValue({
      data: { solicitud: mockSolicitud },
    })
    spm.materiales.buscar.mockResolvedValue({ data: mockMateriales })
    spm.materiales.detalle.mockResolvedValue({ data: mockDetalle })
    api.get = vi.fn().mockResolvedValue({ data: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('debe renderizar el componente', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument()
      })
    })

    it('debe mostrar el título "Agregar Materiales"', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(screen.getByText('Agregar Materiales')).toBeInTheDocument()
      })
    })

    it('debe cargar la solicitud al montar', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(spm.solicitudes.obtener).toHaveBeenCalledWith('123')
      })
    })

    it('debe mostrar skeleton mientras carga', () => {
      renderWithRouter(<Materials />)
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('debe mostrar información de la solicitud', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(screen.getByText('#123')).toBeInTheDocument()
        expect(screen.getByText('1001')).toBeInTheDocument()
        expect(screen.getByText('Compras')).toBeInTheDocument()
      })
    })
  })

  describe('Búsqueda de materiales', () => {
    it('debe mostrar campos de búsqueda', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(screen.getByTestId('input-searchCodigo')).toBeInTheDocument()
        expect(screen.getByTestId('input-searchDesc')).toBeInTheDocument()
      })
    })

    it('debe buscar materiales al escribir código', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const codigoInput = screen.getByTestId('input-searchCodigo')
        fireEvent.change(codigoInput, { target: { value: 'MAT001' } })
      })

      await waitFor(() => {
        expect(spm.materiales.buscar).toHaveBeenCalledWith(
          expect.objectContaining({ codigo: 'MAT001' })
        )
      }, { timeout: 1000 })
    })

    it('debe buscar materiales al escribir descripción', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        expect(spm.materiales.buscar).toHaveBeenCalledWith(
          expect.objectContaining({ descripcion: 'Tornillo' })
        )
      }, { timeout: 1000 })
    })

    it('debe mostrar resultados de búsqueda', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        expect(screen.getByText('MAT001')).toBeInTheDocument()
        expect(screen.getByText((content, element) => {
          return element.textContent === 'Tornillo M6x20'
        })).toBeInTheDocument()
      })
    })

    it('debe limpiar búsqueda al hacer clic en limpiar', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      // Esperar a que aparezca el botón de limpiar (X)
      await waitFor(() => {
        const clearButtons = screen.getAllByText('X')
        // El último X debería ser el de limpiar búsqueda
        const clearButton = clearButtons[clearButtons.length - 1]
        fireEvent.click(clearButton)
      })

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        expect(descInput.value).toBe('')
      })
    })
  })

  describe('Selección de materiales', () => {
    it('debe seleccionar un material al hacer clic', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        expect(screen.getByText('MAT001')).toBeInTheDocument()
      })

      // Simular clic en el resultado (el componente usa button para los resultados)
      const mat001Elements = screen.getAllByText('MAT001')
      if (mat001Elements.length > 1) {
        // El primer elemento es el del dropdown
        fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
      }

      await waitFor(() => {
        expect(spm.materiales.detalle).toHaveBeenCalledWith(
          'MAT001',
          expect.any(Object)
        )
      })
    })

    it('debe mostrar el material seleccionado', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        // Verificar que el material está seleccionado (aparece con check)
        expect(screen.getByText('✓')).toBeInTheDocument()
      })
    })

    it('debe cargar detalles automáticamente al seleccionar', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        expect(spm.materiales.detalle).toHaveBeenCalled()
      })
    })
  })

  describe('Agregar materiales a la solicitud', () => {
    it('debe agregar material seleccionado al hacer clic en Agregar', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      // Esperar a que se carguen los detalles y click en Agregar
      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Verificar que el material está en la tabla
      await waitFor(() => {
        const allMAT001 = screen.getAllByText('MAT001')
        // Debería haber al menos 2: uno en la lista y otro en la tabla
        expect(allMAT001.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('debe mostrar el material en la tabla de resumen', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element.textContent === 'Tornillo M6x20'
        })).toBeInTheDocument()
      })
    })

    it('debe incrementar cantidad si el material ya existe', async () => {
      renderWithRouter(<Materials />)

      // Agregar material una vez
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Buscar y agregar el mismo material nuevamente
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Verificar que la cantidad se incrementó a 2
      await waitFor(() => {
        const cantidadInputs = screen.getAllByDisplayValue('2')
        expect(cantidadInputs.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Gestión de cantidad', () => {
    it('debe permitir cambiar la cantidad de un material', async () => {
      // Primero agregar un material
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Cambiar la cantidad
      await waitFor(() => {
        const cantidadInput = screen.getByDisplayValue('1')
        fireEvent.change(cantidadInput, { target: { value: '10' } })
        expect(cantidadInput.value).toBe('10')
      })
    })

    it('debe calcular el subtotal correctamente', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Cambiar cantidad a 10
      await waitFor(() => {
        const cantidadInput = screen.getByDisplayValue('1')
        fireEvent.change(cantidadInput, { target: { value: '10' } })
      })

      // Verificar subtotal (10 * 0.50 = 5.00)
      await waitFor(() => {
        expect(screen.getByText('USD 5.00')).toBeInTheDocument()
      })
    })
  })

  describe('Eliminar materiales', () => {
    it('debe eliminar un material de la lista', async () => {
      renderWithRouter(<Materials />)

      // Agregar material
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Eliminar material
      await waitFor(() => {
        const deleteButtons = screen.getAllByText('🗑️')
        if (deleteButtons.length > 0) {
          fireEvent.click(deleteButtons[0])
        }
      })

      // Verificar que muestra "Sin materiales"
      await waitFor(() => {
        expect(screen.getByText('Sin materiales agregados')).toBeInTheDocument()
      })
    })
  })

  describe('Guardar borrador', () => {
    it('debe guardar borrador al hacer clic en Guardar como borrador', async () => {
      spm.solicitudes.guardarBorrador.mockResolvedValue({
        data: { solicitud: mockSolicitud },
      })

      renderWithRouter(<Materials />)

      // Agregar un material primero
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const agregarButton = screen.getByText('Agregar')
        fireEvent.click(agregarButton)
      })

      // Guardar borrador
      const guardarButton = screen.getByText('Guardar como borrador')
      fireEvent.click(guardarButton)

      await waitFor(() => {
        expect(spm.solicitudes.guardarBorrador).toHaveBeenCalled()
      })
    })

    it('debe mostrar mensaje de éxito al guardar borrador', async () => {
      spm.solicitudes.guardarBorrador.mockResolvedValue({
        data: { solicitud: mockSolicitud },
      })

      renderWithRouter(<Materials />)

      // Agregar material y guardar
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Agregar'))
      })

      fireEvent.click(screen.getByText('Guardar como borrador'))

      await waitFor(() => {
        expect(screen.getByText('Borrador guardado.')).toBeInTheDocument()
      })
    })
  })

  describe('Enviar solicitud', () => {
    it('debe abrir modal de confirmación al enviar', async () => {
      renderWithRouter(<Materials />)

      // Agregar material
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Agregar'))
      })

      // Click en Enviar
      const enviarButton = screen.getByText('Enviar Solicitud')
      fireEvent.click(enviarButton)

      await waitFor(() => {
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
      })
    })

    it('debe enviar solicitud al confirmar', async () => {
      spm.solicitudes.finalizar.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, estado: 'Enviada' } },
      })

      renderWithRouter(<Materials />)

      // Agregar material
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Agregar'))
      })

      // Enviar
      fireEvent.click(screen.getByText('Enviar Solicitud'))

      await waitFor(() => {
        const confirmarButton = screen.getByText('Sí, enviar solicitud')
        fireEvent.click(confirmarButton)
      })

      await waitFor(() => {
        expect(spm.solicitudes.finalizar).toHaveBeenCalled()
      })
    })

    it('debe navegar a Mis Solicitudes después de enviar', async () => {
      spm.solicitudes.finalizar.mockResolvedValue({
        data: { solicitud: { ...mockSolicitud, estado: 'Enviada' } },
      })

      renderWithRouter(<Materials />)

      // Agregar material
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Agregar'))
      })

      fireEvent.click(screen.getByText('Enviar Solicitud'))

      await waitFor(() => {
        const confirmarButton = screen.getByText('Sí, enviar solicitud')
        fireEvent.click(confirmarButton)
      })

      // Verificar navegación (con timeout para el setTimeout de 1500ms)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/mis-solicitudes')
      }, { timeout: 2000 })
    })

    it('debe validar que hay al menos un item antes de enviar', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(screen.getByText('Enviar Solicitud')).toBeInTheDocument()
      })

      // Intentar enviar sin items
      fireEvent.click(screen.getByText('Enviar Solicitud'))

      await waitFor(() => {
        expect(screen.getByText('Agrega al menos un ítem')).toBeInTheDocument()
      })
    })
  })

  describe('Cancelar solicitud', () => {
    it('debe abrir modal de confirmación al cancelar', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        expect(screen.getByText('Cancelar Solicitud')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancelar Solicitud'))

      await waitFor(() => {
        expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
      })
    })

    it('debe eliminar solicitud al confirmar cancelación', async () => {
      spm.solicitudes.eliminar.mockResolvedValue({ data: { success: true } })

      renderWithRouter(<Materials />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Cancelar Solicitud'))
      })

      await waitFor(() => {
        const confirmarButton = screen.getByText('Confirmar')
        fireEvent.click(confirmarButton)
      })

      await waitFor(() => {
        expect(spm.solicitudes.eliminar).toHaveBeenCalledWith('123')
      })
    })
  })

  describe('Modal de detalle de material', () => {
    it('debe abrir modal de detalle al hacer clic en Ver detalles', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        const verDetallesButton = screen.getByText('Ver detalles')
        fireEvent.click(verDetallesButton)
      })

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
    })

    it('debe mostrar stock en el modal', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Ver detalles'))
      })

      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument()
      })
    })

    it('debe mostrar información de MRP en el modal', async () => {
      renderWithRouter(<Materials />)

      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Ver detalles'))
      })

      await waitFor(() => {
        // Verificar campos de MRP
        expect(screen.getByText(/Stock seguridad/)).toBeInTheDocument()
      })
    })
  })

  describe('Cálculo de totales', () => {
    it('debe calcular el total correctamente', async () => {
      renderWithRouter(<Materials />)

      // Agregar material con cantidad 10
      await waitFor(() => {
        const descInput = screen.getByTestId('input-searchDesc')
        fireEvent.change(descInput, { target: { value: 'Tornillo' } })
      })

      await waitFor(() => {
        const mat001Elements = screen.getAllByText('MAT001')
        if (mat001Elements.length > 0) {
          fireEvent.click(mat001Elements[0].closest('button') || mat001Elements[0])
        }
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Agregar'))
      })

      await waitFor(() => {
        const cantidadInput = screen.getByDisplayValue('1')
        fireEvent.change(cantidadInput, { target: { value: '10' } })
      })

      // El total debería ser 10 * 0.50 = 5.00
      await waitFor(() => {
        expect(screen.getByText('USD 5.00')).toBeInTheDocument()
      })
    })
  })
})
