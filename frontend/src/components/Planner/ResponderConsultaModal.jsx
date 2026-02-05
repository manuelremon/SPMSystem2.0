import React, { useState } from "react";
import PropTypes from "prop-types";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";

// MUI Icons
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import InventoryIcon from "@mui/icons-material/Inventory";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ChatIcon from "@mui/icons-material/Chat";
import SyncIcon from "@mui/icons-material/Sync";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Opciones de respuesta a consulta de stock
 */
const OPCIONES_RESPUESTA = {
  CONFIRMAR_TOTAL: "confirmar_total",
  CONFIRMAR_PARCIAL: "confirmar_parcial",
  CEDER_CON_DEVOLUCION: "ceder_con_devolucion",
  ENVIAR_MENSAJE: "enviar_mensaje",
  NO_DISPONIBLE: "no_disponible",
};

/**
 * Modal para responder consultas de disponibilidad de stock.
 * Permite confirmar total/parcial, ceder con devolucion, negociar o rechazar.
 */
export default function ResponderConsultaModal({ consulta, onClose, onSuccess }) {
  const { t } = useI18n();
  const [opcionSeleccionada, setOpcionSeleccionada] = useState(null);
  const [cantidadConfirmada, setCantidadConfirmada] = useState(
    consulta?.cantidad_asignada || 0
  );
  const [fechaDisponibilidad, setFechaDisponibilidad] = useState("");
  const [fechaDevolucion, setFechaDevolucion] = useState("");
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!consulta) return null;

  const cantidadSolicitada = consulta.cantidad_asignada || 0;

  const handleSubmit = async () => {
    if (!opcionSeleccionada) {
      setError(t("consulta_seleccionar_opcion", "Selecciona una opcion"));
      return;
    }

    // Validaciones segun opcion
    if (opcionSeleccionada === OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL) {
      if (!cantidadConfirmada || Number(cantidadConfirmada) <= 0) {
        setError("Indica la cantidad que puedes ceder");
        return;
      }
      if (Number(cantidadConfirmada) >= cantidadSolicitada) {
        setError("Para cantidad completa, usa 'Confirmar Total'");
        return;
      }
    }

    if (opcionSeleccionada === OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION) {
      if (!fechaDevolucion) {
        setError("Indica la fecha esperada de devolucion");
        return;
      }
    }

    if (opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE) {
      if (!comentario.trim()) {
        setError("Escribe el mensaje que deseas enviar");
        return;
      }
    }

    if (opcionSeleccionada === OPCIONES_RESPUESTA.NO_DISPONIBLE) {
      if (!comentario.trim()) {
        setError("Indica el motivo por el cual no esta disponible");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      // Determinar valores segun opcion
      let acepta = true;
      let cantidad = cantidadSolicitada;
      let notas = comentario;

      switch (opcionSeleccionada) {
        case OPCIONES_RESPUESTA.CONFIRMAR_TOTAL:
          acepta = true;
          cantidad = cantidadSolicitada;
          break;
        case OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL:
          acepta = true;
          cantidad = Number(cantidadConfirmada);
          break;
        case OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION:
          acepta = true;
          cantidad = Number(cantidadConfirmada) || cantidadSolicitada;
          notas = `[DEVOLUCION REQUERIDA para ${fechaDevolucion}] ${comentario}`.trim();
          break;
        case OPCIONES_RESPUESTA.ENVIAR_MENSAJE:
          // Enviar mensaje sin confirmar/rechazar
          const msgRes = await api.post("/mensajes/enviar", {
            destinatario_id: consulta.planner_id,
            asunto: `Consulta Stock Solicitud #${consulta.solicitud_id}`,
            contenido: comentario,
            solicitud_id: consulta.solicitud_id,
          });
          if (msgRes.data?.ok) {
            onSuccess?.();
          } else {
            setError(msgRes.data?.error || "Error al enviar mensaje");
          }
          setLoading(false);
          return;
        case OPCIONES_RESPUESTA.NO_DISPONIBLE:
          acepta = false;
          cantidad = 0;
          break;
        default:
          break;
      }

      const res = await api.post(`/planificador/responder-consulta/${consulta.fuente_id}`, {
        acepta,
        cantidad_confirmada: cantidad,
        fecha_disponibilidad: fechaDisponibilidad || null,
        comentario: notas,
      });

      if (res.data?.ok) {
        onSuccess?.();
      } else {
        setError(res.data?.error || "Error al enviar respuesta");
      }
    } catch (err) {
      console.error("Error respondiendo consulta:", err);
      setError(err.response?.data?.error || "Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  // Parse material info from data_json if available
  let materialInfo = null;
  try {
    if (consulta.data_json) {
      const data = typeof consulta.data_json === "string"
        ? JSON.parse(consulta.data_json)
        : consulta.data_json;
      materialInfo = data.items?.[consulta.item_index || 0] || data.items?.[0] || null;
    }
  } catch {
    // Ignore parse errors
  }

  // Configuracion de opciones
  const opciones = [
    {
      id: OPCIONES_RESPUESTA.CONFIRMAR_TOTAL,
      icon: CheckCircleIcon,
      label: "Confirmar Total",
      desc: `Cedo las ${cantidadSolicitada} unidades solicitadas`,
      color: "success",
    },
    {
      id: OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL,
      icon: WarningAmberIcon,
      label: "Confirmar Parcial",
      desc: "Puedo ceder una cantidad menor",
      color: "warning",
    },
    {
      id: OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION,
      icon: SyncIcon,
      label: "Ceder con Devolucion",
      desc: "Cedo temporalmente, requiero devolucion",
      color: "info",
    },
    {
      id: OPCIONES_RESPUESTA.ENVIAR_MENSAJE,
      icon: ChatIcon,
      label: "Enviar Mensaje",
      desc: "Negociar o consultar antes de decidir",
      color: "secondary",
    },
    {
      id: OPCIONES_RESPUESTA.NO_DISPONIBLE,
      icon: CancelIcon,
      label: "No Disponible",
      desc: "No puedo ceder el material",
      color: "error",
    },
  ];

  const getOptionStyles = (color, isSelected) => {
    const colorMap = {
      success: { main: "success.main", light: "success.light", bg: "rgba(46, 125, 50, 0.08)" },
      warning: { main: "warning.main", light: "warning.light", bg: "rgba(237, 108, 2, 0.08)" },
      info: { main: "info.main", light: "info.light", bg: "rgba(2, 136, 209, 0.08)" },
      secondary: { main: "secondary.main", light: "secondary.light", bg: "rgba(156, 39, 176, 0.08)" },
      error: { main: "error.main", light: "error.light", bg: "rgba(211, 47, 47, 0.08)" },
    };
    const colors = colorMap[color] || colorMap.success;

    if (isSelected) {
      return {
        bgcolor: colors.main,
        color: "white",
        borderColor: colors.main,
        "&:hover": { bgcolor: colors.main },
      };
    }
    return {
      bgcolor: "background.paper",
      borderColor: "divider",
      "&:hover": { borderColor: colors.main, bgcolor: colors.bg },
    };
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("consulta_responder_titulo", "Responder Consulta de Stock")}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Info de la consulta */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "grey.50" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <InventoryIcon sx={{ color: "primary.main" }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t("consulta_solicitud", "Solicitud")} #{consulta.solicitud_id}
              </Typography>
              {consulta.criticidad && (
                <Chip
                  label={consulta.criticidad}
                  size="small"
                  color={consulta.criticidad === "alta" ? "error" : "default"}
                />
              )}
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Centro/Almacen:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {consulta.centro_origen}/{consulta.almacen_origen}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Cantidad Solicitada:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {cantidadSolicitada} uds
                </Typography>
              </Box>
              {(consulta.material_id || materialInfo) && (
                <Box sx={{ gridColumn: "span 2" }}>
                  <Typography variant="caption" color="text.secondary">Material:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {consulta.material_id || materialInfo?.codigo} - {consulta.material_descripcion || materialInfo?.descripcion}
                  </Typography>
                </Box>
              )}
              <Box sx={{ gridColumn: "span 2" }}>
                <Typography variant="caption" color="text.secondary">Solicitado por:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {consulta.planner_nombre || `Planificador #${consulta.planner_id}`}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Opciones de respuesta */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              Selecciona tu respuesta:
            </Typography>
            <Stack spacing={1}>
              {opciones.map((opcion) => {
                const Icon = opcion.icon;
                const isSelected = opcionSeleccionada === opcion.id;
                return (
                  <Paper
                    key={opcion.id}
                    component="button"
                    type="button"
                    onClick={() => {
                      setOpcionSeleccionada(opcion.id);
                      setError("");
                      if (opcion.id === OPCIONES_RESPUESTA.CONFIRMAR_TOTAL) {
                        setCantidadConfirmada(cantidadSolicitada);
                      }
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 1.5,
                      borderRadius: 2,
                      border: 2,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      ...getOptionStyles(opcion.color, isSelected),
                    }}
                  >
                    <Icon sx={{ fontSize: 24, color: isSelected ? "inherit" : `${opcion.color}.main` }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {opcion.label}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: isSelected ? 0.8 : 0.7 }}>
                        {opcion.desc}
                      </Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          </Box>

          {/* Campos adicionales segun opcion */}
          {opcionSeleccionada === OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(237, 108, 2, 0.05)", borderColor: "warning.light" }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Cantidad que puedo ceder *
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ min: 1, max: cantidadSolicitada - 1 }}
                    value={cantidadConfirmada}
                    onChange={(e) => setCantidadConfirmada(e.target.value)}
                    placeholder={`Maximo ${cantidadSolicitada - 1}`}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    Se solicitaron {cantidadSolicitada} unidades
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 16 }} />
                    Fecha disponibilidad (opcional)
                  </Typography>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    value={fechaDisponibilidad}
                    onChange={(e) => setFechaDisponibilidad(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Stack>
            </Paper>
          )}

          {opcionSeleccionada === OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(2, 136, 209, 0.05)", borderColor: "info.light" }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Cantidad a ceder temporalmente
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    inputProps={{ min: 1, max: cantidadSolicitada }}
                    value={cantidadConfirmada}
                    onChange={(e) => setCantidadConfirmada(e.target.value)}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 16 }} />
                    Fecha esperada de devolucion *
                  </Typography>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    value={fechaDevolucion}
                    onChange={(e) => setFechaDevolucion(e.target.value)}
                    inputProps={{ min: new Date().toISOString().split("T")[0] }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Typography variant="caption" color="info.main">
                  El solicitante sera notificado del compromiso de devolucion
                </Typography>
              </Stack>
            </Paper>
          )}

          {opcionSeleccionada === OPCIONES_RESPUESTA.CONFIRMAR_TOTAL && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(46, 125, 50, 0.05)", borderColor: "success.light" }}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 16 }} />
                  Fecha disponibilidad (opcional)
                </Typography>
                <TextField
                  type="date"
                  size="small"
                  fullWidth
                  value={fechaDisponibilidad}
                  onChange={(e) => setFechaDisponibilidad(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Indica cuando estara listo para ser retirado/transferido
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Comentario/Mensaje */}
          {opcionSeleccionada && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                <ChatIcon sx={{ fontSize: 16 }} />
                {opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE
                  ? "Mensaje para el planificador *"
                  : opcionSeleccionada === OPCIONES_RESPUESTA.NO_DISPONIBLE
                    ? "Motivo del rechazo *"
                    : "Notas adicionales (opcional)"}
              </Typography>
              <TextField
                multiline
                rows={3}
                fullWidth
                size="small"
                placeholder={
                  opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE
                    ? "Escribe tu consulta o propuesta..."
                    : opcionSeleccionada === OPCIONES_RESPUESTA.NO_DISPONIBLE
                      ? "Indica el motivo (material comprometido, stock critico, etc.)..."
                      : "Notas adicionales sobre la disponibilidad..."
                }
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
            </Box>
          )}

          {/* Error message */}
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          {t("common_cancel", "Cancelar")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!opcionSeleccionada || loading}
          startIcon={loading ? <SyncIcon sx={{ animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }} /> : opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE ? <SendIcon /> : <CheckCircleIcon />}
        >
          {loading ? "Enviando..." : opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE ? "Enviar Mensaje" : "Confirmar Respuesta"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ResponderConsultaModal.propTypes = {
  consulta: PropTypes.shape({
    fuente_id: PropTypes.number.isRequired,
    decision_id: PropTypes.number,
    solicitud_id: PropTypes.number.isRequired,
    item_index: PropTypes.number,
    centro_origen: PropTypes.string,
    almacen_origen: PropTypes.string,
    cantidad_asignada: PropTypes.number,
    estado_consulta: PropTypes.string,
    criticidad: PropTypes.string,
    data_json: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    planner_id: PropTypes.string,
    planner_nombre: PropTypes.string,
    material_id: PropTypes.string,
    material_descripcion: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
