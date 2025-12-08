import React from "react";
import clsx from "clsx";

/**
 * Label - Componente estandarizado para etiquetas de formulario
 * Estilo: Uppercase, tracking-wide, color muted
 *
 * @param {string} htmlFor - ID del input asociado
 * @param {boolean} required - Muestra asterisco si es requerido
 * @param {string} className - Clases adicionales
 * @param {React.ReactNode} children - Contenido del label
 */
export function Label({ htmlFor, required = false, className, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className={clsx(
        "text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide",
        "block mb-1.5",
        className
      )}
    >
      {children}
      {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
    </label>
  );
}

export default Label;
