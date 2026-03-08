/**
 * Tests para Login.jsx
 * Flujo critico: autenticacion de usuarios
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';

// Mock de dependencias
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    login: vi.fn(),
    register: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    user: null
  }))
}));

vi.mock('../../services/csrf', () => ({
  fetchCsrfToken: vi.fn()
}));

vi.mock('../../context/i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key
  })
}));

vi.mock('../../hooks/useParallax', () => ({
  useParallax: () => ({
    ref: { current: null },
    style: {},
    isDisabled: true
  })
}));

// Mock de navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Import mock para poder modificarlo
import { useAuthStore } from '../../store/authStore';

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockReturnValue({
      login: vi.fn(),
      register: vi.fn(),
      isLoading: false,
      error: null,
      clearError: vi.fn(),
      user: null
    });
  });

  describe('Renderizado inicial', () => {
    it('muestra el formulario de login', () => {
      renderLogin();

      expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('correo@empresa.com o 12345')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
    });

    it('muestra el logo y titulo SPM', () => {
      renderLogin();

      expect(screen.getByText('SPM')).toBeInTheDocument();
      expect(screen.getByText('Sistema de Planificación de Materiales')).toBeInTheDocument();
    });

    it('muestra links de recuperar y crear cuenta', () => {
      renderLogin();

      expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeInTheDocument();
      expect(screen.getByText('Crear cuenta')).toBeInTheDocument();
    });
  });

  describe('Validacion de formulario', () => {
    it('muestra error cuando campos estan vacios', async () => {
      renderLogin();

      const submitButton = screen.getByRole('button', { name: /ingresar/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Ingresa un correo electrónico o número de ID válido.')).toBeInTheDocument();
        expect(screen.getByText('La contraseña debe tener al menos 6 caracteres.')).toBeInTheDocument();
      });
    });

    it('permite escribir en los campos', () => {
      renderLogin();

      const emailInput = screen.getByPlaceholderText('correo@empresa.com o 12345');
      const passwordInput = screen.getByPlaceholderText('••••••');

      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput.value).toBe('test@test.com');
      expect(passwordInput.value).toBe('password123');
    });
  });

  describe('Toggle de password', () => {
    it('alterna visibilidad de contraseña', () => {
      renderLogin();

      const passwordInput = screen.getByPlaceholderText('••••••');
      expect(passwordInput.type).toBe('password');

      // Find toggle button by aria-label
      const toggleButton = screen.getByLabelText('Alternar visibilidad de contrase\u00f1a');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Login exitoso', () => {
    it('llama a login y navega al dashboard', async () => {
      const mockLogin = vi.fn().mockResolvedValue({});
      useAuthStore.mockReturnValue({
        login: mockLogin,
        register: vi.fn(),
        isLoading: false,
        error: null,
        clearError: vi.fn(),
        user: null
      });

      renderLogin();

      const emailInput = screen.getByPlaceholderText('correo@empresa.com o 12345');
      const passwordInput = screen.getByPlaceholderText('••••••');
      const submitButton = screen.getByRole('button', { name: /ingresar/i });

      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
      });
    });
  });

  describe('Estado de carga', () => {
    it('muestra "Ingresando..." cuando isLoading es true', () => {
      useAuthStore.mockReturnValue({
        login: vi.fn(),
        register: vi.fn(),
        isLoading: true,
        error: null,
        clearError: vi.fn(),
        user: null
      });

      renderLogin();

      expect(screen.getByRole('button', { name: /ingresando/i })).toBeInTheDocument();
    });

    it('deshabilita el boton durante la carga', () => {
      useAuthStore.mockReturnValue({
        login: vi.fn(),
        register: vi.fn(),
        isLoading: true,
        error: null,
        clearError: vi.fn(),
        user: null
      });

      renderLogin();

      const submitButton = screen.getByRole('button', { name: /ingresando/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Manejo de errores', () => {
    it('muestra error del store', () => {
      useAuthStore.mockReturnValue({
        login: vi.fn(),
        register: vi.fn(),
        isLoading: false,
        error: 'Credenciales invalidas',
        clearError: vi.fn(),
        user: null
      });

      renderLogin();

      expect(screen.getByText('Credenciales invalidas')).toBeInTheDocument();
    });
  });

  describe('Redireccion con usuario autenticado', () => {
    it('navega al dashboard si ya hay usuario', () => {
      useAuthStore.mockReturnValue({
        login: vi.fn(),
        register: vi.fn(),
        isLoading: false,
        error: null,
        clearError: vi.fn(),
        user: { id: '1', nombre: 'Test' }
      });

      renderLogin();

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Modal de recuperar contraseña', () => {
    it('abre modal al hacer click en recuperar', async () => {
      renderLogin();

      const recoverLink = screen.getByText('¿Olvidaste tu contraseña?');
      fireEvent.click(recoverLink);

      await waitFor(() => {
        expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument();
      });
    });
  });

  describe('Modal de registro', () => {
    it('abre modal al hacer click en crear cuenta', async () => {
      renderLogin();

      const registerLink = screen.getByText('Crear cuenta');
      fireEvent.click(registerLink);

      await waitFor(() => {
        // Dialog title "Crear cuenta" + the link text = multiple matches, use getAllByText
        const crearCuentaElements = screen.getAllByText(/crear cuenta/i);
        expect(crearCuentaElements.length).toBeGreaterThanOrEqual(2); // link + dialog title
        expect(screen.getByPlaceholderText('Juan Pérez')).toBeInTheDocument();
      });
    });
  });
});
