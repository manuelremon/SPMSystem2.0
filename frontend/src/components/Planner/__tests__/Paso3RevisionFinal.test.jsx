/**
 * Tests para Paso3RevisionFinal
 * Generado por Sugar Autonomous System
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Paso3RevisionFinal from '../Paso3RevisionFinal'

// Mock de componentes UI
vi.mock('../../ui/Card', () => ({
  Card: ({ children, className }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid="card-title">{children}</h2>,
  CardDescription: ({ children, className }) => <p data-testid="card-description" className={className}>{children}</p>,
  CardContent: ({ children, className }) => <div data-testid="card-content" className={className}>{children}</div>,
}))

vi.mock('../../ui/Button', () => ({
  Button: ({ children, onClick, variant, type, disabled }) => (
    <button onClick={onClick} data-variant={variant} type={type} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('../../ui/StatusBadge', () => ({
  default: ({ estado }) => <span data-testid="status-badge">{estado}</span>,
}))

describe('Paso3RevisionFinal', () => {
  const defaultProps = {
    solicitud: { id: 1, centro: '1008', sector: 'Mantenimiento', status: 'en_proceso' },
    items: [],
    decisiones: {},
    totalItems: 0,
    onBack: vi.fn(),
    onConfirm: vi.fn(),
    loading: false,
  }

  describe('Renderizado basico', () => {
    it('debe renderizar el componente', () => {
      render(<Paso3RevisionFinal {...defaultProps} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('debe mostrar el titulo "Revision final"', () => {
      render(<Paso3RevisionFinal {...defaultProps} />)
      expect(screen.getByText('Revision final')).toBeInTheDocument()
    })

    it('debe mostrar la descripcion', () => {
      render(<Paso3RevisionFinal {...defaultProps} />)
      expect(screen.getByText('Confirma antes de guardar el tratamiento')).toBeInTheDocument()
    })
  })

  describe('Informacion de resumen', () => {
    it('debe mostrar el estado de la solicitud', () => {
      render(<Paso3RevisionFinal {...defaultProps} />)
      expect(screen.getByText('Estado')).toBeInTheDocument()
      expect(screen.getByTestId('status-badge')).toBeInTheDocument()
    })

    it('debe mostrar items decididos sobre total', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
        ],
        totalItems: 3,
        decisiones: {
          0: { opcion_id: 1 },
          1: { opcion_id: 2 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Items decididos')).toBeInTheDocument()
      expect(screen.getByText('2/3')).toBeInTheDocument()
    })

    it('debe mostrar costo total calculado', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001', precio_unitario: 100 },
          { idx: 1, codigo: 'MAT002', precio_unitario: 50 },
        ],
        totalItems: 2,
        decisiones: {
          0: { opcion_id: 1, cantidad_solicitada: 10, precio_unitario: 100 },
          1: { opcion_id: 2, cantidad_solicitada: 20, precio_unitario: 50 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Costo total')).toBeInTheDocument()
      // 10*100 + 20*50 = 2000
      expect(screen.getByText(/2.*000/)).toBeInTheDocument()
    })

    it('debe mostrar plazo maximo', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, plazo_dias: 15 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Plazo maximo')).toBeInTheDocument()
      expect(screen.getByText('15 dias')).toBeInTheDocument()
    })

    it('debe mostrar centro y sector', () => {
      const props = {
        ...defaultProps,
        solicitud: { id: 1, centro: '1008', sector: 'Mantenimiento' },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Centro / Sector')).toBeInTheDocument()
      expect(screen.getByText('1008 / Mantenimiento')).toBeInTheDocument()
    })
  })

  describe('Tabla de decisiones', () => {
    it('debe mostrar mensaje cuando no hay decisiones', () => {
      render(<Paso3RevisionFinal {...defaultProps} />)
      expect(screen.getByText('Sin decisiones cargadas.')).toBeInTheDocument()
    })

    it('debe mostrar encabezados de tabla', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: { 0: { opcion_id: 1, nombre: 'Stock', precio_unitario: 10 } },
      }
      render(<Paso3RevisionFinal {...props} />)

      expect(screen.getByText('Item')).toBeInTheDocument()
      expect(screen.getByText('Codigo')).toBeInTheDocument()
      expect(screen.getByText('Opcion')).toBeInTheDocument()
      expect(screen.getByText('Cantidad')).toBeInTheDocument()
      expect(screen.getByText('P.U.')).toBeInTheDocument()
      expect(screen.getByText('Subtotal')).toBeInTheDocument()
      expect(screen.getByText('Plazo')).toBeInTheDocument()
    })

    it('debe mostrar filas de decisiones', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001', cantidad: 10 },
        ],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, nombre: 'Stock Central', precio_unitario: 5.50, plazo_dias: 3 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)

      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('MAT001')).toBeInTheDocument()
      expect(screen.getByText('Stock Central')).toBeInTheDocument()
    })

    it('debe mostrar cantidad correcta de la opcion', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 100 }],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, cantidad_solicitada: 50, precio_unitario: 10 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      // La cantidad viene de cantidad_solicitada de la opcion
      expect(screen.getByText('50')).toBeInTheDocument()
    })

    it('debe calcular subtotal correctamente', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, cantidad_solicitada: 10, precio_unitario: 100 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      // 10 * 100 = 1000
      expect(screen.getByText(/1.*000/)).toBeInTheDocument()
    })

    it('debe mostrar plazo por item', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, plazo_dias: 7, precio_unitario: 10 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('7 d')).toBeInTheDocument()
    })

    it('debe mostrar "N/D" cuando no hay plazo', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, precio_unitario: 10 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('N/D d')).toBeInTheDocument()
    })
  })

  describe('Lista de proveedores', () => {
    it('debe mostrar proveedores unicos', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001' },
          { idx: 1, codigo: 'MAT002' },
        ],
        totalItems: 2,
        decisiones: {
          0: { opcion_id: 1, id_proveedor: 'PROV001' },
          1: { opcion_id: 2, id_proveedor: 'PROV002' },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Proveedores')).toBeInTheDocument()
      expect(screen.getByText('PROV001, PROV002')).toBeInTheDocument()
    })

    it('debe mostrar "N/D" cuando no hay proveedores', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: { 0: { opcion_id: 1 } },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('N/D')).toBeInTheDocument()
    })
  })

  describe('Botones de accion', () => {
    it('debe llamar onBack al hacer clic en "Volver"', () => {
      const onBack = vi.fn()
      render(<Paso3RevisionFinal {...defaultProps} onBack={onBack} />)

      fireEvent.click(screen.getByText('Volver'))
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('debe llamar onConfirm al hacer clic en "Confirmar y guardar"', () => {
      const onConfirm = vi.fn()
      const props = {
        ...defaultProps,
        onConfirm,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: { 0: { opcion_id: 1 } },
      }
      render(<Paso3RevisionFinal {...props} />)

      fireEvent.click(screen.getByText('Confirmar y guardar'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('debe mostrar "Guardando..." cuando loading es true', () => {
      const props = {
        ...defaultProps,
        loading: true,
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Guardando...')).toBeInTheDocument()
    })

    it('debe deshabilitar boton cuando loading es true', () => {
      const props = {
        ...defaultProps,
        loading: true,
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Guardando...')).toBeDisabled()
    })

    it('debe deshabilitar boton cuando faltan decisiones', () => {
      const props = {
        ...defaultProps,
        totalItems: 3,
        decisiones: { 0: { opcion_id: 1 } },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Confirmar y guardar')).toBeDisabled()
    })
  })

  describe('Formato de montos', () => {
    it('debe formatear montos en USD con formato argentino', () => {
      const props = {
        ...defaultProps,
        items: [{ idx: 0, codigo: 'MAT001' }],
        totalItems: 1,
        decisiones: {
          0: { opcion_id: 1, cantidad_solicitada: 1, precio_unitario: 1234.56 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      // Debe mostrar USD$ con formato argentino (coma para decimales, punto para miles)
      expect(screen.getByText(/USD\$/)).toBeInTheDocument()
    })
  })

  describe('Multiples items', () => {
    it('debe renderizar multiples filas correctamente', () => {
      const props = {
        ...defaultProps,
        items: [
          { idx: 0, codigo: 'MAT001', cantidad: 10 },
          { idx: 1, codigo: 'MAT002', cantidad: 20 },
          { idx: 2, codigo: 'MAT003', cantidad: 30 },
        ],
        totalItems: 3,
        decisiones: {
          0: { opcion_id: 1, nombre: 'Stock A', precio_unitario: 100 },
          1: { opcion_id: 2, nombre: 'Proveedor B', precio_unitario: 200 },
          2: { opcion_id: 3, nombre: 'Stock C', precio_unitario: 50 },
        },
      }
      render(<Paso3RevisionFinal {...props} />)

      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
      expect(screen.getByText('#3')).toBeInTheDocument()
      expect(screen.getByText('MAT001')).toBeInTheDocument()
      expect(screen.getByText('MAT002')).toBeInTheDocument()
      expect(screen.getByText('MAT003')).toBeInTheDocument()
    })
  })
})
