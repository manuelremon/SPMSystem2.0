/**
 * Tests para CreateSolicitud
 * Testing de creación de solicitudes con materiales
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import CreateSolicitud from '../CreateSolicitud'
import * as spm from '../../services/spm'
import api from '../../services/api'

// Mock de servicios
vi.mock('../../services/spm', () => ({
  solicitudes: {
    crear: vi.fn(),
    crearConArchivos: vi.fn(),
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
  }
})

// Mock de auth store
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 1, nombre: 'Test User' },
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
  Button: ({ children, onClick, disabled, type, variant }) => (
    <button onClick={onClick} disabled={disabled} type={type} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('../../components/ui/Input', () => ({
  Input: ({ value, onChange, name, id, placeholder, required, type }) => (
    <input
      value={value}
      onChange={onChange}
      name={name}
      id={id}
      placeholder={placeholder}
      required={required}
      type={type}
      data-testid={`input-${name || id}`}
    />
  ),
}))

vi.mock('../../components/ui/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, name, id, options, required, placeholder }) => (
    <select
      value={value}
      onChange={onChange}
      name={name}
      id={id}
      required={required}
      data-testid={`select-${name || id}`}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ),
}))

vi.mock('../../components/ui/Alert', () => ({
  Alert: ({ children, variant }) => (
    <div data-testid="alert" data-variant={variant}>{children}</div>
  ),
}))

vi.mock('../../components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children }) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
}))

vi.mock('../../components/ui/PageHeader', () => ({
  PageHeader: ({ title }) => <h1 data-testid="page-header">{title}</h1>,
}))

vi.mock('../../components/ui/Skeleton', () => ({
  FormSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}))

vi.mock('../../components/ui/FileUploader', () => ({
  FileUploader: ({ onChange, files }) => (
    <input
      type="file"
      data-testid="file-uploader"
      onChange={(e) => onChange(Array.from(e.target.files || []))}
      multiple
    />
  ),
}))

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('CreateSolicitud', () => {
  const mockCatalogos = {
    centros: [
      { id: '1001', nombre: 'Centro Buenos Aires', descripcion: 'Centro BA' },
      { id: '1002', nombre: 'Centro Córdoba', descripcion: 'Centro CB' },
    ],
    sectores: [
      { nombre: 'Compras', descripcion: 'Sector Compras' },
      { nombre: 'Logística', descripcion: 'Sector Logística' },
    ],
    almacenes: [
      { id: 'ALM001', nombre: 'Almacén Central', descripcion: 'Almacén 1' },
      { id: 'ALM002', nombre: 'Almacén Secundario', descripcion: 'Almacén 2' },
    ],
  }

  const mockAcceso = {
    centros_permitidos: ['1001'],
    sectores_permitidos: ['Compras'],
    almacenes_permitidos: ['ALM001'],
  }

  beforeEach(() => {
    // Mock de API get para catalogos
    api.get = vi.fn((url) => {
      if (url === '/catalogos') {
        return Promise.resolve({ data: mockCatalogos })
      }
      if (url === '/auth/mi-acceso') {
        return Promise.resolve({ data: mockAcceso })
      }
      if (url === '/auth/me') {
        return Promise.resolve({
          data: { user: { sector_id: 'Compras', centro_id: '1001' } },
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado inicial', () => {
    it('debe renderizar el componente', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument()
      })
    })

    it('debe mostrar el título "NUEVA SOLICITUD"', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByText('NUEVA SOLICITUD')).toBeInTheDocument()
      })
    })

    it('debe mostrar skeleton mientras carga', () => {
      renderWithRouter(<CreateSolicitud />)
      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('debe cargar los catálogos al montar', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/catalogos', expect.any(Object))
        expect(api.get).toHaveBeenCalledWith('/auth/mi-acceso', expect.any(Object))
      })
    })
  })

  describe('Campos del formulario', () => {
    it('debe renderizar todos los campos requeridos', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('select-centro')).toBeInTheDocument()
        expect(screen.getByTestId('select-sector')).toBeInTheDocument()
        expect(screen.getByTestId('input-centro_costos')).toBeInTheDocument()
        expect(screen.getByTestId('select-almacen_virtual')).toBeInTheDocument()
        expect(screen.getByTestId('select-criticidad')).toBeInTheDocument()
        expect(screen.getByTestId('input-fecha_necesidad')).toBeInTheDocument()
      })
    })

    it('debe mostrar las opciones de centro cargadas', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const centroSelect = screen.getByTestId('select-centro')
        expect(centroSelect).toBeInTheDocument()
        // Verificar que contiene las opciones
        expect(centroSelect.innerHTML).toContain('Centro Buenos Aires')
      })
    })

    it('debe mostrar las opciones de criticidad', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const criticidadSelect = screen.getByTestId('select-criticidad')
        expect(criticidadSelect).toBeInTheDocument()
        expect(criticidadSelect.innerHTML).toContain('Normal')
        expect(criticidadSelect.innerHTML).toContain('Alta')
        expect(criticidadSelect.innerHTML).toContain('Crítica')
      })
    })

    it('debe tener fecha por defecto (+120 días)', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const fechaInput = screen.getByTestId('input-fecha_necesidad')
        expect(fechaInput.value).toBeTruthy()

        // Verificar que la fecha es aproximadamente 120 días en el futuro
        const expectedDate = new Date()
        expectedDate.setDate(expectedDate.getDate() + 120)
        const expectedStr = expectedDate.toISOString().slice(0, 10)
        expect(fechaInput.value).toBe(expectedStr)
      })
    })
  })

  describe('Validación del formulario', () => {
    it('debe requerir centro', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const centroSelect = screen.getByTestId('select-centro')
        expect(centroSelect).toHaveAttribute('required')
      })
    })

    it('debe requerir sector', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const sectorSelect = screen.getByTestId('select-sector')
        expect(sectorSelect).toHaveAttribute('required')
      })
    })

    it('debe requerir justificación', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const justificacionTextarea = screen.getByLabelText('Justificación')
        expect(justificacionTextarea).toHaveAttribute('required')
      })
    })
  })

  describe('Interacción con el formulario', () => {
    it('debe actualizar el estado al cambiar centro', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const centroSelect = screen.getByTestId('select-centro')
        fireEvent.change(centroSelect, { target: { value: '1001', name: 'centro' } })
        expect(centroSelect.value).toBe('1001')
      })
    })

    it('debe actualizar el estado al cambiar sector', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const sectorSelect = screen.getByTestId('select-sector')
        fireEvent.change(sectorSelect, { target: { value: 'Compras', name: 'sector' } })
        expect(sectorSelect.value).toBe('Compras')
      })
    })

    it('debe actualizar el estado al cambiar criticidad', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const criticidadSelect = screen.getByTestId('select-criticidad')
        fireEvent.change(criticidadSelect, { target: { value: 'Alta', name: 'criticidad' } })
        expect(criticidadSelect.value).toBe('Alta')
      })
    })

    it('debe actualizar el estado al cambiar justificación', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const justificacionTextarea = screen.getByLabelText('Justificación')
        fireEvent.change(justificacionTextarea, {
          target: { value: 'Materiales urgentes', name: 'justificacion' },
        })
        expect(justificacionTextarea.value).toBe('Materiales urgentes')
      })
    })
  })

  describe('Envío del formulario', () => {
    it('debe enviar el formulario con datos válidos (sin archivos)', async () => {
      spm.solicitudes.crear.mockResolvedValue({
        data: { id: 123, solicitud: { id: 123 } },
      })

      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('select-centro')).toBeInTheDocument()
      })

      // Llenar formulario
      const centroSelect = screen.getByTestId('select-centro')
      const sectorSelect = screen.getByTestId('select-sector')
      const almacenSelect = screen.getByTestId('select-almacen_virtual')
      const centroCostosInput = screen.getByTestId('input-centro_costos')
      const justificacionTextarea = screen.getByLabelText('Justificación')

      fireEvent.change(centroSelect, { target: { value: '1001', name: 'centro' } })
      fireEvent.change(sectorSelect, { target: { value: 'Compras', name: 'sector' } })
      fireEvent.change(almacenSelect, { target: { value: 'ALM001', name: 'almacen_virtual' } })
      fireEvent.change(centroCostosInput, { target: { value: 'CC001', name: 'centro_costos' } })
      fireEvent.change(justificacionTextarea, {
        target: { value: 'Necesitamos materiales', name: 'justificacion' },
      })

      // Submit
      const submitButton = screen.getByText('Crear y agregar materiales')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(spm.solicitudes.crear).toHaveBeenCalledWith(
          expect.objectContaining({
            centro: '1001',
            sector: 'Compras',
            almacen_virtual: 'ALM001',
            centro_costos: 'CC001',
            justificacion: 'Necesitamos materiales',
            criticidad: 'Normal',
            usuario_id: 1,
          })
        )
      })
    })

    it('debe navegar a agregar materiales después de crear', async () => {
      spm.solicitudes.crear.mockResolvedValue({
        data: { id: 123 },
      })

      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('select-centro')).toBeInTheDocument()
      })

      // Llenar y enviar formulario
      fireEvent.change(screen.getByTestId('select-centro'), { target: { value: '1001', name: 'centro' } })
      fireEvent.change(screen.getByTestId('select-sector'), { target: { value: 'Compras', name: 'sector' } })
      fireEvent.change(screen.getByTestId('select-almacen_virtual'), { target: { value: 'ALM001', name: 'almacen_virtual' } })
      fireEvent.change(screen.getByTestId('input-centro_costos'), { target: { value: 'CC001', name: 'centro_costos' } })
      fireEvent.change(screen.getByLabelText('Justificación'), {
        target: { value: 'Test', name: 'justificacion' },
      })

      fireEvent.click(screen.getByText('Crear y agregar materiales'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/123/materiales')
      })
    })

    it('debe mostrar error si falla el envío', async () => {
      spm.solicitudes.crear.mockRejectedValue({
        response: { data: { error: { message: 'Error al crear solicitud' } } },
      })

      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('select-centro')).toBeInTheDocument()
      })

      // Llenar y enviar formulario
      fireEvent.change(screen.getByTestId('select-centro'), { target: { value: '1001', name: 'centro' } })
      fireEvent.change(screen.getByTestId('select-sector'), { target: { value: 'Compras', name: 'sector' } })
      fireEvent.change(screen.getByTestId('select-almacen_virtual'), { target: { value: 'ALM001', name: 'almacen_virtual' } })
      fireEvent.change(screen.getByTestId('input-centro_costos'), { target: { value: 'CC001', name: 'centro_costos' } })
      fireEvent.change(screen.getByLabelText('Justificación'), {
        target: { value: 'Test', name: 'justificacion' },
      })

      fireEvent.click(screen.getByText('Crear y agregar materiales'))

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText('Error al crear solicitud')).toBeInTheDocument()
      })
    })
  })

  describe('Botón Cancelar', () => {
    it('debe navegar al dashboard al cancelar', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancelar'))
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('Archivos adjuntos', () => {
    it('debe mostrar el componente de carga de archivos', async () => {
      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('file-uploader')).toBeInTheDocument()
      })
    })

    it('debe usar FormData cuando hay archivos adjuntos', async () => {
      spm.solicitudes.crearConArchivos.mockResolvedValue({
        data: { id: 123 },
      })

      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        expect(screen.getByTestId('select-centro')).toBeInTheDocument()
      })

      // Llenar formulario
      fireEvent.change(screen.getByTestId('select-centro'), { target: { value: '1001', name: 'centro' } })
      fireEvent.change(screen.getByTestId('select-sector'), { target: { value: 'Compras', name: 'sector' } })
      fireEvent.change(screen.getByTestId('select-almacen_virtual'), { target: { value: 'ALM001', name: 'almacen_virtual' } })
      fireEvent.change(screen.getByTestId('input-centro_costos'), { target: { value: 'CC001', name: 'centro_costos' } })
      fireEvent.change(screen.getByLabelText('Justificación'), {
        target: { value: 'Test', name: 'justificacion' },
      })

      // Simular carga de archivo
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const fileUploader = screen.getByTestId('file-uploader')

      Object.defineProperty(fileUploader, 'files', {
        value: [file],
        writable: false,
      })

      fireEvent.change(fileUploader)

      // Submit
      fireEvent.click(screen.getByText('Crear y agregar materiales'))

      await waitFor(() => {
        expect(spm.solicitudes.crearConArchivos).toHaveBeenCalled()
      })
    })
  })

  describe('Pre-carga de datos del usuario', () => {
    it('debe pre-cargar sector y centro del usuario', async () => {
      api.get = vi.fn((url) => {
        if (url === '/catalogos') {
          return Promise.resolve({ data: mockCatalogos })
        }
        if (url === '/auth/mi-acceso') {
          return Promise.resolve({ data: mockAcceso })
        }
        if (url === '/auth/me') {
          return Promise.resolve({
            data: { user: { sector_id: 'Compras', centro_id: '1001' } },
          })
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })

      renderWithRouter(<CreateSolicitud />)

      await waitFor(() => {
        const centroSelect = screen.getByTestId('select-centro')
        const sectorSelect = screen.getByTestId('select-sector')

        // Los valores deberían estar pre-cargados
        expect(centroSelect.value).toBe('1001')
        expect(sectorSelect.value).toBe('Compras')
      }, { timeout: 3000 })
    })
  })
})
