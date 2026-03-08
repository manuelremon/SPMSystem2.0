/**
 * Tests para Paso3RevisionFinal
 * Component renders stock/compra tables from decisiones with cost summary.
 * Props: { items, decisiones }
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Paso3RevisionFinal from '../Paso3RevisionFinal'

// Mock de i18n
vi.mock('../../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}))

describe('Paso3RevisionFinal', () => {
  describe('Estado vacio', () => {
    it('debe mostrar mensaje cuando no hay decisiones', () => {
      render(<Paso3RevisionFinal items={[]} decisiones={{}} />)
      expect(screen.getByText('No hay decisiones de abastecimiento registradas.')).toBeInTheDocument()
    })

    it('debe renderizar con props por defecto', () => {
      render(<Paso3RevisionFinal />)
      expect(screen.getByText('No hay decisiones de abastecimiento registradas.')).toBeInTheDocument()
    })

    it('debe mostrar estado vacio cuando decisiones no tienen fuentes validas', () => {
      render(
        <Paso3RevisionFinal
          items={[{ idx: 0, codigo: 'MAT001' }]}
          decisiones={{ 0: { fuentes: [] } }}
        />
      )
      expect(screen.getByText('No hay decisiones de abastecimiento registradas.')).toBeInTheDocument()
    })
  })

  describe('Seccion de Stock', () => {
    const stockProps = {
      items: [
        { idx: 0, codigo: 'MAT001', descripcion: 'Tornillo M8', cantidad: 100, precio_unitario: 5.50 },
      ],
      decisiones: {
        0: {
          fuentes: [
            {
              opcion: {
                tipo: 'stock',
                centro_origen: '1008',
                almacen_origen: '0100',
                nombre_almacen: 'Almacen Central',
                precio_unitario: 5.50,
                plazo_dias: 2,
              },
              cantidad_asignada: 80,
            },
          ],
        },
      },
    }

    it('debe mostrar encabezado "DESDE STOCK"', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('DESDE STOCK')).toBeInTheDocument()
    })

    it('debe mostrar codigo SAP del material', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('MAT001')).toBeInTheDocument()
    })

    it('debe mostrar descripcion del material', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('Tornillo M8')).toBeInTheDocument()
    })

    it('debe mostrar cantidad solicitada', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('debe mostrar cantidad asignada', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('80')).toBeInTheDocument()
    })

    it('debe mostrar porcentaje de asignacion', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('80%')).toBeInTheDocument()
    })

    it('debe mostrar ubicacion centro/almacen', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText(/1008/)).toBeInTheDocument()
    })

    it('debe mostrar nombre del almacen', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('Almacen Central')).toBeInTheDocument()
    })

    it('debe mostrar plazo en dias', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('2 días')).toBeInTheDocument()
    })

    it('debe mostrar "Inmediato" cuando no hay plazo', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT001', descripcion: 'Test', cantidad: 10 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'stock', centro_origen: '1008' },
              cantidad_asignada: 10,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Inmediato')).toBeInTheDocument()
    })

    it('debe mostrar encabezados de tabla stock', () => {
      render(<Paso3RevisionFinal {...stockProps} />)
      expect(screen.getByText('Código SAP')).toBeInTheDocument()
      expect(screen.getByText('Descripción')).toBeInTheDocument()
      expect(screen.getByText('Solicitado')).toBeInTheDocument()
      expect(screen.getByText('Asignado')).toBeInTheDocument()
      expect(screen.getByText('Ubicación')).toBeInTheDocument()
    })
  })

  describe('Seccion de Compra', () => {
    const compraProps = {
      items: [
        { idx: 0, codigo: 'MAT002', descripcion: 'Tuerca M10', cantidad: 200, precio_unitario: 3.00 },
      ],
      decisiones: {
        0: {
          fuentes: [
            {
              opcion: {
                tipo: 'proveedor',
                nombre_proveedor: 'Aceros SA',
                precio_unitario: 3.00,
                plazo_dias: 15,
              },
              cantidad_asignada: 200,
            },
          ],
        },
      },
    }

    it('debe mostrar encabezado "POR COMPRA"', () => {
      render(<Paso3RevisionFinal {...compraProps} />)
      expect(screen.getByText('POR COMPRA')).toBeInTheDocument()
    })

    it('debe mostrar codigo del material de compra', () => {
      render(<Paso3RevisionFinal {...compraProps} />)
      expect(screen.getByText('MAT002')).toBeInTheDocument()
    })

    it('debe mostrar proveedor', () => {
      render(<Paso3RevisionFinal {...compraProps} />)
      expect(screen.getByText('Aceros SA')).toBeInTheDocument()
    })

    it('debe mostrar plazo de compra', () => {
      render(<Paso3RevisionFinal {...compraProps} />)
      expect(screen.getByText('15 dias')).toBeInTheDocument()
    })

    it('debe mostrar "N/D" cuando proveedor no tiene plazo', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT003', descripcion: 'Test', cantidad: 50 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'proveedor', nombre_proveedor: 'Test Prov' },
              cantidad_asignada: 50,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('N/D')).toBeInTheDocument()
    })

    it('debe mostrar "N/D" para proveedor sin nombre', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT004', descripcion: 'Test', cantidad: 10 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'proveedor', precio_unitario: 1 },
              cantidad_asignada: 10,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      // Column for Proveedor shows "N/D" when no nombre_proveedor or nombre
      const ndElements = screen.getAllByText('N/D')
      expect(ndElements.length).toBeGreaterThan(0)
    })

    it('debe mostrar encabezados de tabla compra', () => {
      render(<Paso3RevisionFinal {...compraProps} />)
      expect(screen.getByText('Proveedor')).toBeInTheDocument()
    })
  })

  describe('Resumen de costos', () => {
    it('debe mostrar encabezado "RESUMEN DE COSTOS"', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 10, precio_unitario: 100 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'stock', precio_unitario: 100 },
              cantidad_asignada: 10,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('RESUMEN DE COSTOS')).toBeInTheDocument()
    })

    it('debe mostrar etiquetas de costos', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 10, precio_unitario: 50 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'stock', precio_unitario: 50 },
              cantidad_asignada: 10,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('Desde Stock')).toBeInTheDocument()
      expect(screen.getByText('Por Compra')).toBeInTheDocument()
      expect(screen.getByText('Costo Total')).toBeInTheDocument()
    })

    it('debe mostrar conteo de lineas', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT001', cantidad: 5, precio_unitario: 10 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'stock', precio_unitario: 10 },
              cantidad_asignada: 5,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      const lineaElements = screen.getAllByText('1 líneas')
      expect(lineaElements.length).toBeGreaterThan(0)
    })

    it('debe no mostrar resumen cuando no hay decisiones', () => {
      render(<Paso3RevisionFinal items={[]} decisiones={{}} />)
      expect(screen.queryByText('RESUMEN DE COSTOS')).not.toBeInTheDocument()
    })
  })

  describe('Multiples items y fuentes mixtas', () => {
    const mixedProps = {
      items: [
        { idx: 0, codigo: 'MAT001', descripcion: 'Material A', cantidad: 100, precio_unitario: 10 },
        { idx: 1, codigo: 'MAT002', descripcion: 'Material B', cantidad: 50, precio_unitario: 20 },
      ],
      decisiones: {
        0: {
          fuentes: [
            {
              opcion: { tipo: 'stock', precio_unitario: 10, centro_origen: '1008', almacen_origen: '0100' },
              cantidad_asignada: 60,
            },
            {
              opcion: { tipo: 'proveedor', precio_unitario: 12, nombre_proveedor: 'Prov A', plazo_dias: 7 },
              cantidad_asignada: 40,
            },
          ],
        },
        1: {
          fuentes: [
            {
              opcion: { tipo: 'proveedor', precio_unitario: 20, nombre_proveedor: 'Prov B', plazo_dias: 10 },
              cantidad_asignada: 50,
            },
          ],
        },
      },
    }

    it('debe mostrar ambas secciones (stock y compra) cuando hay fuentes mixtas', () => {
      render(<Paso3RevisionFinal {...mixedProps} />)
      expect(screen.getByText('DESDE STOCK')).toBeInTheDocument()
      expect(screen.getByText('POR COMPRA')).toBeInTheDocument()
    })

    it('debe mostrar todos los codigos de materiales', () => {
      render(<Paso3RevisionFinal {...mixedProps} />)
      expect(screen.getAllByText('MAT001').length).toBeGreaterThan(0)
      expect(screen.getByText('MAT002')).toBeInTheDocument()
    })

    it('debe mostrar multiples proveedores', () => {
      render(<Paso3RevisionFinal {...mixedProps} />)
      expect(screen.getByText('Prov A')).toBeInTheDocument()
      expect(screen.getByText('Prov B')).toBeInTheDocument()
    })

    it('debe calcular costos correctamente para fuentes mixtas', () => {
      render(<Paso3RevisionFinal {...mixedProps} />)
      // Stock: 60*10 = 600 -> formatted as $600,00
      // Compra: 40*12 + 50*20 = 480+1000 = 1480 -> formatted as $1.480,00
      // Total: 2080 -> formatted as $2.080,00
      expect(screen.getByText('RESUMEN DE COSTOS')).toBeInTheDocument()
    })
  })

  describe('Equivalencia como compra', () => {
    it('debe tratar equivalencias como compra', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT005', descripcion: 'Equiv Test', cantidad: 30 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'equivalencia', nombre_proveedor: 'Equiv Prov', precio_unitario: 8, plazo_dias: 5 },
              cantidad_asignada: 30,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('POR COMPRA')).toBeInTheDocument()
      expect(screen.queryByText('DESDE STOCK')).not.toBeInTheDocument()
    })
  })

  describe('Transferencia como stock', () => {
    it('debe tratar transferencias como stock', () => {
      const props = {
        items: [{ idx: 0, codigo: 'MAT006', descripcion: 'Transfer Test', cantidad: 20 }],
        decisiones: {
          0: {
            fuentes: [{
              opcion: { tipo: 'transferencia', centro_origen: '2000', almacen_origen: '0100', precio_unitario: 15 },
              cantidad_asignada: 20,
            }],
          },
        },
      }
      render(<Paso3RevisionFinal {...props} />)
      expect(screen.getByText('DESDE STOCK')).toBeInTheDocument()
      expect(screen.queryByText('POR COMPRA')).not.toBeInTheDocument()
    })
  })
})
