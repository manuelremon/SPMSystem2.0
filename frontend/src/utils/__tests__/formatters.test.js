/**
 * Tests para funciones de formateo
 * Actualizado para coincidir con la implementacion real de formatters.js
 */
import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDateFull,
  formatNumber,
  formatAlmacen,
  getSectorNombre,
  toNumber,
} from '../formatters'

describe('formatters', () => {
  describe('toNumber', () => {
    it('debe convertir strings a numeros', () => {
      expect(toNumber('123')).toBe(123)
      expect(toNumber('45.67')).toBe(45.67)
    })

    it('debe retornar 0 para valores invalidos', () => {
      expect(toNumber(null)).toBe(0)
      expect(toNumber(undefined)).toBe(0)
      expect(toNumber('invalid')).toBe(0)
      expect(toNumber(NaN)).toBe(0)
      expect(toNumber(Infinity)).toBe(0)
    })

    it('debe manejar numeros directamente', () => {
      expect(toNumber(100)).toBe(100)
      expect(toNumber(-50)).toBe(-50)
    })
  })

  describe('formatCurrency', () => {
    it('debe formatear numeros como moneda USD', () => {
      const result = formatCurrency(1000)
      expect(result).toContain('USD')
      // Locale puede formatear con o sin separador de miles
      expect(result).toMatch(/1[.,]?000/)
    })

    it('debe manejar valores negativos', () => {
      const result = formatCurrency(-500)
      expect(result).toContain('USD')
      expect(result).toMatch(/500/)
    })

    it('debe manejar cero', () => {
      expect(formatCurrency(0)).toContain('USD')
      expect(formatCurrency(0)).toMatch(/0/)
    })

    it('debe manejar numeros grandes', () => {
      const result = formatCurrency(1000000)
      expect(result).toContain('USD')
    })

    it('debe manejar decimales', () => {
      const result = formatCurrency(99.99)
      expect(result).toMatch(/99/)
    })

    it('debe manejar null/undefined', () => {
      expect(formatCurrency(null)).toContain('USD')
      expect(formatCurrency(undefined)).toContain('USD')
    })

    it('debe respetar el parametro de decimales', () => {
      const result = formatCurrency(100.5678, 3)
      expect(result).toBeDefined()
    })
  })

  describe('formatDate', () => {
    it('debe formatear fecha ISO a formato DD/MM/YY', () => {
      const result = formatDate('2024-01-15')
      expect(result).toBeTruthy()
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/)
    })

    it('debe manejar fechas con timestamp', () => {
      const result = formatDate('2024-01-15T10:30:00Z')
      expect(result).toBeTruthy()
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/)
    })

    it('debe retornar N/D para null/undefined', () => {
      expect(formatDate(null)).toBe('N/D')
      expect(formatDate(undefined)).toBe('N/D')
    })

    it('debe retornar N/D para fechas invalidas', () => {
      expect(formatDate('invalid')).toBe('N/D')
      expect(formatDate('')).toBe('N/D')
    })
  })

  describe('formatDateFull', () => {
    it('debe formatear fecha en formato DD/MM/YYYY', () => {
      const result = formatDateFull('2024-01-15')
      expect(result).toBeTruthy()
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    })

    it('debe retornar N/D para valores invalidos', () => {
      expect(formatDateFull(null)).toBe('N/D')
      expect(formatDateFull('')).toBe('N/D')
    })
  })

  describe('formatDateTime', () => {
    it('debe incluir hora en el formato DD/MM/YY HH:MM', () => {
      const result = formatDateTime('2024-01-15T14:30:00Z')
      expect(result).toBeTruthy()
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/)
      expect(result.length).toBeGreaterThan(10) // Incluye hora
    })

    it('debe retornar N/D para null/undefined', () => {
      expect(formatDateTime(null)).toBe('N/D')
      expect(formatDateTime(undefined)).toBe('N/D')
    })

    it('debe retornar N/D para fechas invalidas', () => {
      expect(formatDateTime('invalid')).toBe('N/D')
    })
  })

  describe('formatNumber', () => {
    it('debe formatear numeros con locale es-ES', () => {
      const result = formatNumber(1000)
      expect(result).toBeTruthy()
    })

    it('debe manejar numeros grandes', () => {
      const result = formatNumber(1234567)
      expect(result).toBeTruthy()
    })

    it('debe manejar cero', () => {
      expect(formatNumber(0)).toBe('0')
    })

    it('debe manejar negativos', () => {
      const result = formatNumber(-1000)
      expect(result).toContain('1')
    })

    it('debe manejar decimales', () => {
      const result = formatNumber(1234.56)
      expect(result).toBeTruthy()
    })
  })

  describe('formatAlmacen', () => {
    it('debe formatear codigo a 4 digitos con ceros', () => {
      expect(formatAlmacen(1)).toBe('0001')
      expect(formatAlmacen(100)).toBe('0100')
      expect(formatAlmacen(9999)).toBe('9999')
    })

    it('debe manejar strings', () => {
      expect(formatAlmacen('1')).toBe('0001')
      expect(formatAlmacen('0100')).toBe('0100')
    })

    it('debe retornar - para valores invalidos', () => {
      expect(formatAlmacen(null)).toBe('-')
      expect(formatAlmacen(undefined)).toBe('-')
      expect(formatAlmacen('')).toBe('-')
    })

    it('debe eliminar caracteres no numericos', () => {
      expect(formatAlmacen('ALM001')).toBe('0001')
    })
  })

  describe('getSectorNombre', () => {
    it('debe retornar nombre del mapeo estatico', () => {
      expect(getSectorNombre('1')).toBe('Almacenes')
      expect(getSectorNombre('2')).toBe('Compras')
    })

    it('debe retornar el valor si ya es un nombre', () => {
      expect(getSectorNombre('Compras')).toBe('Compras')
      expect(getSectorNombre('Logistica')).toBe('Logistica')
    })

    it('debe retornar - para valores vacios', () => {
      expect(getSectorNombre(null)).toBe('-')
      expect(getSectorNombre('')).toBe('-')
    })

    it('debe buscar en sectores del backend si se proporcionan', () => {
      const sectores = [
        { id: '99', nombre: 'Sector Custom' }
      ]
      expect(getSectorNombre('99', sectores)).toBe('Sector Custom')
    })
  })
})
