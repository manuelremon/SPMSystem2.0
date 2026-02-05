/**
 * Alert Component - MUI Alert
 * Alertas profesionales con estilo MUI
 */

import React from "react";
import PropTypes from "prop-types";
import MuiAlert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import CloseIcon from "@mui/icons-material/Close";

// Mapeo de variantes legacy a severity MUI
const severityMap = {
  success: 'success',
  danger: 'error',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

/**
 * Alert - Componente de alerta con MUI Alert
 *
 * @param {React.ReactNode} children - Contenido de la alerta
 * @param {string} message - Mensaje alternativo (si no hay children)
 * @param {string} title - Título opcional de la alerta
 * @param {string} variant - Variante: 'success' | 'danger' | 'error' | 'warning' | 'info'
 * @param {string} severity - Alias de variant (compatibilidad MUI)
 * @param {boolean} showIcon - Mostrar icono (default: true)
 * @param {function} onClose - Callback para cerrar (muestra botón X)
 * @param {function} onDismiss - Alias de onClose (compatibilidad)
 * @param {boolean} dismissible - Hacer la alerta descartable
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {object} sx - Estilos MUI adicionales
 */
export function Alert({
  children,
  message,
  title,
  variant = "info",
  severity,
  showIcon = true,
  onClose,
  onDismiss,
  dismissible,
  className,
  sx,
  ...props
}) {
  const [open, setOpen] = React.useState(true);

  const content = children || message;
  if (!content) return null;

  const muiSeverity = severityMap[severity || variant] || 'info';
  const handleClose = onClose || onDismiss;
  const canDismiss = dismissible || !!handleClose;

  const handleDismiss = () => {
    setOpen(false);
    if (handleClose) handleClose();
  };

  const alertContent = (
    <MuiAlert
      severity={muiSeverity}
      icon={showIcon ? undefined : false}
      className={className}
      sx={{
        borderRadius: '8px',
        '& .MuiAlert-message': {
          width: '100%',
        },
        ...sx,
      }}
      action={
        canDismiss ? (
          <IconButton
            aria-label="Cerrar alerta"
            color="inherit"
            size="small"
            onClick={handleDismiss}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        ) : undefined
      }
      {...props}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {content}
    </MuiAlert>
  );

  // Si es dismissible, usar Collapse para animación
  if (canDismiss) {
    return (
      <Collapse in={open}>
        {alertContent}
      </Collapse>
    );
  }

  return alertContent;
}

Alert.propTypes = {
  children: PropTypes.node,
  message: PropTypes.string,
  title: PropTypes.string,
  variant: PropTypes.oneOf(["success", "danger", "error", "warning", "info"]),
  severity: PropTypes.oneOf(["success", "error", "warning", "info"]),
  showIcon: PropTypes.bool,
  onClose: PropTypes.func,
  onDismiss: PropTypes.func,
  dismissible: PropTypes.bool,
  className: PropTypes.string,
  sx: PropTypes.object,
};

export default Alert;
