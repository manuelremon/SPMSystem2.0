/**
 * Test Setup File for Vitest
 * Configures testing environment with necessary mocks and matchers
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
}

global.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver {
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
}

global.ResizeObserver = MockResizeObserver;

// Mock matchMedia
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
});

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// Suppress console.error for expected errors in tests
const originalError = console.error;
console.error = (...args) => {
  // Suppress React act warnings and expected test errors
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('act(...)') ||
     args[0].includes('Warning:') ||
     args[0].includes('Not implemented'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
