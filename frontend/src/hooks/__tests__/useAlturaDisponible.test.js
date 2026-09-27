import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlturaDisponible, MARGEN_INFERIOR } from '../useAlturaDisponible'

const elementoEn = (top) => ({ current: { getBoundingClientRect: () => ({ top }) } })
const altoOriginal = window.innerHeight

describe('useAlturaDisponible', () => {
  afterEach(() => {
    window.innerHeight = altoOriginal
  })

  it('crece hasta el borde inferior de la ventana', () => {
    window.innerHeight = 1000
    const { result } = renderHook(() => useAlturaDisponible(elementoEn(200), 400))
    expect(result.current).toBe(1000 - 200 - MARGEN_INFERIOR)
  })

  it('nunca baja del minimo', () => {
    window.innerHeight = 600
    const { result } = renderHook(() => useAlturaDisponible(elementoEn(400), 480))
    expect(result.current).toBe(480)
  })

  it('se recalcula al redimensionar la ventana', () => {
    window.innerHeight = 900
    const { result } = renderHook(() => useAlturaDisponible(elementoEn(100), 300))
    expect(result.current).toBe(900 - 100 - MARGEN_INFERIOR)
    act(() => {
      window.innerHeight = 1200
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(1200 - 100 - MARGEN_INFERIOR)
  })

  it('inactivo devuelve el minimo', () => {
    window.innerHeight = 1500
    const { result } = renderHook(() => useAlturaDisponible(elementoEn(0), 400, false))
    expect(result.current).toBe(400)
  })
})
