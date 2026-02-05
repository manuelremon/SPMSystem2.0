import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Hook para efectos de parallax basado en scroll
 * Respeta prefers-reduced-motion y desactiva en mobile
 *
 * @param {Object} options - Opciones del parallax
 * @param {number} options.offset - Velocidad del parallax (0-1, default: 0.5)
 * @param {'x' | 'y'} options.direction - Direccion del movimiento (default: 'y')
 * @param {boolean} options.disabled - Desactivar el efecto (default: false)
 * @returns {{ ref: React.RefObject, style: Object, isDisabled: boolean }}
 */
export function useParallax(options = {}) {
  const {
    offset = 0.5,        // 0-1: velocidad (0.5 = 50% velocidad scroll)
    direction = 'y',     // 'x' o 'y'
    disabled = false,
  } = options;

  const ref = useRef(null);
  const [transform, setTransform] = useState('translateY(0px)');
  const rafRef = useRef(null);

  // Detectar preferencia de movimiento reducido
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Detectar si es mobile (< 768px)
  const isMobile =
    typeof window !== 'undefined' &&
    window.innerWidth < 768;

  const handleScroll = useCallback(() => {
    if (!ref.current || disabled || prefersReducedMotion || isMobile) return;

    // Cancelar RAF previo para evitar acumulacion
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;

      const scrolled = window.scrollY;
      const elementTop = rect.top + scrolled;
      const viewportHeight = window.innerHeight;

      // Calcular posicion relativa al viewport
      const relativeScroll = (scrolled - elementTop + viewportHeight) * offset;
      const value = Math.round(relativeScroll * 0.1);

      // Limitar el desplazamiento para evitar movimientos excesivos
      const clampedValue = Math.max(-100, Math.min(100, value));

      const axis = direction === 'x' ? 'X' : 'Y';
      setTransform(`translate${axis}(${clampedValue}px)`);
    });
  }, [offset, direction, disabled, prefersReducedMotion, isMobile]);

  useEffect(() => {
    if (disabled || prefersReducedMotion || isMobile) return;

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Calcular posicion inicial

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll, disabled, prefersReducedMotion, isMobile]);

  const isDisabled = disabled || prefersReducedMotion || isMobile;

  return {
    ref,
    style: isDisabled ? {} : {
      transform,
      willChange: 'transform',
      transition: 'transform 0.1s ease-out',
    },
    isDisabled,
  };
}

// Presets de configuracion para uso rapido
export const parallaxPresets = {
  subtle: { offset: 0.2 },      // Sidebar, navegacion
  light: { offset: 0.35 },      // Headers, titulos
  moderate: { offset: 0.5 },    // Cards, secciones
  strong: { offset: 0.7 },      // Hero sections, Login
};
