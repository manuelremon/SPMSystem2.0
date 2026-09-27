import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MaterialResultadoCard from '../MaterialResultadoCard'
import EquivalenciasResultado from '../EquivalenciasResultado'

const mockT = (key, fallback) => fallback || key
vi.mock('../../../context/i18n', () => ({ useI18n: () => ({ t: mockT }) }))

const MATERIAL = { codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad: 'UNI', precio_usd: 80.87, cant_equivalencias: 2 }

describe('MaterialResultadoCard', () => {
  it('muestra datos y dispara acciones', () => {
    const onVer = vi.fn(); const onFiltrar = vi.fn(); const onAgregar = vi.fn()
    render(<MaterialResultadoCard material={MATERIAL} onVerEquivalentes={onVer} onFiltrar={onFiltrar} onAgregar={onAgregar} puedeAgregar />)
    expect(screen.getByText('0101-0000080')).toBeInTheDocument()
    expect(screen.getByText('BOMBA CENTRIF./REP')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ver equivalentes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Filtrar tabla/ }))
    fireEvent.click(screen.getByRole('button', { name: /Agregar a solicitud/ }))
    expect(onVer).toHaveBeenCalledWith('0101-0000080')
    expect(onFiltrar).toHaveBeenCalledWith('0101-0000080')
    expect(onAgregar).toHaveBeenCalledWith(MATERIAL, expect.anything())
  })

  it('oculta Ver equivalentes si no tiene y Agregar si no puede', () => {
    render(<MaterialResultadoCard material={{ ...MATERIAL, cant_equivalencias: 0 }} onVerEquivalentes={vi.fn()} onFiltrar={vi.fn()} onAgregar={vi.fn()} puedeAgregar={false} />)
    expect(screen.queryByRole('button', { name: /Ver equivalentes/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Agregar a solicitud/ })).not.toBeInTheDocument()
  })
})

describe('EquivalenciasResultado', () => {
  it('muestra grupos con compatibilidad y motivo', () => {
    const equivalencias = {
      material: MATERIAL,
      grupos: [
        { tipo: 'E1_ESTRICTA', compatibilidad_pct: 95, total: 1, items: [{ codigo: '0101-0000090', descripcion: 'BOMBA DOSIFICADORA', criterio: 'Norma', motivo: 'Misma norma', unidad: 'UNI', precio_usd: 300 }] },
        { tipo: 'E2_SUPLIBLE', compatibilidad_pct: 85, total: 12, items: [{ codigo: '0101-0000081', descripcion: 'BOMBA CENTRIF. 2HP', criterio: '', motivo: '', unidad: 'UNI', precio_usd: 150 }] },
      ],
    }
    render(<EquivalenciasResultado equivalencias={equivalencias} onVerEquivalentes={vi.fn()} onFiltrar={vi.fn()} onAgregar={vi.fn()} puedeAgregar />)
    expect(screen.getByText(/Estricta/)).toBeInTheDocument()
    expect(screen.getByText(/95%/)).toBeInTheDocument()
    expect(screen.getByText(/Misma norma/)).toBeInTheDocument()
    expect(screen.getByText(/Mostrando 1 de 12/)).toBeInTheDocument()
  })

  it('sin grupos muestra aviso', () => {
    render(<EquivalenciasResultado equivalencias={{ material: MATERIAL, grupos: [] }} onVerEquivalentes={vi.fn()} onFiltrar={vi.fn()} onAgregar={vi.fn()} />)
    expect(screen.getByText(/no tiene equivalencias registradas/)).toBeInTheDocument()
  })
})
