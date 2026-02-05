/**
 * TourStep Component
 *
 * Muestra un paso individual del tour con spotlight sobre el elemento objetivo.
 * Incluye titulo, contenido y controles de navegacion.
 */

import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from "../ui/Icons";
import { Button } from "../ui/Button";
import { useI18n } from "../../context/i18n";

// Calcular posicion del tooltip relativo al elemento objetivo
function calculatePosition(targetRect, placement, tooltipRect) {
  const gap = 12;
  const positions = {
    top: {
      top: targetRect.top - tooltipRect.height - gap,
      left: targetRect.left + (targetRect.width - tooltipRect.width) / 2,
    },
    bottom: {
      top: targetRect.bottom + gap,
      left: targetRect.left + (targetRect.width - tooltipRect.width) / 2,
    },
    left: {
      top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
      left: targetRect.left - tooltipRect.width - gap,
    },
    right: {
      top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
      left: targetRect.right + gap,
    },
  };

  let pos = positions[placement] || positions.bottom;

  // Ajustar si se sale de la pantalla
  const padding = 16;
  if (pos.left < padding) pos.left = padding;
  if (pos.left + tooltipRect.width > window.innerWidth - padding) {
    pos.left = window.innerWidth - tooltipRect.width - padding;
  }
  if (pos.top < padding) pos.top = padding;
  if (pos.top + tooltipRect.height > window.innerHeight - padding) {
    pos.top = window.innerHeight - tooltipRect.height - padding;
  }

  return pos;
}

export function TourStep({
  step,
  stepNumber,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isFirstStep,
  isLastStep,
}) {
  const { t } = useI18n();
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetElement, setTargetElement] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  // Encontrar y posicionar el tooltip
  useEffect(() => {
    if (!step?.target) return;

    const target = document.querySelector(step.target);
    setTargetElement(target);

    if (!target || !tooltipRef.current) {
      // Si no hay target, centrar en pantalla
      setPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 175,
      });
      setIsVisible(true);
      return;
    }

    const updatePosition = () => {
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const pos = calculatePosition(targetRect, step.placement, tooltipRect);
      setPosition(pos);
      setIsVisible(true);

      // Scroll al elemento si no es visible
      if (targetRect.top < 0 || targetRect.bottom > window.innerHeight) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    // Delay para permitir que el DOM se actualice
    const timer = setTimeout(updatePosition, 100);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [step]);

  // Enfocar el tooltip cuando aparece
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [isVisible]);

  if (!step) return null;

  return (
    <>
      {/* Spotlight highlight sobre el elemento objetivo */}
      {targetElement && (
        <div
          className="fixed pointer-events-none z-[9998] rounded-lg ring-4 ring-blue-500/50 ring-offset-4 ring-offset-transparent"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
            transition: "all 300ms ease-out",
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip del paso */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        tabIndex={-1}
        className={clsx(
          "fixed z-[9999] w-[350px] max-w-[calc(100vw-32px)]",
          "bg-white dark:bg-slate-800",
          "rounded-xl shadow-2xl",
          "border border-slate-200 dark:border-slate-700",
          "transition-all duration-300 ease-out",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-500 rounded-full">
              {stepNumber}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("tour_step_of", "Paso {{current}} de {{total}}")
                .replace("{{current}}", stepNumber)
                .replace("{{total}}", totalSteps)}
            </span>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={t("tour_close", "Cerrar tour")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <h3
            id="tour-step-title"
            className="text-lg font-semibold text-slate-900 dark:text-white mb-2"
          >
            {step.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {step.content}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer / Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {t("tour_skip", "Omitir tour")}
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                aria-label={t("tour_previous", "Paso anterior")}
              >
                <ChevronLeft className="w-4 h-4" />
                {t("tour_back", "Atras")}
              </Button>
            )}

            {isLastStep ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onComplete}
              >
                <CheckCircle2 className="w-4 h-4" />
                {t("tour_finish", "Finalizar")}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={onNext}
              >
                {t("tour_next", "Siguiente")}
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

TourStep.propTypes = {
  step: PropTypes.shape({
    id: PropTypes.string,
    target: PropTypes.string,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    placement: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  }),
  stepNumber: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrev: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  isFirstStep: PropTypes.bool.isRequired,
  isLastStep: PropTypes.bool.isRequired,
};

export default TourStep;
