import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgregarASolicitudMenu, { sumarMaterial } from '../AgregarASolicitudMenu'
import { solicitudes } from '../../../services/spm'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('../../../services/spm', () => ({
  solicitudes: { listar: vi.fn(), obtener: vi.fn(), guardarBorrador: vi.fn() },
}))
vi.mock('../../../store/authStore', () => ({ useUser: () => ({ id: '901' }) }))
const mockT = (key, fallback) => fallback || key
vi.mock('../../../context/i18n', () => ({ useI18n: () => ({ t: mockT }) }))

const MATERIAL = { codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad: 'UNI' }
const BORRADORES = [
  { id: 871, id_usuario: '901', justificacion: 'Prueba', items: [{}, {}] },
  { id: 500, id_usuario: '75', justificacion: 'Ajena', items: [] },
]

describe('sumarMaterial', () => {
  it('suma 1 si ya existe (acepta material_id) y agrega si no', () => {
    expect(sumarMaterial([{ material_id: '0101-0000080', cantidad: 2, unidad: 'UNI' }], MATERIAL)).toEqual([
      { material_id: '0101-0000080', codigo: '0101-0000080', cantidad: 3, unidad: 'UNI' },
    ])
    expect(sumarMaterial([], MATERIAL)).toEqual([
      { codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad: 'UNI', cantidad: 1 },
    ])
  })
})

describe('AgregarASolicitudMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    solicitudes.listar.mockResolvedValue({ data: { solicitudes: BORRADORES } })
  })

  const abrir = (props = {}) =>
    render(<AgregarASolicitudMenu material={MATERIAL} anchorEl={document.body} onClose={vi.fn()} onAviso={vi.fn()} {...props} />)

  it('lista solo los borradores propios', async () => {
    abrir()
    expect(await screen.findByText(/#871/)).toBeInTheDocument()
    expect(screen.queryByText(/#500/)).not.toBeInTheDocument()
    expect(solicitudes.listar).toHaveBeenCalledWith({ user_id: '901', estado: 'draft', page_size: 5 })
  })

  it('agrega al borrador con PATCH y avisa', async () => {
    solicitudes.obtener.mockResolvedValue({ data: { solicitud: { id: 871, items: [] } } })
    solicitudes.guardarBorrador.mockResolvedValue({ data: {} })
    const onAviso = vi.fn()
    abrir({ onAviso })
    fireEvent.click(await screen.findByText(/#871/))
    await waitFor(() => expect(solicitudes.guardarBorrador).toHaveBeenCalledWith(871, [
      { codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad: 'UNI', cantidad: 1 },
    ]))
    expect(onAviso).toHaveBeenCalledWith({ tipo: 'success', solicitudId: 871 })
  })

  it('avisa error si falla el guardado', async () => {
    solicitudes.obtener.mockResolvedValue({ data: { solicitud: { id: 871, items: [] } } })
    solicitudes.guardarBorrador.mockRejectedValue({ response: { data: { error: { message: 'Solo borradores' } } } })
    const onAviso = vi.fn()
    abrir({ onAviso })
    fireEvent.click(await screen.findByText(/#871/))
    await waitFor(() => expect(onAviso).toHaveBeenCalledWith({ tipo: 'error', mensaje: 'Solo borradores' }))
  })

  it('nueva solicitud precarga el material y navega', async () => {
    abrir()
    fireEvent.click(await screen.findByText('Nueva solicitud'))
    expect(sessionStorage.setItem).toHaveBeenCalledWith('suggested_items', JSON.stringify([
      { codigo: '0101-0000080', descripcion: 'BOMBA CENTRIF./REP', unidad: 'UNI', cantidad: 1 },
    ]))
    expect(mockNavigate).toHaveBeenCalledWith('/solicitudes/nueva')
  })
})
