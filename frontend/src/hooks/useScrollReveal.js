import { useEffect, useRef, useState } from 'react';

/**
 * Hook para detectar cuando un elemento entra en el viewport
 * Usa Intersection Observer API nativa para performance óptima
 *
 * @param {Object} options - Opciones de configuración
 * @param {number} options.threshold - Porcentaje visible para triggear (0.1 = 10%)
 * @param {string} options.rootMargin - Margen extra del viewport
 * @param {boolean} options.once - Solo animar una vez (default: true)
 * @returns {{ ref: React.RefObject, isRevealed: boolean }}
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const {
    threshold = 0.1,      // 10% visible para triggear
    rootMargin = '0px',   // Margen extra
    once = true           // Solo animar una vez
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Verificar si el usuario prefiere menos movimiento
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Si prefiere menos movimiento, revelar inmediatamente
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setIsRevealed(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isRevealed };
}

export default useScrollReveal;
