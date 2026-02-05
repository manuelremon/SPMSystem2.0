/**
 * SkipLink Component - Accessibility Navigation
 *
 * Link oculto que aparece al recibir focus (Tab).
 * Permite a usuarios de teclado/lectores de pantalla saltar
 * directamente al contenido principal, evitando la navegacion.
 *
 * WCAG 2.1 AA - Criterio 2.4.1 (Bypass Blocks)
 */

import React from "react";
import PropTypes from "prop-types";
import { useI18n } from "../../context/i18n";

export function SkipLink({ targetId = "main-content", className = "" }) {
  const { t } = useI18n();

  return (
    <a
      href={`#${targetId}`}
      className={`
        sr-only focus:not-sr-only
        fixed top-4 left-4 z-[100]
        px-4 py-3
        bg-[var(--primary)] text-white
        font-medium text-sm
        rounded-lg
        shadow-lg
        focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--primary)]
        transition-all duration-200
        ${className}
      `}
    >
      {t("skip_to_content", "Saltar al contenido principal")}
    </a>
  );
}

SkipLink.propTypes = {
  targetId: PropTypes.string,
  className: PropTypes.string,
};

export default SkipLink;
