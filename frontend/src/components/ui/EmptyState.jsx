import React from "react";
import { FileX } from "lucide-react";

/**
 * Componente para mostrar estados vacíos con CTA opcional
 * @param {React.ReactNode} icon - Icono a mostrar (default: FileX)
 * @param {string} title - Título del estado vacío
 * @param {string} description - Descripción opcional
 * @param {React.ReactNode} action - Botón o acción opcional
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="h-16 w-16 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] grid place-items-center mb-4">
        {icon || <FileX className="w-8 h-8 text-[var(--fg-subtle)]" />}
      </div>
      <h3 className="text-lg font-medium text-[var(--fg)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--fg-muted)] mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
