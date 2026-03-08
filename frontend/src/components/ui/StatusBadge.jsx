import React, { memo } from "react";
import { useI18n } from "../../context/i18n";
import { getEstadoConfig } from "../../utils/styleConfig";
import { formatDate } from "../../utils/formatters";
import Tooltip from "@mui/material/Tooltip";

/**
 * StatusBadge con icono y texto coloreado (estilo consistente con criticidad)
 * Memoizado para evitar re-renders innecesarios en tablas
 * @param {string} estado - Estado de la solicitud
 * @param {string} className - Clases CSS adicionales
 * @param {boolean} showIcon - Mostrar icono (default: true)
 * @param {boolean} uppercase - Texto en mayúsculas (default: true)
 * @param {object} tooltipInfo - Info para el tooltip
 * @param {boolean} disableTooltip - Desactivar tooltip interno (default: false)
 */
const StatusBadge = memo(function StatusBadge({
  estado,
  className = "",
  showIcon = true,
  uppercase = true,
  tooltipInfo = null,
  disableTooltip = false
}) {
  const { t } = useI18n();
  const config = getEstadoConfig(estado);
  const Icon = config.IconComponent;

  // Construir lineas del tooltip
  const tooltipLines = [];
  const estadoLower = (estado || "").toLowerCase();

  // Tooltip por defecto para estados (sin necesidad de tooltipInfo)
  if (!tooltipInfo) {
    if (["pendiente", "pendiente_de_aprobacion", "enviada", "submitted"].includes(estadoLower)) {
      tooltipLines.push("Esperando aprobación del coordinador");
    } else if (["borrador", "draft"].includes(estadoLower)) {
      tooltipLines.push("Borrador - No enviada aún");
    } else if (["aprobada", "approved"].includes(estadoLower)) {
      tooltipLines.push("Aprobada - Pendiente de planificación");
    } else if (["en_planificacion", "planificacion", "in_planning"].includes(estadoLower)) {
      tooltipLines.push("En proceso de planificación de abastecimiento");
    } else if (["en_tratamiento", "in_treatment"].includes(estadoLower)) {
      tooltipLines.push("En fase de tratamiento y adquisición");
    } else if (["tratado", "treated"].includes(estadoLower)) {
      tooltipLines.push("Tratamiento completado - Listo para entrega");
    } else if (["rechazada", "rejected"].includes(estadoLower)) {
      tooltipLines.push("Solicitud rechazada - Puede reenviar");
    } else if (["cerrada", "closed"].includes(estadoLower)) {
      tooltipLines.push("Solicitud finalizada exitosamente");
    } else if (["cancelada", "cancelled"].includes(estadoLower)) {
      tooltipLines.push("Solicitud cancelada");
    } else if (["despachada", "dispatched", "completada", "completed"].includes(estadoLower)) {
      tooltipLines.push("Solicitud completada");
    }
  }

  // Tooltip con info adicional (si se proporciona tooltipInfo)
  if (tooltipInfo) {
    // Fecha y aprobador (para estados aprobados)
    if (tooltipInfo.aprobador && ["aprobada", "approved", "en_planificacion", "planificacion"].includes(estadoLower)) {
      const fechaAprobacion = tooltipInfo.fechaAprobacion
        ? formatDateShort(tooltipInfo.fechaAprobacion)
        : "";
      tooltipLines.push(
        fechaAprobacion
          ? `Aprobada el ${fechaAprobacion} por ${tooltipInfo.aprobador}`
          : `Aprobada por ${tooltipInfo.aprobador}`
      );
    }

    // Planificador asignado
    if (tooltipInfo.planificador && ["aprobada", "approved", "en_planificacion", "planificacion", "progreso", "proceso"].includes(estadoLower)) {
      tooltipLines.push(`Asignada al Planificador ${tooltipInfo.planificador}`);
    }

    // Estado enviada - esperando aprobacion
    if (["enviada", "submitted", "pendiente", "pendiente_de_aprobacion"].includes(estadoLower)) {
      if (tooltipInfo.fechaEnvio) {
        tooltipLines.push(`Enviada el ${formatDateShort(tooltipInfo.fechaEnvio)}`);
      }
      // Mostrar nombre del aprobador asignado si está disponible
      if (tooltipInfo.aprobador) {
        tooltipLines.push(`Esperando aprobación de ${tooltipInfo.aprobador}`);
      } else {
        tooltipLines.push("Esperando aprobación...");
      }
    }

    // Estado rechazada
    if (["rechazada", "rejected"].includes(estadoLower) && tooltipInfo.aprobador) {
      const fechaRechazo = tooltipInfo.fechaRechazo
        ? formatDateShort(tooltipInfo.fechaRechazo)
        : "";
      tooltipLines.push(
        fechaRechazo
          ? `Rechazada el ${fechaRechazo} por ${tooltipInfo.aprobador}`
          : `Rechazada por ${tooltipInfo.aprobador}`
      );
    }

    // Estado borrador
    if (["borrador", "draft"].includes(estadoLower)) {
      tooltipLines.push("Borrador - No enviada aún");
    }
  }

  const hasTooltip = !disableTooltip && tooltipLines.length > 0;

  // Obtener label traducida
  const getLabel = () => {
    const i18nKey = `status_${(estado || "").toLowerCase().replace(/\s+/g, "_")}`;
    return t(i18nKey, config.label || estado || "Pendiente");
  };

  // Contenido del tooltip
  const tooltipContent = hasTooltip ? (
    <div style={{ padding: "4px 0" }}>
      {tooltipLines.map((line, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: idx < tooltipLines.length - 1 ? "4px" : 0 }}>
          <span style={{ color: "var(--primary)" }}>•</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  ) : "";

  const badgeContent = (
    <div
      className={`
        inline-flex items-center gap-1.5
        transition-all duration-[var(--transition-fast)]
        ${hasTooltip ? 'cursor-help' : ''}
        ${className}
      `}
    >
      {showIcon && Icon && (
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: config.color }}
        />
      )}
      <span
        className="text-xs font-semibold"
        style={{ color: config.color }}
      >
        {getLabel()}
      </span>
    </div>
  );

  if (!hasTooltip) {
    return badgeContent;
  }

  return (
    <Tooltip
      title={tooltipContent}
      arrow
      placement="top"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: "var(--card)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: "0.75rem",
            maxWidth: 300,
            "& .MuiTooltip-arrow": {
              color: "var(--card)",
              "&::before": {
                border: "1px solid var(--border)",
              },
            },
          },
        },
      }}
    >
      {badgeContent}
    </Tooltip>
  );
});

export default StatusBadge;

// Helper para formatear fecha corta - usa formatDate de formatters
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const result = formatDate(dateStr);
  return result === "N/D" ? "" : result;
}
