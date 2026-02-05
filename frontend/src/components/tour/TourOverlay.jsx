/**
 * TourOverlay Component
 *
 * Overlay oscuro que cubre la pantalla durante el tour,
 * dejando visible solo el elemento objetivo (spotlight effect).
 */

import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

export function TourOverlay({ targetSelector, isVisible, onClick }) {
  const [clipPath, setClipPath] = useState("");

  // Calcular el clip path para crear el "agujero" del spotlight
  const updateClipPath = useCallback(() => {
    if (!targetSelector) {
      // Sin target, no hay agujero
      setClipPath("");
      return;
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
      setClipPath("");
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 8;

    // Crear un clip path que excluya el area del elemento
    // Usamos polygon para crear un frame alrededor del elemento
    const x1 = rect.left - padding;
    const y1 = rect.top - padding;
    const x2 = rect.right + padding;
    const y2 = rect.bottom + padding;

    // Clip path con un agujero rectangular
    // El path va: esquina exterior -> esquina interior -> vuelta -> exterior
    const path = `
      polygon(
        0% 0%,
        0% 100%,
        ${x1}px 100%,
        ${x1}px ${y1}px,
        ${x2}px ${y1}px,
        ${x2}px ${y2}px,
        ${x1}px ${y2}px,
        ${x1}px 100%,
        100% 100%,
        100% 0%
      )
    `;

    setClipPath(path);
  }, [targetSelector]);

  useEffect(() => {
    updateClipPath();

    window.addEventListener("resize", updateClipPath);
    window.addEventListener("scroll", updateClipPath, true);

    return () => {
      window.removeEventListener("resize", updateClipPath);
      window.removeEventListener("scroll", updateClipPath, true);
    };
  }, [updateClipPath]);

  if (!isVisible) return null;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[9997]",
        "bg-black/60",
        "transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{
        clipPath: clipPath || undefined,
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

TourOverlay.propTypes = {
  targetSelector: PropTypes.string,
  isVisible: PropTypes.bool.isRequired,
  onClick: PropTypes.func,
};

TourOverlay.defaultProps = {
  onClick: () => {},
};

export default TourOverlay;
