import React, { useState } from "react";
import { useI18n } from "../../context/i18n";
import { getEstadoConfig } from "../../utils/styleConfig";

/**
 * StatusBadge con icono y texto coloreado (estilo consistente con criticidad)
 * @param {string} estado - Estado de la solicitud
 * @param {string} className - Clases CSS adicionales
 * @param {boolean} showIcon - Mostrar icono (default: true)
 * @param {boolean} uppercase - Texto en mayúsculas (default: true)
 * @param {object} tooltipInfo - Info para el tooltip
 */
export default function StatusBadge({
  estado,
  className = "",
  showIcon = true,
  uppercase = true,
  tooltipInfo = null
}) {
  const { t } = useI18n();
  const config = getEstadoConfig(estado);
  const Icon = config.icon;
  const [showTooltip, setShowTooltip] = useState(false);

  // Construir lineas del tooltip
  const tooltipLines = [];
  if (tooltipInfo) {
    const estadoLower = (estado || "").toLowerCase();

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
      tooltipLines.push("Esperando aprobación...");
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

  const hasTooltip = tooltipLines.length > 0;

  // Obtener label traducida
  const getLabel = () => {
    const i18nKey = `status_${(estado || "").toLowerCase().replace(/\s+/g, "_")}`;
    return t(i18nKey, config.label || estado || "Pendiente");
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => hasTooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
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
          className={`text-xs font-semibold tracking-wide ${uppercase ? 'uppercase' : ''}`}
          style={{ color: config.color }}
        >
          {getLabel()}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && hasTooltip && (
        <div
          className="
            absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
            min-w-[220px] max-w-[300px]
            px-3 py-2.5 rounded-lg shadow-xl border
            bg-[var(--card)] border-[var(--border)]
            text-xs whitespace-normal
            animate-in fade-in-0 zoom-in-95 duration-150
          "
          role="tooltip"
        >
          <div className="space-y-1.5">
            {tooltipLines.map((line, idx) => (
              <p key={idx} className="text-[var(--fg-muted)] leading-relaxed flex items-start gap-1.5">
                <span className="text-[var(--primary)] mt-0.5">•</span>
                <span>{line}</span>
              </p>
            ))}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[var(--border)]" />
        </div>
      )}
    </div>
  );
}

// Helper para formatear fecha corta
function formatDateShort(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  } catch {
    return "";
  }
}
