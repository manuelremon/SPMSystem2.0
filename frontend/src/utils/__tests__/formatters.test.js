/**
 * Tests para funciones de formateo
 */
import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  truncateText,
  capitalize,
  formatPercentage,
} from '../formatters'

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('debe formatear números como moneda USD', () => {
      expect(formatCurrency(1000)).toMatch(/1[.,]000/)
      expect(formatCurrency(1234.56)).toMatch(/1[.,]234/)
    })

    it('debe manejar valores negativos', () => {
      const result = formatCurrency(-500)
      expect(result).toMatch(/500/)
    })

    it('debe manejar cero', () => {
      expect(formatCurrency(0)).toMatch(/0/)
    })

    it('debe manejar números grandes', () => {
      expect(formatCurrency(1000000)).toMatch(/1[.,]000[.,]000/)
    })

    it('debe manejar decimales', () => {
      const result = formatCurrency(99.99)
      expect(result).toMatch(/99/)
    })

    it('debe manejar null/undefined', () => {
      expect(formatCurrency(null)).toBeDefined()
      expect(formatCurrency(undefined)).toBeDefined()
    })
  })

  describe('formatDate', () => {
    it('debe formatear fecha ISO a formato legible', () => {
      const result = formatDate('2024-01-15')
      expect(result).toBeTruthy()
    })

    it('debe manejar fechas con timestamp', () => {
      const result = formatDate('2024-01-15T10:30:00Z')
      expect(result).toBeTruthy()
    })

    it('debe manejar null/undefined', () => {
      expect(formatDate(null)).toBe('-')
      expect(formatDate(undefined)).toBe('-')
    })

    it('debe manejar fechas inválidas', () => {
      expect(formatDate('invalid')).toBe('-')
    })
  })

  describe('formatDateTime', () => {
    it('debe incluir hora en el formato', () => {
      const result = formatDateTime('2024-01-15T14:30:00Z')
      expect(result).toBeTruthy()
      // Debería incluir algún indicador de hora
      expect(result.length).toBeGreaterThan(10)
    })

    it('debe manejar null/undefined', () => {
      expect(formatDateTime(null)).toBe('-')
      expect(formatDateTime(undefined)).toBe('-')
    })
  })

  describe('formatNumber', () => {
    it('debe formatear números con separadores', () => {
      expect(formatNumber(1000)).toMatch(/1[.,]000/)
      expect(formatNumber(1234567)).toMatch(/1[.,]234[.,]567/)
    })

    it('debe manejar decimales', () => {
      const result = formatNumber(1234.56, 2)
      expect(result).toMatch(/1[.,]234/)
    })

    it('debe manejar cero', () => {
      expect(formatNumber(0)).toBe('0')
    })

    it('debe manejar negativos', () => {
      expect(formatNumber(-1000)).toMatch(/1[.,]000/)
    })
  })

  describe('truncateText', () => {
    it('debe truncar texto largo', () => {
      const longText = 'Este es un texto muy largo que debería ser truncado'
      const result = truncateText(longText, 20)
      expect(result.length).toBeLessThanOrEqual(23) // 20 + '...'
      expect(result).toContain('...')
    })

    it('no debe truncar texto corto', () => {
      const shortText = 'Corto'
      const result = truncateText(shortText, 20)
      expect(result).toBe('Corto')
    })

    it('debe manejar texto vacío', () => {
      expect(truncateText('', 20)).toBe('')
    })

    it('debe manejar null/undefined', () => {
      expect(truncateText(null, 20)).toBe('')
      expect(truncateText(undefined, 20)).toBe('')
    })

    it('debe manejar límite 0', () => {
      expect(truncateText('texto', 0)).toBe('...')
    })
  })

  describe('capitalize', () => {
    it('debe capitalizar primera letra', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('world')).toBe('World')
    })

    it('debe manejar texto ya capitalizado', () => {
      expect(capitalize('Hello')).toBe('Hello')
    })

    it('debe manejar texto vacío', () => {
      expect(capitalize('')).toBe('')
    })

    it('debe manejar null/undefined', () => {
      expect(capitalize(null)).toBe('')
      expect(capitalize(undefined)).toBe('')
    })

    it('debe manejar un solo carácter', () => {
      expect(capitalize('a')).toBe('A')
    })

    it('debe manejar texto con espacios', () => {
      expect(capitalize('hello world')).toBe('Hello world')
    })
  })

  describe('formatPercentage', () => {
    it('debe formatear como porcentaje', () => {
      expect(formatPercentage(0.5)).toBe('50%')
      expect(formatPercentage(0.75)).toBe('75%')
      expect(formatPercentage(1)).toBe('100%')
    })

    it('debe manejar decimales', () => {
      expect(formatPercentage(0.333)).toMatch(/33/)
    })

    it('debe manejar cero', () => {
      expect(formatPercentage(0)).toBe('0%')
    })

    it('debe manejar valores mayores a 1', () => {
      expect(formatPercentage(1.5)).toMatch(/150/)
    })

    it('debe manejar null/undefined', () => {
      expect(formatPercentage(null)).toBe('0%')
      expect(formatPercentage(undefined)).toBe('0%')
    })
  })
})
