import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Paper,
  Button as MuiButton,
  Chip,
  Stack,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../context/i18n";

// MUI Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningIcon from "@mui/icons-material/Warning";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EmailIcon from "@mui/icons-material/Email";
import DescriptionIcon from "@mui/icons-material/Description";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const ESTADO_CONFIG = {
  pendiente: {
    label: "Pendiente",
    icon: AccessTimeIcon,
    color: "var(--fg-muted)",
    bg: "var(--neutral-bg)",
  },
  transferencia_solicitada: {
    label: "Traspaso Solicitado",
    icon: SendIcon,
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
  esperando_confirmacion: {
    label: "Esperando Confirmacion",
    icon: AccessTimeIcon,
    color: "var(--warning)",
    bg: "var(--warning-bg)",
  },
  confirmado: {
    label: "Confirmado",
    icon: CheckCircleOutlinedIcon,
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
  rechazado: {
    label: "Rechazado",
    icon: CancelIcon,
    color: "var(--danger)",
    bg: "var(--danger-bg)",
  },
  solped_pendiente: {
    label: "SOLPED Pendiente",
    icon: WarningIcon,
    color: "var(--info)",
    bg: "var(--info-bg)",
  },
};

const TIPO_ACCION_CONFIG = {
  traspaso_mismo_centro: {
    label: "Traspaso de Almacen",
    descripcion: "Notificar al almacen para traspaso interno",
    icon: Inventory2Icon,
    color: "var(--success)",
    bg: "var(--success-bg)",
  },
  consulta_otro_centro: {
    label: "Consulta a Referente",
    descripcion: "Solicitar confirmacion de disponibilidad",
    icon: EmailIcon,
    color: "var(--warning)",
    bg: "var(--warning-bg)",
  },
  solped_proveedor: {
    label: "Generar SOLPED",
    descripcion: "Pendiente generacion en SAP",
    icon: DescriptionIcon,
    color: "var(--info)",
    bg: "var(--info-bg)",
  },
};

export default function Paso4AccionesPendientes({
  solicitudId,
  solicitud,
  items = [],
  decisiones = {},
  acciones = null,
  loading = false,
  onEjecutarAcciones,
}) {
  const { t } = useI18n();
  const [ejecutando, setEjecutando] = useState(false);
  const [resultadoAcciones, setResultadoAcciones] = useState(acciones);
  const [enviarResumenSolicitante, setEnviarResumenSolicitante] = useState(false);
  const [selectedAccion, setSelectedAccion] = useState(null);
  const [showMensajeModal, setShowMensajeModal] = useState(false);

  const handleEstadoClick = (accion) => {
    setSelectedAccion(accion);
    setShowMensajeModal(true);
  };

  const handleCloseMensajeModal = () => {
    setShowMensajeModal(false);
    setSelectedAccion(null);
  };

  useEffect(() => {
    if (acciones) {
      setResultadoAcciones(acciones);
    }
  }, [acciones]);

  // Generar preview de acciones basado en las decisiones
  const previewAcciones = useMemo(() => {
    const preview = {
      traspasos: [],
      consultas: [],
      solpeds: [],
    };

    const centroSolicitud = solicitud?.centro;

    Object.entries(decisiones).forEach(([idx, decision]) => {
      const itemIdx = Number(idx);
      const item = items[itemIdx] || {};

      (decision.fuentes || []).forEach((fuente) => {
        const opcion = fuente.opcion || {};
        const tipoFuente = opcion.tipo;
        const centroOrigen = opcion.centro_origen || opcion.centro;
        const almacenOrigen = opcion.almacen_origen || opcion.almacen;
        const cantidad = Number(fuente.cantidad_asignada || 0);

        const accionBase = {
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad,
          centroOrigen,
          almacenOrigen,
        };

        if (tipoFuente === "stock" || tipoFuente === "transferencia") {
          // B5: Null check para centroOrigen - si no hay centro, asumir mismo centro
          const esMismoCentro = !centroOrigen || centroOrigen === centroSolicitud;

          if (esMismoCentro) {
            // Traspaso mismo centro
            preview.traspasos.push({
              ...accionBase,
              tipo: "traspaso_mismo_centro",
              destinatario: `Almacen ${centroOrigen || centroSolicitud}/${almacenOrigen || "0001"}`,
              accion: "Notificar traspaso al almacen",
            });
          } else {
            // Consulta a otro centro
            preview.consultas.push({
              ...accionBase,
              tipo: "consulta_otro_centro",
              destinatario: `Referente Centro ${centroOrigen}`,
              accion: "Enviar consulta de disponibilidad",
            });
          }
        } else if (tipoFuente === "equivalencia") {
          // Equivalencias - tratar según ubicación del stock
          const esMismoCentro = !centroOrigen || centroOrigen === centroSolicitud;
          if (esMismoCentro) {
            preview.traspasos.push({
              ...accionBase,
              tipo: "traspaso_mismo_centro",
              destinatario: `Almacen ${centroOrigen || centroSolicitud}/${almacenOrigen || "0001"}`,
              accion: "Notificar traspaso (equivalencia)",
              esEquivalencia: true,
            });
          } else {
            preview.consultas.push({
              ...accionBase,
              tipo: "consulta_otro_centro",
              destinatario: `Referente Centro ${centroOrigen}`,
              accion: "Consulta equivalencia disponible",
              esEquivalencia: true,
            });
          }
        } else if (tipoFuente === "proveedor") {
          // SOLPED a proveedor
          preview.solpeds.push({
            ...accionBase,
            tipo: "solped_proveedor",
            destinatario: opcion.nombre || opcion.nombre_proveedor || "Proveedor",
            accion: "Generar SOLPED en SAP",
            plazo: opcion.plazo_dias,
          });
        }
      });
    });

    return preview;
  }, [decisiones, items, solicitud?.centro]);

  const handleEjecutar = async () => {
    if (!onEjecutarAcciones) return;
    setEjecutando(true);
    try {
      const resultado = await onEjecutarAcciones({
        enviarResumenSolicitante,
      });
      setResultadoAcciones(resultado);
    } catch (error) {
    } finally {
      setEjecutando(false);
    }
  };

  const totalAccionesPendientes =
    previewAcciones.traspasos.length +
    previewAcciones.consultas.length +
    previewAcciones.solpeds.length;

  // Si ya se ejecutaron las acciones, mostrar resultados
  if (resultadoAcciones) {
    const accionesStock = (resultadoAcciones?.acciones || []).filter(
      (a) => a.tipo_fuente === "stock" || a.tipo_fuente === "transferencia"
    );
    const accionesCompra = (resultadoAcciones?.acciones || []).filter(
      (a) => a.tipo_fuente === "proveedor"
    );

    return (
      <Stack spacing={3}>
        {/* Resumen de resultados */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: "var(--bg-soft)",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CheckCircleOutlinedIcon sx={{ fontSize: 20, color: "var(--success)" }} />
              <Typography sx={{ fontWeight: 500, color: "var(--fg-strong)" }}>
                {t('planner_acciones_ejecutadas', 'Acciones Ejecutadas')}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} sx={{ fontSize: 14 }}>
              <Typography sx={{ color: "var(--fg-muted)" }}>
                <Box component="span" sx={{ fontWeight: 600, color: "var(--success)" }}>
                  {resultadoAcciones?.traspasos_solicitados || 0}
                </Box>{" "}
                traspasos
              </Typography>
              <Typography sx={{ color: "var(--fg-muted)" }}>
                <Box component="span" sx={{ fontWeight: 600, color: "var(--warning)" }}>
                  {resultadoAcciones?.consultas_pendientes || 0}
                </Box>{" "}
                consultas
              </Typography>
              <Typography sx={{ color: "var(--fg-muted)" }}>
                <Box component="span" sx={{ fontWeight: 600, color: "var(--info)" }}>
                  {resultadoAcciones?.solped_pendientes || 0}
                </Box>{" "}
                SOLPED
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {/* Confirmación de resumen enviado al solicitante */}
        {resultadoAcciones?.resumen_enviado_solicitante && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: "var(--primary-muted)",
              border: "1px solid var(--primary)",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <HowToRegIcon sx={{ fontSize: 20, color: "var(--primary)" }} />
              <Box>
                <Typography sx={{ fontWeight: 500, color: "var(--fg-strong)" }}>
                  Resumen enviado al solicitante
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                  El solicitante recibira una notificacion con el detalle del tratamiento para su revision y aceptacion.
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* Seccion Stock/Traspasos */}
        {accionesStock.length > 0 && (
          <Stack spacing={1.5}>
            <SectionHeader
              icon={Inventory2Icon}
              title={t('planner_notificaciones_enviadas', 'NOTIFICACIONES ENVIADAS')}
              subtitle="Traspasos y consultas de stock"
              variant="success"
            />
            <AccionesTable acciones={accionesStock} onEstadoClick={handleEstadoClick} />
          </Stack>
        )}

        {/* Seccion Compras/SOLPED */}
        {accionesCompra.length > 0 && (
          <Stack spacing={1.5}>
            <SectionHeader
              icon={ShoppingCartIcon}
              title={t('planner_pendientes_sap', 'PENDIENTES SAP')}
              subtitle="Materiales que requieren SOLPED"
              variant="info"
            />
            <AccionesTable acciones={accionesCompra} tipo="compra" onEstadoClick={handleEstadoClick} />
          </Stack>
        )}

        {accionesStock.length === 0 && accionesCompra.length === 0 && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography sx={{ color: "var(--fg-muted)" }}>
              {t('planner_sin_acciones_pendientes', 'No hay acciones pendientes para esta solicitud.')}
            </Typography>
          </Box>
        )}

        {/* Modal de detalle de mensaje */}
        <MensajeAccionModal
          accion={selectedAccion}
          isOpen={showMensajeModal}
          onClose={handleCloseMensajeModal}
        />
      </Stack>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <CircularProgress sx={{ color: "var(--primary)" }} />
      </Box>
    );
  }

  // Mostrar preview de acciones pendientes
  return (
    <Stack spacing={3}>
      {/* Header con resumen */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: "var(--bg-soft)",
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AccessTimeIcon sx={{ fontSize: 20, color: "var(--primary)" }} />
            <Typography sx={{ fontWeight: 500, color: "var(--fg-strong)" }}>
              {t('planner_acciones_pendientes', 'Acciones Pendientes de Ejecutar')}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ fontSize: 14 }}>
            <Typography sx={{ color: "var(--fg-muted)" }}>
              <Box component="span" sx={{ fontWeight: 600, color: "var(--success)" }}>
                {previewAcciones.traspasos.length}
              </Box>{" "}
              traspasos
            </Typography>
            <Typography sx={{ color: "var(--fg-muted)" }}>
              <Box component="span" sx={{ fontWeight: 600, color: "var(--warning)" }}>
                {previewAcciones.consultas.length}
              </Box>{" "}
              consultas
            </Typography>
            <Typography sx={{ color: "var(--fg-muted)" }}>
              <Box component="span" sx={{ fontWeight: 600, color: "var(--info)" }}>
                {previewAcciones.solpeds.length}
              </Box>{" "}
              SOLPED
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Traspasos de almacen (mismo centro) */}
      {previewAcciones.traspasos.length > 0 && (
        <Stack spacing={1.5}>
          <SectionHeader
            icon={Inventory2Icon}
            title={t('planner_traspasos_almacen', 'TRASPASOS DE ALMACÉN')}
            subtitle="Se notificara al almacen para realizar el traspaso"
            variant="success"
          />
          <PreviewTable acciones={previewAcciones.traspasos} tipo="traspaso" />
        </Stack>
      )}

      {/* Consultas a referentes (otro centro) */}
      {previewAcciones.consultas.length > 0 && (
        <Stack spacing={1.5}>
          <SectionHeader
            icon={EmailIcon}
            title={t('planner_consultas_referentes', 'CONSULTAS A REFERENTES')}
            subtitle="Se enviara consulta de disponibilidad a otros centros"
            variant="warning"
          />
          <PreviewTable acciones={previewAcciones.consultas} tipo="consulta" />
        </Stack>
      )}

      {/* SOLPED a proveedores */}
      {previewAcciones.solpeds.length > 0 && (
        <Stack spacing={1.5}>
          <SectionHeader
            icon={DescriptionIcon}
            title={t('planner_generar_solped', 'SOLPED A GENERAR')}
            subtitle="Pendiente generacion de pedido en SAP"
            variant="info"
          />
          <PreviewTable acciones={previewAcciones.solpeds} tipo="solped" />
        </Stack>
      )}

      {/* Estado vacio */}
      {totalAccionesPendientes === 0 && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography sx={{ color: "var(--fg-muted)" }}>
            {t('planner_sin_acciones_pendientes', 'No hay acciones pendientes para esta solicitud.')}
          </Typography>
        </Box>
      )}

      {/* Opcion de enviar resumen al solicitante */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: enviarResumenSolicitante ? "var(--primary-muted)" : "var(--card)",
          border: "1px solid",
          borderColor: enviarResumenSolicitante ? "var(--primary)" : "var(--border)",
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={enviarResumenSolicitante}
              onChange={(e) => setEnviarResumenSolicitante(e.target.checked)}
              sx={{
                color: "var(--border)",
                "&.Mui-checked": {
                  color: "var(--primary)",
                },
              }}
            />
          }
          label={
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <HowToRegIcon sx={{ fontSize: 16, color: "var(--primary)" }} />
                <Typography sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                  {t('planner_enviar_resumen', 'Enviar resumen al solicitante para aceptación')}
                </Typography>
                <Chip
                  label={t('common_opcional', 'Opcional')}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    bgcolor: "var(--neutral-bg)",
                    color: "var(--fg-muted)",
                  }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: "var(--fg-muted)", mt: 0.5 }}>
                El solicitante recibira un mensaje con el detalle del tratamiento propuesto
                y podra aceptarlo o solicitar modificaciones antes de que se ejecuten las acciones.
              </Typography>
              {enviarResumenSolicitante && (
                <Paper
                  elevation={0}
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: "var(--primary-muted)",
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500, color: "var(--fg-strong)" }}>
                    Se enviara notificacion a: {solicitud?.solicitante_nombre || solicitud?.nombre || "Solicitante"} {solicitud?.solicitante_apellido || solicitud?.apellido || ""}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "var(--fg-muted)", mt: 0.5 }}>
                    Las acciones quedaran en estado "Pendiente de aceptacion" hasta que el solicitante confirme.
                  </Typography>
                </Paper>
              )}
            </Box>
          }
          sx={{
            alignItems: "flex-start",
            m: 0,
            "& .MuiFormControlLabel-label": {
              flex: 1,
            },
          }}
        />
      </Paper>

      {/* Boton de ejecutar */}
      {(totalAccionesPendientes > 0 || enviarResumenSolicitante) && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
          <MuiButton
            onClick={handleEjecutar}
            disabled={ejecutando}
            variant="contained"
            size="large"
            startIcon={
              ejecutando ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon />
              )
            }
            endIcon={!ejecutando && <ArrowForwardIcon />}
            sx={{
              bgcolor: "var(--primary)",
              "&:hover": { bgcolor: "var(--primary-dark)" },
              textTransform: "none",
              px: 3,
            }}
          >
            {ejecutando
              ? enviarResumenSolicitante
                ? "Enviando resumen..."
                : "Ejecutando acciones..."
              : enviarResumenSolicitante
              ? `Enviar resumen${totalAccionesPendientes > 0 ? ` y ejecutar ${totalAccionesPendientes} acciones` : ""}`
              : `Ejecutar ${totalAccionesPendientes} acciones`}
          </MuiButton>
        </Box>
      )}
    </Stack>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, variant }) {
  const variantStyles = {
    success: {
      bg: "var(--success-bg)",
      text: "var(--success)",
    },
    info: {
      bg: "var(--info-bg)",
      text: "var(--info)",
    },
    warning: {
      bg: "var(--warning-bg)",
      text: "var(--warning)",
    },
  };

  const style = variantStyles[variant] || variantStyles.info;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          p: 1,
          bgcolor: style.bg,
          color: style.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Box>
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--fg-strong)",
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function PreviewTable({ acciones, tipo }) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 3,
        bgcolor: "var(--card)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "var(--bg-soft)" }}>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Codigo SAP
            </TableCell>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Descripcion
            </TableCell>
            <TableCell
              sx={{
                textAlign: "right",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Cantidad
            </TableCell>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {tipo === "solped" ? "Proveedor" : "Destinatario"}
            </TableCell>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Accion
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {acciones.map((accion, i) => {
            const config = TIPO_ACCION_CONFIG[accion.tipo] || {};
            const AccionIcon = config.icon || AccessTimeIcon;

            return (
              <TableRow
                key={i}
                sx={{
                  "&:last-child td": { borderBottom: 0 },
                }}
              >
                <TableCell
                  sx={{
                    fontFamily: "monospace",
                    color: "var(--fg-strong)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.codigo}
                </TableCell>
                <TableCell
                  sx={{
                    color: "var(--fg-strong)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.descripcion}
                </TableCell>
                <TableCell
                  sx={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: "var(--fg-strong)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.cantidad}
                </TableCell>
                <TableCell
                  sx={{
                    color: "var(--fg-muted)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.destinatario}
                  {accion.plazo && (
                    <Typography
                      component="span"
                      sx={{ display: "block", fontSize: "0.75rem", opacity: 0.7 }}
                    >
                      Plazo: {accion.plazo} dias
                    </Typography>
                  )}
                </TableCell>
                <TableCell
                  sx={{
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AccionIcon sx={{ fontSize: 16, color: config.color }} />
                    <Typography sx={{ color: "var(--fg-muted)" }}>{accion.accion}</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function AccionesTable({ acciones, tipo = "stock", onEstadoClick }) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 3,
        bgcolor: "var(--card)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "var(--bg-soft)" }}>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Codigo SAP
            </TableCell>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Descripcion
            </TableCell>
            <TableCell
              sx={{
                textAlign: "right",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Cantidad
            </TableCell>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {tipo === "compra" ? "Proveedor" : "Destinatario"}
            </TableCell>
            <TableCell
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--fg-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Estado
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {acciones.map((accion, i) => {
            const estadoConfig = ESTADO_CONFIG[accion.estado] || ESTADO_CONFIG.pendiente;
            const EstadoIcon = estadoConfig.icon;
            const tieneAccionEnviada =
              accion.estado === "transferencia_solicitada" ||
              accion.estado === "esperando_confirmacion" ||
              accion.mensaje_enviado;

            return (
              <TableRow
                key={i}
                sx={{
                  "&:last-child td": { borderBottom: 0 },
                }}
              >
                <TableCell
                  sx={{
                    fontFamily: "monospace",
                    color: "var(--fg-strong)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.codigo_material}
                </TableCell>
                <TableCell
                  sx={{
                    color: "var(--fg-strong)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.descripcion}
                </TableCell>
                <TableCell
                  sx={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: "var(--fg-strong)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.cantidad}
                </TableCell>
                <TableCell
                  sx={{
                    color: "var(--fg-muted)",
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  {accion.destinatario || "N/D"}
                </TableCell>
                <TableCell
                  sx={{
                    borderBottom: i < acciones.length - 1 ? "1px solid var(--border)" : 0,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Chip
                      icon={<EstadoIcon sx={{ fontSize: 14 }} />}
                      label={estadoConfig.label}
                      size="small"
                      onClick={tieneAccionEnviada ? () => onEstadoClick?.(accion) : undefined}
                      sx={{
                        bgcolor: estadoConfig.bg,
                        color: estadoConfig.color,
                        fontWeight: 500,
                        fontSize: "0.75rem",
                        cursor: tieneAccionEnviada ? "pointer" : "default",
                        "&:hover": tieneAccionEnviada
                          ? { opacity: 0.8 }
                          : {},
                        "& .MuiChip-icon": {
                          color: estadoConfig.color,
                        },
                      }}
                    />
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MensajeAccionModal({ accion, isOpen, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (!accion) return null;

  const estadoConfig = ESTADO_CONFIG[accion.estado] || ESTADO_CONFIG.pendiente;
  const EstadoIcon = estadoConfig.icon;

  const handleIrACentroInteraccion = () => {
    onClose();
    navigate("/centro-interaccion");
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              p: 1,
              bgcolor: estadoConfig.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EstadoIcon sx={{ fontSize: 20, color: estadoConfig.color }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
              {t('planner_detalle_accion', 'Detalle de Acción')}
            </Typography>
            <Chip
              label={estadoConfig.label}
              size="small"
              sx={{
                mt: 0.5,
                bgcolor: estadoConfig.bg,
                color: estadoConfig.color,
                fontWeight: 600,
                fontSize: "0.7rem",
              }}
            />
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Info del material */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: "var(--bg-soft)" }}>
            <Typography
              variant="caption"
              sx={{
                color: "var(--fg-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {t('common_material', 'Material')}
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontWeight: 600, color: "var(--fg-strong)", fontFamily: "monospace" }}
            >
              {accion.codigo_material}
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--fg-muted)", mt: 0.5 }}>
              {accion.descripcion}
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--fg-strong)", mt: 1, fontWeight: 600 }}>
              Cantidad: {accion.cantidad}
            </Typography>
          </Paper>

          {/* Destinatario */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "var(--fg-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {t('common_destinatario', 'Destinatario')}
            </Typography>
            <Typography variant="body1" sx={{ color: "var(--fg-strong)" }}>
              {accion.destinatario || "No especificado"}
            </Typography>
          </Box>

          {/* Mensaje enviado */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "var(--fg-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                display: "block",
                mb: 1,
              }}
            >
              Mensaje Enviado
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: "1px solid var(--border)",
                bgcolor: "var(--card)",
              }}
            >
              <Typography variant="body2" sx={{ color: "var(--fg-strong)", whiteSpace: "pre-wrap" }}>
                {accion.mensaje_enviado ||
                  accion.mensaje ||
                  (accion.estado === "transferencia_solicitada"
                    ? `Se ha solicitado el traspaso del material ${accion.codigo_material} (${accion.cantidad} unidades) desde ${accion.centro_origen || "almacen origen"} hacia el centro solicitante.`
                    : accion.estado === "esperando_confirmacion"
                    ? `Se ha enviado una consulta de disponibilidad del material ${accion.codigo_material} (${accion.cantidad} unidades) al referente del centro ${accion.centro_origen || "destino"}.`
                    : "Notificacion enviada correctamente.")}
              </Typography>
              {accion.fecha_envio && (
                <Typography
                  variant="caption"
                  sx={{ color: "var(--fg-muted)", display: "block", mt: 1.5 }}
                >
                  Enviado: {new Date(accion.fecha_envio).toLocaleString("es-AR")}
                </Typography>
              )}
            </Paper>
          </Box>

          {/* Referencia al mensaje */}
          {accion.mensaje_id && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "var(--fg-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                ID del Mensaje
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "var(--primary)", fontFamily: "monospace" }}
              >
                #{accion.mensaje_id}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <MuiButton onClick={onClose} sx={{ color: "var(--fg-muted)" }}>
          {t('common_cerrar', 'Cerrar')}
        </MuiButton>
        <MuiButton
          variant="contained"
          onClick={handleIrACentroInteraccion}
          startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
          sx={{
            bgcolor: "var(--primary)",
            "&:hover": { bgcolor: "var(--primary-dark)" },
          }}
        >
          Ir al Centro de Interaccion
        </MuiButton>
      </DialogActions>
    </Dialog>
  );
}
