import React from "react";
import { Button } from "./Button";
import { AlertTriangle, X } from "lucide-react";

/**
 * Modal de confirmación reutilizable
 * @param {boolean} isOpen - Si el modal está abierto
 * @param {function} onClose - Callback al cerrar
 * @param {function} onConfirm - Callback al confirmar
 * @param {string} title - Título del modal
 * @param {string} description - Descripción/mensaje
 * @param {string} confirmText - Texto del botón de confirmar
 * @param {string} cancelText - Texto del botón de cancelar
 * @param {string} variant - Variante: "danger" | "warning" | "info"
 * @param {boolean} loading - Si está procesando
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar acción",
  description = "¿Estás seguro de que deseas continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  loading = false,
  icon,
}) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: "bg-[var(--danger-bg)]",
      iconColor: "text-[var(--danger)]",
      buttonVariant: "danger",
    },
    warning: {
      iconBg: "bg-[var(--warning-bg)]",
      iconColor: "text-[var(--warning)]",
      buttonVariant: "warning",
    },
    info: {
      iconBg: "bg-[var(--info-bg)]",
      iconColor: "text-[var(--info)]",
      buttonVariant: "primary",
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;
  const IconComponent = icon || AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-strong)] rounded-2xl p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-full ${styles.iconBg} grid place-items-center flex-shrink-0`}>
            <IconComponent className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[var(--fg)]">
              {title}
            </h3>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)] transition-all flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={styles.buttonVariant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
