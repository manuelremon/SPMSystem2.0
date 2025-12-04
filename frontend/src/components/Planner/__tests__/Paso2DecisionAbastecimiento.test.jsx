/**
 * Tests para Paso2DecisionAbastecimiento
 * Generado por Sugar Autonomous System
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Paso2DecisionAbastecimiento from '../Paso2DecisionAbastecimiento'

// Mock de componentes UI
vi.mock('../../ui/Card', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children, className }) => <p data-testid="card-description" className={className}>{children}</p>,
  CardContent: ({ children, className }) => <div data-testid="card-content" className={className}>{children}</div>,
}))

vi.mock('../../ui/Button', () => ({
  Button: ({ children, onClick, variant, type, disabled, title }) => (
    <button onClick={onClick} data-variant={variant} type={type} disabled={disabled} title={title}>
      {children}
    </button>
  ),
}))

describe('Paso2DecisionAbastecimiento', () => {
  const defaultProps = {
    solicitud: { id: 1, centro: '1008', sector: 'Mantenimiento' },
    analisis: {},
    items: [],
    totalItems: 0,
    currentIdx: 0,
    onChangeIdx: vi.fn(),
    opciones: {},
    decisiones: {},
    onSelectDecision: vi.fn(),
    onFetchOpciones: vi.fn(),
    loadingOpciones: false,
    onPrev: vi.fn(),
    onNext: vi.fn(),
  }

  describe('Renderizado basico', () => {
    it('debe renderizar el componente', () => {
      render(<Paso2DecisionAbastecimiento {...defaultProps} />)
      expect(screen.getAllByTestId('card').length).toBeGreaterThan(0)
    })

    it('debe mostrar el titulo "Decision de abastecimiento"', () => {
      render(<Paso2DecisionAbastecimiento {...defaultProps} />)
      expect(screen.getByText('Decision de abastecimiento')).toBeInTheDocument()
    })

    it('debe mostrar la descripcion', () => {
      render(<Paso2DecisionAbastecimiento {...defaultProps} />)
      expect(screen.getByText('Selecciona la mejor opcion para cada material')).toBeInTheDocument()
    })
  })

  describe('Barra de progreso', () => {
    it('debe mostrar progreso correcto', () => {
      const props = {
        ...defaultProps,
        currentIdx: 0,
        totalItems: 5,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Item 1 de 5')).toBeInTheDocument()
      expect(screen.getByText('20%')).toBeInTheDocument()
    })

    it('debe actualizar progreso al cambiar idx', () => {
      const props = {
        ...defaultProps,
        currentIdx: 2,
        totalItems: 5,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Item 3 de 5')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
    })
  })

  describe('Item actual', () => {
    it('debe mostrar informacion del item actual', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001', descripcion: 'Tornillo M8', cantidad: 100, precio_unitario: 5.50 },
        ],
        totalItems: 1,
        currentIdx: 0,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/MAT001/)).toBeInTheDocument()
    })

    it('debe mostrar cantidad solicitada', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001', descripcion: 'Tornillo M8', cantidad: 100 },
        ],
        totalItems: 1,
        currentIdx: 0,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Cantidad solicitada: 100/)).toBeInTheDocument()
    })

    it('debe mostrar "N/D" cuando no hay cantidad', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Cantidad solicitada: N\/D/)).toBeInTheDocument()
    })
  })

  describe('Opciones de abastecimiento', () => {
    it('debe mostrar mensaje de carga cuando loadingOpciones es true', () => {
      const props = {
        ...defaultProps,
        loadingOpciones: true,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Cargando opciones...')).toBeInTheDocument()
    })

    it('debe mostrar "Sin opciones disponibles" cuando no hay opciones', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: { 0: { opciones: [] } },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Sin opciones disponibles para este item.')).toBeInTheDocument()
    })

    it('debe mostrar opciones cuando existen', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Almacen Central', precio_unitario: 5.50 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Stock Almacen Central')).toBeInTheDocument()
    })
  })

  describe('Filtros de tipo', () => {
    it('debe mostrar filtro "Todas" por defecto', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A' },
              { opcion_id: 2, tipo: 'proveedor', nombre: 'Proveedor B' },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Todas/)).toBeInTheDocument()
    })

    it('debe filtrar opciones por tipo al hacer clic', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A' },
              { opcion_id: 2, tipo: 'proveedor', nombre: 'Proveedor B' },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const stockFilter = screen.getByText(/Stock Interno/)
      fireEvent.click(stockFilter)

      expect(screen.getByText('Stock A')).toBeInTheDocument()
    })
  })

  describe('Resumen de decisiones', () => {
    it('debe mostrar "Resumen de decisiones"', () => {
      render(<Paso2DecisionAbastecimiento {...defaultProps} />)
      expect(screen.getByText('Resumen de decisiones')).toBeInTheDocument()
    })

    it('debe mostrar mensaje cuando no hay decisiones', () => {
      render(<Paso2DecisionAbastecimiento {...defaultProps} />)
      expect(screen.getByText('Aun no seleccionaste opciones.')).toBeInTheDocument()
    })

    it('debe mostrar decisiones seleccionadas', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', descripcion: 'Tornillo' }],
        totalItems: 1,
        currentIdx: 0,
        decisiones: {
          0: { opcion_id: 1, nombre: 'Stock Central', precio_unitario: 5.50 },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('MAT001')).toBeInTheDocument()
    })

    it('debe mostrar porcentaje de progreso total', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
        ],
        totalItems: 2,
        decisiones: {
          0: { opcion_id: 1, nombre: 'Stock Central' },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Progreso total')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('debe mostrar alerta cuando faltan items', () => {
      const props = {
        ...defaultProps,
        totalItems: 3,
        decisiones: { 0: { opcion_id: 1 } },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Faltan 2 items por decidir/)).toBeInTheDocument()
    })

    it('debe mostrar mensaje de exito cuando todos decididos', () => {
      const props = {
        ...defaultProps,
        totalItems: 2,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
        ],
        decisiones: {
          0: { opcion_id: 1 },
          1: { opcion_id: 2 },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Todos los items decididos/)).toBeInTheDocument()
    })
  })

  describe('Navegacion', () => {
    it('debe llamar onPrev al hacer clic en "Volver"', () => {
      const onPrev = vi.fn()
      render(<Paso2DecisionAbastecimiento {...defaultProps} onPrev={onPrev} />)

      fireEvent.click(screen.getByText('Volver'))
      expect(onPrev).toHaveBeenCalledTimes(1)
    })

    it('debe deshabilitar "Item anterior" cuando idx es 0', () => {
      const props = {
        ...defaultProps,
        currentIdx: 0,
        totalItems: 3,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const prevButton = screen.getByText('Item anterior')
      expect(prevButton).toBeDisabled()
    })

    it('debe deshabilitar "Siguiente item" cuando es el ultimo', () => {
      const props = {
        ...defaultProps,
        currentIdx: 2,
        totalItems: 3,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const nextButton = screen.getByText('Siguiente item')
      expect(nextButton).toBeDisabled()
    })

    it('debe llamar onChangeIdx al navegar items', () => {
      const onChangeIdx = vi.fn()
      const props = {
        ...defaultProps,
        onChangeIdx,
        currentIdx: 1,
        totalItems: 3,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      fireEvent.click(screen.getByText('Item anterior'))
      expect(onChangeIdx).toHaveBeenCalledWith(0)
    })

    it('debe deshabilitar "Continuar" cuando faltan decisiones', () => {
      const props = {
        ...defaultProps,
        totalItems: 3,
        decisiones: {},
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const continueButton = screen.getByText(/Faltan 3 items/)
      expect(continueButton).toBeDisabled()
    })

    it('debe habilitar "Continuar" cuando todos decididos', () => {
      const props = {
        ...defaultProps,
        totalItems: 2,
        decisiones: {
          0: { opcion_id: 1 },
          1: { opcion_id: 2 },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const continueButton = screen.getByText('Continuar')
      expect(continueButton).not.toBeDisabled()
    })

    it('debe llamar onNext al hacer clic en Continuar', () => {
      const onNext = vi.fn()
      const props = {
        ...defaultProps,
        onNext,
        totalItems: 1,
        decisiones: { 0: { opcion_id: 1 } },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      fireEvent.click(screen.getByText('Continuar'))
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  describe('Seleccion de opciones', () => {
    it('debe llamar onSelectDecision al seleccionar opcion', () => {
      const onSelectDecision = vi.fn()
      const props = {
        ...defaultProps,
        onSelectDecision,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const opcionCard = screen.getByText('Stock Central').closest('button')
      fireEvent.click(opcionCard)

      expect(onSelectDecision).toHaveBeenCalledWith(0, expect.objectContaining({ opcion_id: 1 }))
    })
  })

  describe('Vista Grid/Tabla', () => {
    it('debe mostrar botones de vista cuando hay opciones', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      expect(screen.getByText('Vista Grid')).toBeInTheDocument()
      expect(screen.getByText('Vista Tabla')).toBeInTheDocument()
    })

    it('debe cambiar a vista tabla al hacer clic', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A', precio_unitario: 10 }],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      fireEvent.click(screen.getByText('Vista Tabla'))

      // En vista tabla debe haber encabezados de columna
      expect(screen.getByText('Seleccionar')).toBeInTheDocument()
    })
  })

  describe('Fetch opciones', () => {
    it('debe llamar onFetchOpciones al montar', () => {
      const onFetchOpciones = vi.fn()
      const props = {
        ...defaultProps,
        onFetchOpciones,
        currentIdx: 0,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      expect(onFetchOpciones).toHaveBeenCalledWith(0)
    })
  })

  describe('Informacion MRP', () => {
    it('debe mostrar badge MRP', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', mrp_planificado: true }],
        totalItems: 1,
        currentIdx: 0,
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      expect(screen.getByText(/MRP/)).toBeInTheDocument()
    })
  })
})
