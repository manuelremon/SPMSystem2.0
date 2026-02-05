/**
 * TourProvider Component
 *
 * Componente contenedor que renderiza el overlay y paso del tour.
 * Debe envolver la aplicacion para que el tour funcione correctamente.
 *
 * Uso:
 * <TourProvider>
 *   <App />
 * </TourProvider>
 */

import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { useTourStore } from "../../store/tourStore";
import TourOverlay from "./TourOverlay";
import TourStep from "./TourStep";

export function TourProvider({ children }) {
  const {
    activeTour,
    currentStepIndex,
    isVisible,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    getCurrentStep,
    getProgress,
  } = useTourStore();

  const currentStep = getCurrentStep();
  const progress = getProgress();

  // Manejar teclado para navegacion del tour
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          skipTour();
          break;
        case "ArrowRight":
        case "Enter":
          e.preventDefault();
          if (progress.current < progress.total) {
            nextStep();
          } else {
            completeTour();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentStepIndex > 0) {
            prevStep();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, nextStep, prevStep, skipTour, completeTour, currentStepIndex, progress]);

  // Bloquear scroll del body cuando el tour esta activo
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  return (
    <>
      {children}

      {/* Tour Overlay */}
      <TourOverlay
        targetSelector={currentStep?.target}
        isVisible={isVisible}
        onClick={() => {}} // No cerrar al click en overlay
      />

      {/* Tour Step */}
      {isVisible && currentStep && (
        <TourStep
          step={currentStep}
          stepNumber={progress.current}
          totalSteps={progress.total}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          onComplete={completeTour}
          isFirstStep={currentStepIndex === 0}
          isLastStep={progress.current === progress.total}
        />
      )}
    </>
  );
}

TourProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default TourProvider;
