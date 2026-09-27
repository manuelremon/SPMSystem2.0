import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMaterialCart } from '../useMaterialCart'

const mockT = (key, fallback) => fallback || key
vi.mock('../../context/i18n', () => ({ useI18n: () => ({ t: mockT }) }))

describe('useMaterialCart precarga', () => {
  beforeEach(() => {
    // El mock global de sessionStorage (frontend/src/test/setup.js) es un objeto
    // compartido con metodos vi.fn() sin implementacion (getItem devuelve undefined).
    // Le damos una implementacion en memoria solo para este test.
    const store = {}
    sessionStorage.getItem.mockImplementation((k) => (k in store ? store[k] : null))
    sessionStorage.setItem.mockImplementation((k, v) => {
      store[k] = String(v)
    })
    sessionStorage.removeItem.mockImplementation((k) => {
      delete store[k]
    })
  })

  afterEach(() => {
    sessionStorage.getItem.mockReset()
    sessionStorage.setItem.mockReset()
    sessionStorage.removeItem.mockReset()
  })

  it('aplica suggested_items despues de cargar los items iniciales', () => {
    sessionStorage.setItem('suggested_items', JSON.stringify([{ codigo: 'B', descripcion: 'Bomba', unidad: 'UNI', cantidad: 1 }]))
    const setActionMsg = vi.fn()
    const { result, rerender } = renderHook((props) => useMaterialCart(props), {
      initialProps: { initialItems: null, setActionMsg, setShowAssistant: vi.fn() },
    })
    expect(sessionStorage.getItem('suggested_items')).not.toBeNull() // aun no se consume
    act(() => rerender({ initialItems: [{ codigo: 'A', cantidad: 2, unidad: 'UNI' }], setActionMsg, setShowAssistant: vi.fn() }))
    expect(result.current.items.map((it) => it.codigo)).toEqual(['A', 'B'])
    expect(sessionStorage.getItem('suggested_items')).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('conserva el item sugerido si initialItems se recarga con una instancia distinta pero igual contenido', () => {
    sessionStorage.setItem('suggested_items', JSON.stringify([{ codigo: 'B', descripcion: 'Bomba', unidad: 'UNI', cantidad: 1 }]))
    const setActionMsg = vi.fn()
    const { result, rerender } = renderHook((props) => useMaterialCart(props), {
      initialProps: { initialItems: null, setActionMsg, setShowAssistant: vi.fn() },
    })

    // Primera carga (p. ej. primer fetch de useMaterialForm)
    act(() => rerender({ initialItems: [{ codigo: 'A', cantidad: 2, unidad: 'UNI' }], setActionMsg, setShowAssistant: vi.fn() }))
    expect(result.current.items.map((it) => it.codigo)).toEqual(['A', 'B'])

    // Segunda carga con OTRA instancia de array pero mismo contenido (StrictMode / doble fetch)
    act(() => rerender({ initialItems: [{ codigo: 'A', cantidad: 2, unidad: 'UNI' }], setActionMsg, setShowAssistant: vi.fn() }))
    expect(result.current.items.map((it) => it.codigo)).toEqual(['A', 'B'])
    expect(result.current.hasUnsavedChanges).toBe(true)

    // El mensaje de sugerencias solo se muestra la primera vez que se agregan
    const llamadasSugeridos = setActionMsg.mock.calls.filter(([msg]) => msg.includes('material(es) sugeridos'))
    expect(llamadasSugeridos.length).toBe(1)
  })
})

describe('useMaterialCart handleAdd y precio de referencia', () => {
  // Referencias estables: un initialItems nuevo en cada render re-dispara el efecto de sync
  const SIN_ITEMS = []
  const montar = () => {
    const setActionMsg = vi.fn()
    const setShowAssistant = vi.fn()
    const hook = renderHook(() =>
      useMaterialCart({ initialItems: SIN_ITEMS, setActionMsg, setShowAssistant })
    )
    return { ...hook, setActionMsg }
  }
  const cache = { X: {} }
  const loadDetail = vi.fn()

  it('agrega un material con precio SAP y usa ese precio', async () => {
    const { result, setActionMsg } = montar()
    let agregado
    await act(async () => {
      agregado = await result.current.handleAdd(
        { codigo: 'X', descripcion: 'Aceite', unidad_medida: 'L', precio_usd: 0.43 },
        { X: {} },
        loadDetail
      )
    })
    expect(agregado).toBe(true)
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].precio_unitario).toBe(0.43)
    expect(setActionMsg).toHaveBeenLastCalledWith('Material agregado al listado.')
  })

  it.each([null, undefined])('no agrega un material sin precio (precio_usd %s) y avisa', async (precio) => {
    const { result, setActionMsg } = montar()
    let agregado
    await act(async () => {
      agregado = await result.current.handleAdd(
        { codigo: 'X', descripcion: 'Cable', precio_usd: precio },
        cache,
        loadDetail
      )
    })
    expect(agregado).toBe(false)
    expect(result.current.items).toHaveLength(0)
    expect(setActionMsg).toHaveBeenLastCalledWith(
      'Este material no tiene precio de referencia; no se puede solicitar hasta que se cargue.'
    )
  })
})

describe('useMaterialCart handleAddSuggestedItems y precio de referencia', () => {
  const SIN_ITEMS = []
  const montar = () => {
    const setActionMsg = vi.fn()
    const hook = renderHook(() =>
      useMaterialCart({ initialItems: SIN_ITEMS, setActionMsg, setShowAssistant: vi.fn() })
    )
    return { ...hook, setActionMsg }
  }

  it('omite las sugerencias sin precio y avisa cuantas', () => {
    const { result, setActionMsg } = montar()
    act(() =>
      result.current.handleAddSuggestedItems([
        { codigo_sap: 'A', descripcion: 'Aceite', precio_unitario: 0.43, cantidad: 2 },
        { codigo_sap: 'B', descripcion: 'Cable', precio_unitario: null },
        { codigo_sap: 'C', descripcion: 'Perno' },
        { codigo_sap: 'D', descripcion: 'Junta', precio_usd: 1.5 },
      ])
    )
    expect(result.current.items.map((it) => [it.codigo, it.precio_unitario])).toEqual([
      ['A', 0.43],
      ['D', 1.5],
    ])
    expect(setActionMsg).toHaveBeenLastCalledWith(
      '2 material(es) sugeridos agregados · 2 omitido(s) por no tener precio de referencia'
    )
  })

  it('si ninguna sugerencia tiene precio no agrega nada y avisa', () => {
    const { result, setActionMsg } = montar()
    act(() => result.current.handleAddSuggestedItems([{ codigo_sap: 'B', precio_unitario: null }]))
    expect(result.current.items).toHaveLength(0)
    expect(setActionMsg).toHaveBeenLastCalledWith('1 omitido(s) por no tener precio de referencia')
  })
})
