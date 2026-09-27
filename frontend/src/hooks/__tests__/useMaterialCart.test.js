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
})
