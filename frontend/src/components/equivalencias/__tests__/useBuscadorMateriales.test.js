import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBuscadorMateriales } from '../useBuscadorMateriales'
import { equivalencias } from '../../../services/spm'

vi.mock('../../../services/spm', () => ({ equivalencias: { asistente: vi.fn() } }))

const RESPUESTA = { ok: true, intencion: 'descripcion', consulta: 'bomba', materiales: [{ codigo: 'A' }], sugerencias: [] }

describe('useBuscadorMateriales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('agrega mensaje de usuario y respuesta del bot', async () => {
    equivalencias.asistente.mockResolvedValue({ data: RESPUESTA })
    const { result } = renderHook(() => useBuscadorMateriales())
    await act(() => result.current.enviar('  bomba  '))
    expect(equivalencias.asistente).toHaveBeenCalledWith('bomba')
    expect(result.current.mensajes.map((m) => m.rol)).toEqual(['usuario', 'bot'])
    expect(result.current.mensajes[1].respuesta).toEqual(RESPUESTA)
    expect(result.current.cargando).toBe(false)
  })

  it('ignora texto vacio', async () => {
    const { result } = renderHook(() => useBuscadorMateriales())
    await act(() => result.current.enviar('   '))
    expect(equivalencias.asistente).not.toHaveBeenCalled()
    expect(result.current.mensajes).toEqual([])
  })

  it('marca rate_limit con 429 y error generico en otros casos', async () => {
    equivalencias.asistente.mockRejectedValueOnce({ response: { status: 429 } })
    equivalencias.asistente.mockRejectedValueOnce(new Error('red'))
    const { result } = renderHook(() => useBuscadorMateriales())
    await act(() => result.current.enviar('a1'))
    await act(() => result.current.enviar('a2'))
    const errores = result.current.mensajes.filter((m) => m.error).map((m) => [m.error, m.consulta])
    expect(errores).toEqual([['rate_limit', 'a1'], ['error', 'a2']])
  })

  it('reintentar reemplaza el error por la nueva respuesta', async () => {
    equivalencias.asistente.mockRejectedValueOnce(new Error('red'))
    equivalencias.asistente.mockResolvedValueOnce({ data: RESPUESTA })
    const { result } = renderHook(() => useBuscadorMateriales())
    await act(() => result.current.enviar('bomba'))
    await act(() => result.current.reintentar('bomba'))
    expect(result.current.mensajes.map((m) => m.rol)).toEqual(['usuario', 'bot'])
    expect(result.current.mensajes[1].respuesta).toEqual(RESPUESTA)
  })

  it('limpiar vacia el historial', async () => {
    equivalencias.asistente.mockResolvedValue({ data: RESPUESTA })
    const { result } = renderHook(() => useBuscadorMateriales())
    await act(() => result.current.enviar('bomba'))
    act(() => result.current.limpiar())
    expect(result.current.mensajes).toEqual([])
  })
})
