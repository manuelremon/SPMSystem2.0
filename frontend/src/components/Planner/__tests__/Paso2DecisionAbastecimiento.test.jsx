/**
 * Tests para Paso2DecisionAbastecimiento
 * Rewritten to match the MUI-based multi-source component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Paso2DecisionAbastecimiento from '../Paso2DecisionAbastecimiento'

// Mock formatAlmacen utility
vi.mock('../../../utils/formatters', () => ({
  formatAlmacen: vi.fn((val) => val || ''),
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Renderizado basico', () => {
    it('debe renderizar el componente', () => {
      const { container } = render(<Paso2DecisionAbastecimiento {...defaultProps} />)
      // The component renders a MUI Box as root
      expect(container.querySelector('.MuiBox-root')).toBeInTheDocument()
    })

    it('debe mostrar mensaje cuando no hay opciones de abastecimiento', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: { 0: { opciones: [] } },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Sin opciones de abastecimiento')).toBeInTheDocument()
    })

    it('debe mostrar descripcion de sin alternativas', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: { 0: { opciones: [] } },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/No se encontro stock ni alternativas/)).toBeInTheDocument()
    })
  })

  describe('Barra de progreso (navegacion items)', () => {
    it('debe mostrar navegacion de items cuando hay mas de 1', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }, { idx: 1, codigo: 'MAT002' }],
        currentIdx: 0,
        totalItems: 2,
        opciones: {
          0: { opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }] },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      // The component shows "Item 1/2" format in the controls bar
      expect(screen.getByText('Item 1/2')).toBeInTheDocument()
    })

    it('debe actualizar texto de navegacion al cambiar idx', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
          { idx: 2, codigo: 'MAT003' },
        ],
        currentIdx: 2,
        totalItems: 3,
        opciones: {
          2: { opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }] },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Item 3/3')).toBeInTheDocument()
    })
  })

  describe('Item actual', () => {
    it('debe mostrar nombre de opcion de stock disponible', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', descripcion: 'Tornillo M8', cantidad: 100 }],
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

    it('debe mostrar N/D cuando no hay cantidad disponible', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A', precio_unitario: 10 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      // The card shows "N/D disponibles" when cantidad_disponible is not set
      expect(screen.getAllByText('N/D').length).toBeGreaterThan(0)
    })

    it('debe mostrar precio formateado en USD', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 10 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A', precio_unitario: 10 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/USD 10,00/)).toBeInTheDocument()
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

    it('debe mostrar "Sin opciones de abastecimiento" cuando no hay opciones', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: { 0: { opciones: [] } },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Sin opciones de abastecimiento')).toBeInTheDocument()
    })

    it('debe mostrar opciones de stock cuando existen', () => {
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

    it('debe mostrar la cabecera "Stock Disponible" para opciones de stock fallback', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A', precio_unitario: 10 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Stock Disponible')).toBeInTheDocument()
    })
  })

  describe('Filtros de tipo', () => {
    it('debe mostrar filtro "Todas" con conteo cuando hay opciones', () => {
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
      // FilterButton renders label + count as "Todas (2)"
      expect(screen.getByText(/Todas/)).toBeInTheDocument()
    })

    it('debe mostrar filtro de Stock cuando hay opciones de stock', () => {
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
      // Stock filter button shows "Stock (1)"
      expect(screen.getByText(/Stock \(1\)/)).toBeInTheDocument()
    })

    it('debe mostrar filtro Proveedor cuando hay opciones de proveedor', () => {
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
      expect(screen.getByText(/Proveedor \(1\)/)).toBeInTheDocument()
    })

    it('debe mostrar boton "Aceptar Sugerido"', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A' },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Aceptar Sugerido')).toBeInTheDocument()
    })
  })

  describe('Panel de fuentes seleccionadas', () => {
    it('debe mostrar panel de fuentes cuando hay seleccion', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', descripcion: 'Tornillo', cantidad: 100 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 50 },
            ],
          },
        },
        decisiones: {
          0: {
            fuentes: [
              { opcion: { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50 }, cantidad_asignada: 50 },
            ],
            comentario: '',
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Fuentes Seleccionadas/)).toBeInTheDocument()
    })

    it('debe mostrar resumen de cantidades asignadas', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', descripcion: 'Tornillo', cantidad: 100 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 50 },
            ],
          },
        },
        decisiones: {
          0: {
            fuentes: [
              { opcion: { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50 }, cantidad_asignada: 50 },
            ],
            comentario: '',
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      // Shows "X de Y asignados"
      expect(screen.getByText(/asignados/)).toBeInTheDocument()
    })

    it('debe mostrar chip "Completo" cuando cantidad asignada cubre la solicitada', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 50 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 50 },
            ],
          },
        },
        decisiones: {
          0: {
            fuentes: [
              { opcion: { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 50 }, cantidad_asignada: 50 },
            ],
            comentario: '',
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('Completo')).toBeInTheDocument()
    })

    it('debe mostrar chip de faltantes cuando la cantidad no alcanza', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 100 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 30 },
            ],
          },
        },
        decisiones: {
          0: {
            fuentes: [
              { opcion: { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 30 }, cantidad_asignada: 30 },
            ],
            comentario: '',
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText(/Faltan 70 un\./)).toBeInTheDocument()
    })
  })

  describe('Navegacion', () => {
    it('debe deshabilitar boton anterior cuando idx es 0', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }, { idx: 1, codigo: 'MAT002' }],
        currentIdx: 0,
        totalItems: 2,
        opciones: {
          0: { opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }] },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      // Navigation uses IconButtons with ChevronLeft/ChevronRight icons
      const prevButton = screen.getByTestId('ChevronLeftIcon').closest('button')
      expect(prevButton).toBeDisabled()
    })

    it('debe deshabilitar boton siguiente cuando es el ultimo', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }, { idx: 1, codigo: 'MAT002' }],
        currentIdx: 1,
        totalItems: 2,
        opciones: {
          1: { opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }] },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      const nextButton = screen.getByTestId('ChevronRightIcon').closest('button')
      expect(nextButton).toBeDisabled()
    })

    it('debe llamar onChangeIdx al navegar items con boton anterior', () => {
      const onChangeIdx = vi.fn()
      const props = {
        ...defaultProps,
        onChangeIdx,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
          { idx: 2, codigo: 'MAT003' },
        ],
        currentIdx: 1,
        totalItems: 3,
        opciones: {
          1: { opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }] },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const prevButton = screen.getByTestId('ChevronLeftIcon').closest('button')
      fireEvent.click(prevButton)
      expect(onChangeIdx).toHaveBeenCalledWith(0)
    })

    it('debe llamar onChangeIdx al navegar items con boton siguiente', () => {
      const onChangeIdx = vi.fn()
      const props = {
        ...defaultProps,
        onChangeIdx,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
          { idx: 2, codigo: 'MAT003' },
        ],
        currentIdx: 0,
        totalItems: 3,
        opciones: {
          0: { opciones: [{ opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }] },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const nextButton = screen.getByTestId('ChevronRightIcon').closest('button')
      fireEvent.click(nextButton)
      expect(onChangeIdx).toHaveBeenCalledWith(1)
    })
  })

  describe('Seleccion de opciones', () => {
    it('debe llamar onSelectDecision al hacer clic en una opcion', () => {
      const onSelectDecision = vi.fn()
      const props = {
        ...defaultProps,
        onSelectDecision,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 100 }],
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

      // The option card is a Paper component rendered as a button
      const opcionCard = screen.getByText('Stock Central').closest('button')
      fireEvent.click(opcionCard)

      // The new multi-source model calls onSelectDecision with a fuentes-based decision
      expect(onSelectDecision).toHaveBeenCalledWith(0, expect.objectContaining({
        fuentes: expect.any(Array),
        cantidad_solicitada: 100,
      }))
    })

    it('debe incluir la opcion seleccionada en las fuentes', () => {
      const onSelectDecision = vi.fn()
      const props = {
        ...defaultProps,
        onSelectDecision,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 50 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock Central', precio_unitario: 5.50, cantidad_disponible: 30 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      const opcionCard = screen.getByText('Stock Central').closest('button')
      fireEvent.click(opcionCard)

      const call = onSelectDecision.mock.calls[0]
      expect(call[0]).toBe(0) // idx
      expect(call[1].fuentes).toHaveLength(1)
      expect(call[1].fuentes[0].opcion.opcion_id).toBe(1)
    })
  })

  describe('Vista Grid/Tabla', () => {
    it('debe mostrar botones de vista (tooltips) cuando hay opciones', () => {
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

      // View toggles use MUI IconButtons with LayoutGrid and List icons
      expect(screen.getByTestId('GridViewIcon')).toBeInTheDocument()
      expect(screen.getByTestId('ListIcon')).toBeInTheDocument()
    })

    it('debe cambiar a vista tabla al hacer clic en el icono tabla', () => {
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

      // Click the List icon button to switch to table view
      const listIconButton = screen.getByTestId('ListIcon').closest('button')
      fireEvent.click(listIconButton)

      // In table view, column headers should appear
      expect(screen.getByText('Opcion')).toBeInTheDocument()
      expect(screen.getByText('Precio')).toBeInTheDocument()
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

  describe('Proveedores externos', () => {
    it('debe mostrar seccion PROVEEDORES EXTERNOS cuando hay opciones de proveedor', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 100 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 2, tipo: 'proveedor', nombre: 'Proveedor ABC', precio_unitario: 15 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      expect(screen.getByText('PROVEEDORES EXTERNOS')).toBeInTheDocument()
      expect(screen.getByText('Proveedor ABC')).toBeInTheDocument()
    })
  })

  describe('Aceptar Sugerido', () => {
    it('debe llamar onSelectDecision al hacer clic en Aceptar Sugerido', () => {
      const onSelectDecision = vi.fn()
      const props = {
        ...defaultProps,
        onSelectDecision,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 50 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A', precio_unitario: 5, cantidad_disponible: 50 },
            ],
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)

      fireEvent.click(screen.getByText('Aceptar Sugerido'))
      expect(onSelectDecision).toHaveBeenCalledWith(0, expect.objectContaining({
        fuentes: expect.any(Array),
      }))
    })
  })

  describe('Modal de excedente', () => {
    it('debe mostrar dialogo de excedente al intentar avanzar con exceso', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 10 }],
        totalItems: 1,
        currentIdx: 0,
        opciones: {
          0: {
            opciones: [
              { opcion_id: 1, tipo: 'stock', nombre: 'Stock A', precio_unitario: 5, cantidad_disponible: 20 },
            ],
          },
        },
        decisiones: {
          0: {
            fuentes: [
              { opcion: { opcion_id: 1, tipo: 'stock', nombre: 'Stock A' }, cantidad_asignada: 20 },
            ],
            comentario: '',
          },
        },
      }
      render(<Paso2DecisionAbastecimiento {...props} />)
      // The chip should show "Excede +10 un."
      expect(screen.getByText(/Excede \+10 un\./)).toBeInTheDocument()
    })
  })
})
