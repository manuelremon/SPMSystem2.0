import { useLayoutEffect, useState } from 'react';

// Espacio que se deja debajo del elemento: padding de la tarjeta que lo contiene y
// la franja del boton flotante del asistente (no debe tapar la paginacion).
export const MARGEN_INFERIOR = 96;

/**
 * Alto disponible para un elemento desde su posicion en la pagina hasta el borde
 * inferior de la ventana. Nunca devuelve menos que `minimo`.
 *
 * Se recalcula al redimensionar la ventana y cuando cambia el contenido de la
 * pagina (filtros, alertas) que lo desplaza. La posicion se mide respecto del
 * documento, asi que un elemento que empieza mas abajo que la ventana conserva
 * el minimo en vez de encogerse.
 *
 * @param {React.RefObject<HTMLElement>} ref - elemento a dimensionar
 * @param {number} minimo - alto minimo en px
 * @param {boolean} activo - si es false devuelve siempre `minimo`
 */
export function useAlturaDisponible(ref, minimo, activo = true) {
  const [alto, setAlto] = useState(minimo);

  useLayoutEffect(() => {
    if (!activo) {
      setAlto(minimo);
      return undefined;
    }
    const calcular = () => {
      const el = ref.current;
      if (!el) return;
      const inicio = el.getBoundingClientRect().top + window.scrollY;
      const disponible = Math.round(window.innerHeight - inicio - MARGEN_INFERIOR);
      const nuevo = Math.max(minimo, disponible);
      setAlto((actual) => (actual === nuevo ? actual : nuevo));
    };

    calcular();
    window.addEventListener('resize', calcular);
    // El contenido de arriba (alertas, filtros) puede cambiar de alto y desplazar el elemento
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calcular) : null;
    observador?.observe(document.body);
    return () => {
      window.removeEventListener('resize', calcular);
      observador?.disconnect();
    };
  }, [ref, minimo, activo]);

  return alto;
}
