/**
 * HelpTooltip Component
 *
 * Icono de ayuda (?) que muestra un tooltip con informacion contextual
 * al hacer hover o focus. Ideal para explicar campos de formulario.
 *
 * WCAG 2.1 AA: Accesible via teclado y compatible con lectores de pantalla.
 */

import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { HelpCircle } from "./Icons";

export function HelpTooltip({
  content,
  position = "top",
  iconSize = "sm",
  className = "",
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const tooltipId = useRef(`help-tooltip-${Math.random().toString(36).substr(2, 9)}`);

  // Calcular posicion del tooltip
  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let pos = { top: 0, left: 0 };

    switch (position) {
      case "top":
        pos = {
          top: trigger.top - tooltip.height - gap,
          left: trigger.left + (trigger.width - tooltip.width) / 2,
        };
        break;
      case "bottom":
        pos = {
          top: trigger.bottom + gap,
          left: trigger.left + (trigger.width - tooltip.width) / 2,
        };
        break;
      case "left":
        pos = {
          top: trigger.top + (trigger.height - tooltip.height) / 2,
          left: trigger.left - tooltip.width - gap,
        };
        break;
      case "right":
        pos = {
          top: trigger.top + (trigger.height - tooltip.height) / 2,
          left: trigger.right + gap,
        };
        break;
      default:
        break;
    }

    // Ajustar si se sale de la pantalla
    const padding = 8;
    if (pos.left < padding) pos.left = padding;
    if (pos.left + tooltip.width > window.innerWidth - padding) {
      pos.left = window.innerWidth - tooltip.width - padding;
    }
    if (pos.top < padding) pos.top = padding;
    if (pos.top + tooltip.height > window.innerHeight - padding) {
      pos.top = window.innerHeight - tooltip.height - padding;
    }

    setTooltipPosition(pos);
  }, [isVisible, position]);

  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const handleShow = () => setIsVisible(true);
  const handleHide = () => setIsVisible(false);

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        className={clsx(
          "inline-flex items-center justify-center",
          "text-slate-400 hover:text-slate-600",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-full",
          "transition-colors duration-150",
          className
        )}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
        aria-describedby={tooltipId.current}
        aria-label="Ayuda"
      >
        <HelpCircle className={iconSizes[iconSize]} aria-hidden="true" />
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId.current}
          role="tooltip"
          className={clsx(
            "fixed z-[100]",
            "max-w-xs px-3 py-2",
            "bg-slate-900 text-white",
            "text-xs leading-relaxed",
            "rounded-lg shadow-lg",
            "animate-fade-in"
          )}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          {content}

          {/* Flecha indicadora */}
          <div
            className={clsx(
              "absolute w-2 h-2 bg-slate-900 rotate-45",
              position === "top" && "bottom-[-4px] left-1/2 -translate-x-1/2",
              position === "bottom" && "top-[-4px] left-1/2 -translate-x-1/2",
              position === "left" && "right-[-4px] top-1/2 -translate-y-1/2",
              position === "right" && "left-[-4px] top-1/2 -translate-y-1/2"
            )}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  );
}

HelpTooltip.propTypes = {
  content: PropTypes.node.isRequired,
  position: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  iconSize: PropTypes.oneOf(["xs", "sm", "md", "lg"]),
  className: PropTypes.string,
};

HelpTooltip.defaultProps = {
  position: "top",
  iconSize: "sm",
  className: "",
};

export default HelpTooltip;
