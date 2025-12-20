import React from "react";
import { Button } from "./Button";
import { AlertTriangle, X } from "./Icons";

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
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      buttonVariant: "primary",
    },
    warning: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      buttonVariant: "primary",
    },
    info: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      buttonVariant: "primary",
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;
  const IconComponent = icon || AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-full max-w-md border border-white/50 rounded-2xl p-6 animate-in zoom-in-95 duration-200"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-full ${styles.iconBg} grid place-items-center flex-shrink-0`}>
            <IconComponent className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800">
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex-shrink-0"
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
