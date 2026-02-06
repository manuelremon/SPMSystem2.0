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
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Paper,
} from "@mui/material";
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
  notificacion: { bg: "rgba(59, 130, 246, 0.12)", color: "var(--primary)" },
  mensaje: { bg: "rgba(168, 85, 247, 0.12)", color: "#a855f7" },
  stock_consulta: { bg: "rgba(249, 115, 22, 0.12)", color: "#f97316" },
  solicitud_approved: { bg: "rgba(34, 197, 94, 0.12)", color: "var(--success)" },
  solicitud_rejected: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" },
  solicitud_planned: { bg: "rgba(6, 182, 212, 0.12)", color: "#06b6d4" },
  warning: { bg: "rgba(245, 158, 11, 0.12)", color: "var(--warning)" },
  info: { bg: "var(--bg-soft)", color: "var(--fg-muted)" },
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
  const colors = tipoColors[subtipo] || tipoColors[item.tipo] || tipoColors.info;

  const handleVerSolicitud = () => {
    onClose();
    navigate(`/solicitudes/${item.solicitud_id}`);
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
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: colors.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconComponent style={{ width: 24, height: 24, color: colors.color }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Chip
              label={label}
              size="small"
              sx={{
                bgcolor: colors.bg,
                color: colors.color,
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            />
            <Typography variant="caption" sx={{ color: "var(--fg-muted)", display: "block", mt: 0.5 }}>
              {formatDateTime(item.created_at)}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <X style={{ width: 20, height: 20, color: "var(--fg-muted)" }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--fg-strong)", mb: 2 }}>
          {t("centro_timeline_detalle", "Detalle de Actividad")}
        </Typography>
        <Typography variant="body1" sx={{ color: "var(--fg-strong)", lineHeight: 1.6 }}>
          {item.descripcion}
        </Typography>

        {item.solicitud_id && (
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              p: 2,
              bgcolor: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: "var(--primary)", fontWeight: 500 }}>
              {t("centro_solicitud_relacionada", "Solicitud relacionada")}:{" "}
              <strong>#{item.solicitud_id}</strong>
            </Typography>
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleIrAModulo}
          startIcon={<ExternalLink style={{ width: 16, height: 16 }} />}
          sx={{ color: "var(--fg-muted)", borderColor: "var(--border)", textTransform: "none" }}
        >
          {item.tipo === "mensaje"
            ? t("centro_ir_mensajes", "Ir a Mensajes")
            : t("centro_ir_notificaciones", "Ir a Notificaciones")}
        </Button>

        {item.solicitud_id && (
          <Button
            variant="contained"
            size="small"
            onClick={handleVerSolicitud}
            startIcon={<FileText style={{ width: 16, height: 16 }} />}
            sx={{ bgcolor: "#567ebb", "&:hover": { bgcolor: "#4a6da8" }, textTransform: "none" }}
          >
            {t("centro_ver_solicitud", "Ver Solicitud")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
