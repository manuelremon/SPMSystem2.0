/**
 * useSwipeGesture Hook
 *
 * Detecta gestos de swipe en dispositivos tactiles.
 * Util para navegacion mobile como abrir/cerrar sidebar.
 */

import { useRef, useCallback, useEffect } from "react";

// Configuracion por defecto
const DEFAULT_CONFIG = {
  minSwipeDistance: 50, // Minimo de pixeles para considerar swipe
  maxSwipeTime: 300, // Maximo tiempo en ms para completar swipe
  preventScroll: false, // Prevenir scroll durante swipe
};

/**
 * @param {Object} handlers - Manejadores de eventos de swipe
 * @param {Function} handlers.onSwipeLeft - Callback para swipe a la izquierda
 * @param {Function} handlers.onSwipeRight - Callback para swipe a la derecha
 * @param {Function} handlers.onSwipeUp - Callback para swipe hacia arriba
 * @param {Function} handlers.onSwipeDown - Callback para swipe hacia abajo
 * @param {Function} handlers.onSwipe - Callback generico (recibe direccion)
 * @param {Object} config - Configuracion
 * @returns {Object} Props para agregar al elemento
 */
export function useSwipeGesture(handlers = {}, config = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipe,
  } = handlers;

  const {
    minSwipeDistance,
    maxSwipeTime,
    preventScroll,
  } = { ...DEFAULT_CONFIG, ...config };

  // Refs para almacenar estado del touch
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isSwiping = useRef(false);

  /**
   * Manejar inicio del touch
   */
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isSwiping.current = true;
  }, []);

  /**
   * Manejar movimiento del touch
   */
  const handleTouchMove = useCallback((e) => {
    if (!isSwiping.current) return;

    // Prevenir scroll si esta configurado
    if (preventScroll) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // Si el movimiento horizontal es mayor que el vertical, prevenir scroll
      if (deltaX > deltaY) {
        e.preventDefault();
      }
    }
  }, [preventScroll]);

  /**
   * Manejar fin del touch
   */
  const handleTouchEnd = useCallback((e) => {
    if (!isSwiping.current) return;
    isSwiping.current = false;

    const touch = e.changedTouches[0];
    const { x: startX, y: startY, time: startTime } = touchStartRef.current;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const deltaTime = Date.now() - startTime;

    // Verificar si es un swipe valido (distancia y tiempo)
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (deltaTime > maxSwipeTime) return; // Muy lento
    if (absX < minSwipeDistance && absY < minSwipeDistance) return; // Muy corto

    // Determinar direccion
    let direction;
    if (absX > absY) {
      // Swipe horizontal
      direction = deltaX > 0 ? "right" : "left";
      if (direction === "left" && onSwipeLeft) {
        onSwipeLeft({ deltaX, deltaY, deltaTime });
      } else if (direction === "right" && onSwipeRight) {
        onSwipeRight({ deltaX, deltaY, deltaTime });
      }
    } else {
      // Swipe vertical
      direction = deltaY > 0 ? "down" : "up";
      if (direction === "up" && onSwipeUp) {
        onSwipeUp({ deltaX, deltaY, deltaTime });
      } else if (direction === "down" && onSwipeDown) {
        onSwipeDown({ deltaX, deltaY, deltaTime });
      }
    }

    // Callback generico
    if (onSwipe) {
      onSwipe({ direction, deltaX, deltaY, deltaTime });
    }
  }, [
    minSwipeDistance,
    maxSwipeTime,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipe,
  ]);

  /**
   * Props para agregar al elemento
   */
  const swipeHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return swipeHandlers;
}

/**
 * Hook para detectar swipe en el borde de la pantalla
 * Util para abrir sidebar con gesto desde el borde
 *
 * @param {Object} handlers - Manejadores
 * @param {Function} handlers.onSwipeFromLeft - Swipe desde borde izquierdo
 * @param {Function} handlers.onSwipeFromRight - Swipe desde borde derecho
 * @param {number} edgeWidth - Ancho del area de deteccion del borde (px)
 */
export function useEdgeSwipe(handlers = {}, edgeWidth = 20) {
  const { onSwipeFromLeft, onSwipeFromRight } = handlers;

  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isEdge: false, edge: null });

  useEffect(() => {
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;

      // Detectar si el touch empieza en el borde
      const isLeftEdge = touch.clientX <= edgeWidth;
      const isRightEdge = touch.clientX >= screenWidth - edgeWidth;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        isEdge: isLeftEdge || isRightEdge,
        edge: isLeftEdge ? "left" : isRightEdge ? "right" : null,
      };
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current.isEdge) return;

      const touch = e.changedTouches[0];
      const { x: startX, time: startTime, edge } = touchStartRef.current;

      const deltaX = touch.clientX - startX;
      const deltaTime = Date.now() - startTime;

      // Validar swipe
      if (deltaTime > 300) return;
      if (Math.abs(deltaX) < 50) return;

      // Swipe desde borde izquierdo hacia la derecha
      if (edge === "left" && deltaX > 0 && onSwipeFromLeft) {
        onSwipeFromLeft();
      }

      // Swipe desde borde derecho hacia la izquierda
      if (edge === "right" && deltaX < 0 && onSwipeFromRight) {
        onSwipeFromRight();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [edgeWidth, onSwipeFromLeft, onSwipeFromRight]);
}

export default useSwipeGesture;
