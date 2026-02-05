import React from "react";
import PropTypes from "prop-types";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle, Info, AlertCircle } from "./Icons";

/**
 * ConfirmModal - Modal de confirmación reutilizable basado en MUI
 *
 * @param {boolean} isOpen - Si el modal está abierto
 * @param {function} onClose - Callback al cerrar
 * @param {function} onConfirm - Callback al confirmar
 * @param {string} title - Título del modal
 * @param {string|ReactNode} message - Descripción/mensaje
 * @param {string} confirmText - Texto del botón de confirmar
 * @param {string} cancelText - Texto del botón de cancelar
 * @param {string} variant - Variante: "danger" | "warning" | "info" | "primary"
 * @param {boolean} loading - Si está procesando
 * @param {ReactNode} icon - Icono personalizado (opcional)
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar acción",
  message = "¿Estás seguro de que deseas continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  loading = false,
  icon,
}) {
  const variantConfig = {
    danger: {
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      Icon: AlertTriangle,
      buttonVariant: "danger",
    },
    warning: {
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      Icon: AlertCircle,
      buttonVariant: "warning",
    },
    info: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      Icon: Info,
      buttonVariant: "primary",
    },
    primary: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      Icon: Info,
      buttonVariant: "primary",
    },
  };

  const config = variantConfig[variant] || variantConfig.danger;
  const IconComponent = icon || config.Icon;

  const handleConfirm = () => {
    onConfirm();
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Procesando..." : confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          {typeof message === 'string' ? (
            <p className="text-sm text-[var(--fg-muted)]">{message}</p>
          ) : (
            message
          )}
        </div>
      </div>
    </Modal>
  );
}

ConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.node,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(["danger", "warning", "info", "primary"]),
  loading: PropTypes.bool,
  icon: PropTypes.elementType,
};

/**
 * AlertModal - Modal de alerta (solo información)
 */
export function AlertModal({
  isOpen,
  onClose,
  title = "Aviso",
  message,
  buttonText = "Entendido",
  variant = "info",
}) {
  const variantConfig = {
    info: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      Icon: Info,
    },
    warning: {
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      Icon: AlertCircle,
    },
    danger: {
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      Icon: AlertTriangle,
    },
  };

  const config = variantConfig[variant] || variantConfig.info;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          {buttonText}
        </Button>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <config.Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          {typeof message === 'string' ? (
            <p className="text-sm text-[var(--fg-muted)]">{message}</p>
          ) : (
            message
          )}
        </div>
      </div>
    </Modal>
  );
}

AlertModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.node,
  buttonText: PropTypes.string,
  variant: PropTypes.oneOf(["info", "warning", "danger"]),
};

export default ConfirmModal;
