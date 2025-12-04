import '@testing-library/jest-dom'

// Mock de window.matchMedia para tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock de ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock de CSS variables
document.documentElement.style.setProperty('--fg', '#000')
document.documentElement.style.setProperty('--fg-muted', '#666')
document.documentElement.style.setProperty('--bg', '#fff')
document.documentElement.style.setProperty('--bg-soft', '#f5f5f5')
document.documentElement.style.setProperty('--border', '#e5e5e5')
document.documentElement.style.setProperty('--primary', '#0066cc')
document.documentElement.style.setProperty('--danger', '#ef4444')
document.documentElement.style.setProperty('--success', '#10b981')
document.documentElement.style.setProperty('--card', '#ffffff')
