import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EquivalenciaDeleteModal from '../EquivalenciaDeleteModal'
import EquivalenciaFormModal from '../EquivalenciaFormModal'
import { equivalencias } from '../../../services/spm'

vi.mock('../../../services/spm', () => ({
  equivalencias: { eliminar: vi.fn(), actualizar: vi.fn(), crear: vi.fn() },
  materiales: { buscar: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}))
const mockT = (key, fallback) => fallback || key
vi.mock('../../../context/i18n', () => ({ useI18n: () => ({ t: mockT }) }))

const ITEM = { id: 7, codigo_original: '0101-0000080', codigo_equivalente: '0101-0000081', tipo_equivalencia: 'E1_ESTRICTA' }
const errorHttp = (status) => Object.assign(new Error('http'), { response: { status } })
const YA_NO_EXISTE = 'La equivalencia ya no existe; se actualizó la lista.'
const SIN_PERMISO = 'No tienes permiso para gestionar equivalencias.'

describe('EquivalenciaDeleteModal', () => {
  beforeEach(() => vi.clearAllMocks())
  const abrir = () => {
    const props = { onClose: vi.fn(), onDeleted: vi.fn() }
    render(<EquivalenciaDeleteModal open item={ITEM} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    return props
  }

  it('404 (ya borrada): cierra y recarga la lista via onDeleted', async () => {
    equivalencias.eliminar.mockRejectedValue(errorHttp(404))
    const { onDeleted } = abrir()
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(YA_NO_EXISTE))
  })

  it('403: muestra "No tienes permiso" y no cierra', async () => {
    equivalencias.eliminar.mockRejectedValue(errorHttp(403))
    const { onDeleted } = abrir()
    expect(await screen.findByText(SIN_PERMISO)).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})

describe('EquivalenciaFormModal (editar)', () => {
  beforeEach(() => vi.clearAllMocks())
  const abrir = () => {
    const props = { onClose: vi.fn(), onSaved: vi.fn() }
    render(<EquivalenciaFormModal open item={ITEM} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    return props
  }

  it('404 (ya borrada): cierra y recarga la lista via onSaved', async () => {
    equivalencias.actualizar.mockRejectedValue(errorHttp(404))
    const { onSaved } = abrir()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(YA_NO_EXISTE))
  })

  it('403: muestra "No tienes permiso" y no cierra', async () => {
    equivalencias.actualizar.mockRejectedValue(errorHttp(403))
    const { onSaved } = abrir()
    expect(await screen.findByText(SIN_PERMISO)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
