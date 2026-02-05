/**
 * useTour Hook
 *
 * Hook personalizado para controlar el sistema de tour guiado.
 * Proporciona una interfaz simplificada para iniciar, controlar y
 * monitorear tours desde cualquier componente.
 */

import { useEffect, useCallback } from "react";
import { useTourStore, TOURS } from "../store/tourStore";

/**
 * @param {Object} options - Opciones del hook
 * @param {string} options.autoStartTour - ID del tour a iniciar automaticamente
 * @param {boolean} options.respectCompleted - Respetar tours completados (default: true)
 * @param {number} options.autoStartDelay - Delay en ms antes de iniciar auto tour (default: 1000)
 */
export function useTour(options = {}) {
  const {
    autoStartTour,
    respectCompleted = true,
    autoStartDelay = 1000,
  } = options;

  // Acceder al store
  const {
    activeTour,
    currentStepIndex,
    isVisible,
    completedTours,
    skippedTours,
    disableAutoTours,
    startTour,
    nextStep,
    prevStep,
    goToStep,
    completeTour,
    skipTour,
    closeTour,
    isTourCompleted,
    isTourSkipped,
    shouldShowAutoTour,
    resetTour,
    resetAllTours,
    toggleAutoTours,
    getCurrentStep,
    getProgress,
  } = useTourStore();

  // Auto-iniciar tour si se especifica
  useEffect(() => {
    if (!autoStartTour) return;

    // Verificar si se debe mostrar el tour
    const shouldShow = respectCompleted
      ? shouldShowAutoTour(autoStartTour)
      : true;

    if (shouldShow && !activeTour) {
      const timer = setTimeout(() => {
        startTour(autoStartTour);
      }, autoStartDelay);

      return () => clearTimeout(timer);
    }
  }, [
    autoStartTour,
    respectCompleted,
    autoStartDelay,
    shouldShowAutoTour,
    activeTour,
    startTour,
  ]);

  /**
   * Iniciar un tour por su ID
   */
  const start = useCallback(
    (tourId) => {
      if (TOURS[tourId]) {
        startTour(tourId);
      } else {
        console.warn(`Tour "${tourId}" no existe`);
      }
    },
    [startTour]
  );

  /**
   * Obtener informacion de un tour
   */
  const getTourInfo = useCallback((tourId) => {
    const tour = TOURS[tourId];
    if (!tour) return null;

    return {
      ...tour,
      isCompleted: isTourCompleted(tourId),
      isSkipped: isTourSkipped(tourId),
      totalSteps: tour.steps.length,
    };
  }, [isTourCompleted, isTourSkipped]);

  /**
   * Obtener lista de todos los tours disponibles
   */
  const getAvailableTours = useCallback(() => {
    return Object.keys(TOURS).map((tourId) => getTourInfo(tourId));
  }, [getTourInfo]);

  /**
   * Verificar si hay un tour activo
   */
  const isActive = !!activeTour && isVisible;

  /**
   * Obtener el paso actual con informacion adicional
   */
  const currentStep = getCurrentStep();

  /**
   * Obtener progreso con informacion adicional
   */
  const progress = getProgress();

  /**
   * Verificar si estamos en el primer paso
   */
  const isFirstStep = currentStepIndex === 0;

  /**
   * Verificar si estamos en el ultimo paso
   */
  const isLastStep = activeTour
    ? currentStepIndex === activeTour.steps.length - 1
    : false;

  /**
   * Registrar un elemento como objetivo de tour
   * Devuelve props para agregar al elemento
   */
  const registerTarget = useCallback((targetId) => {
    return {
      "data-tour": targetId,
    };
  }, []);

  return {
    // Estado
    activeTour,
    currentStep,
    currentStepIndex,
    isActive,
    isVisible,
    isFirstStep,
    isLastStep,
    progress,
    completedTours,
    skippedTours,
    disableAutoTours,

    // Acciones
    start,
    startTour,
    nextStep,
    prevStep,
    goToStep,
    completeTour,
    skipTour,
    closeTour,

    // Queries
    isTourCompleted,
    isTourSkipped,
    shouldShowAutoTour,
    getTourInfo,
    getAvailableTours,

    // Configuracion
    resetTour,
    resetAllTours,
    toggleAutoTours,

    // Helpers
    registerTarget,
  };
}

export default useTour;
