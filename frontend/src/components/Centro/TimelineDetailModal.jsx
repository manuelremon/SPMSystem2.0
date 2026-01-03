import React from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Bell,
  MessageSquare,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
} from "../ui/Icons";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useI18n } from "../../context/i18n";

const timelineIcons = {
  notificacion: Bell,
  mensaje: MessageSquare,
  stock_consulta: Package,
  solicitud_approved: CheckCircle,
  solicitud_rejected: XCircle,
  solicitud_planned: Clock,
  warning: AlertCircle,
  info: FileText,
};

const tipoLabels = {
  notificacion: "Notificacion",
  mensaje: "Mensaje",
  stock_consulta: "Consulta de Stock",
  solicitud_approved: "Solicitud Aprobada",
  solicitud_rejected: "Solicitud Rechazada",
  solicitud_planned: "Solicitud Planificada",
  warning: "Alerta",
  info: "Informacion",
};

const tipoColors = {
  notificacion: "bg-blue-100 text-blue-700",
  mensaje: "bg-purple-100 text-purple-700",
  stock_consulta: "bg-orange-100 text-orange-700",
  solicitud_approved: "bg-green-100 text-green-700",
  solicitud_rejected: "bg-red-100 text-red-700",
  solicitud_planned: "bg-cyan-100 text-cyan-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-gray-100 text-gray-700",
};

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TimelineDetailModal({ item, onClose }) {
  const navigate = useNavigate();
  const { t } = useI18n();

  if (!item) return null;

  const subtipo = item.subtipo || item.tipo;
  const IconComponent = timelineIcons[subtipo] || timelineIcons[item.tipo] || FileText;
  const label = tipoLabels[subtipo] || tipoLabels[item.tipo] || "Actividad";
  const colorClass = tipoColors[subtipo] || tipoColors[item.tipo] || tipoColors.info;

  const handleVerSolicitud = () => {
    onClose();
    navigate(`/solicitud/${item.solicitud_id}`);
  };

  const handleIrAModulo = () => {
    onClose();
    if (item.tipo === "notificacion") {
      navigate("/notificaciones");
    } else if (item.tipo === "mensaje") {
      navigate("/mensajes");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/50 overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colorClass}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <Badge className={colorClass}>{label}</Badge>
              <p className="text-xs text-gray-500 mt-1">
                {formatDateTime(item.created_at)}
              </p>
            </div>
          </div>

          <Button
            onClick={onClose}
            variant="icon"
            size="icon-md"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t("centro_timeline_detalle", "Detalle de Actividad")}
          </h3>
          <p className="text-gray-700 leading-relaxed">{item.descripcion}</p>

          {item.solicitud_id && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">
                {t("centro_solicitud_relacionada", "Solicitud relacionada")}:{" "}
                <span className="font-bold">#{item.solicitud_id}</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={handleIrAModulo}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {item.tipo === "mensaje"
              ? t("centro_ir_mensajes", "Ir a Mensajes")
              : t("centro_ir_notificaciones", "Ir a Notificaciones")}
          </Button>

          {item.solicitud_id && (
            <Button size="sm" onClick={handleVerSolicitud}>
              <FileText className="w-4 h-4 mr-2" />
              {t("centro_ver_solicitud", "Ver Solicitud")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
