import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { solicitudes } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { formatDate, formatCurrency, getSectorNombre, formatAlmacen } from "../utils/formatters";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DescriptionIcon from "@mui/icons-material/Description";
import InventoryIcon from "@mui/icons-material/Inventory";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import TagIcon from "@mui/icons-material/Tag";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";

import StatusBadge from "../components/ui/StatusBadge";

/**
 * Tabla de items migrada a SPMAgGrid
 */
function ItemsTable({ items, totalMonto }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.map((item, idx) => {
      const precio = Number(item.precio_unitario || item.precio || 0);
      const cantidad = Number(item.cantidad || 0);
      const subtotal = precio * cantidad;
      return {
        ...item,
        id: idx,
        precio_unitario: precio,
        cantidad: cantidad,
        subtotal: subtotal,
      };
    });
  }, [items]);

  const columnDefs = useMemo(() => [
    {
      field: 'codigo',
      headerName: t('detalle_item_codigo', 'Código'),
      flex: 0.3,
      minWidth: 100,
      valueFormatter: (params) => params.data?.codigo || params.data?.material_codigo || '-',
    },
    {
      field: 'descripcion',
      headerName: t('detalle_item_descripcion', 'Descripción'),
      flex: 0.8,
      minWidth: 200,
      cellRenderer: (params) => (
        <Box sx={{ maxWidth: 280 }}>
          <Typography
            variant="body2"
            noWrap
            title={params.data?.descripcion || params.data?.material_descripcion}
          >
            {params.data?.descripcion || params.data?.material_descripcion || '-'}
          </Typography>
          {params.data?.comentario && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              component="p"
              title={params.data?.comentario}
            >
              {params.data?.comentario}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'cantidad',
      headerName: t('detalle_item_cantidad', 'Cantidad'),
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => `${params.data?.cantidad || 0} ${params.data?.unidad || ''}`,
    },
    {
      field: 'precio_unitario',
      headerName: t('detalle_item_precio', 'Precio Unit.'),
      flex: 0.3,
      minWidth: 100,
      type: 'numericColumn',
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) => formatCurrency(params.data?.precio_unitario || 0),
    },
    {
      field: 'subtotal',
      headerName: t('detalle_item_subtotal', 'Subtotal'),
      flex: 0.3,
      minWidth: 100,
      type: 'numericColumn',
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) => formatCurrency(params.data?.subtotal || 0),
    },
  ], [t]);

  return (
    <Stack spacing={1.5}>
      <SPMAgGrid
        rowData={rows}
        columnDefs={columnDefs}
        height={300}
        pagination={false}
        enableQuickFilter={true}
        exportFileName="items_solicitud"
        emptyMessage={t('detalle_sin_items', 'No hay materiales en esta solicitud')}
      />
      {/* Total Footer */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          p: 2,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={2} sx={{ width: '100%', maxWidth: 400 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, flex: 1, textAlign: 'right' }}
          >
            {t('detalle_total', 'Total')}:
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'primary.main',
              minWidth: 120,
              textAlign: 'right',
            }}
          >
            {formatCurrency(totalMonto || 0)}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

// DetailRow component using MUI
function DetailRow({ icon: Icon, label, value }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
      <Box
        sx={{
          height: 36,
          width: 36,
          bgcolor: "action.hover",
          border: "1px solid",
          borderColor: "divider",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 18, color: "text.secondary" }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{
            color: "text.secondary",
            lineHeight: 1.5
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.primary", mt: 0.5, wordBreak: "break-word" }}
        >
          {value || "-"}
        </Typography>
      </Box>
    </Box>
  );
}

// Loading skeleton using MUI
function LoadingSkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" width="33%" height={32} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
        <Skeleton variant="rounded" height={192} />
        <Skeleton variant="rounded" height={192} />
      </Box>
      <Skeleton variant="rounded" height={256} />
    </Stack>
  );
}

export default function SolicitudDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialog, setRejectDialog] = useState({ open: false, motivo: "" });

  const fetchSolicitud = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await solicitudes.obtener(id);
      if (res.data?.solicitud) {
        setSolicitud(res.data.solicitud);
      } else if (res.data) {
        setSolicitud(res.data);
      } else {
        setError("No se encontro la solicitud");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || "Error al cargar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchSolicitud();
  }, [id]);

  // Check if user can approve/reject
  const canApprove = useMemo(() => {
    if (!user || !solicitud) return false;
    const estado = (solicitud.estado || solicitud.status || "").toLowerCase();
    if (estado !== "submitted" && estado !== "enviada" && estado !== "pendiente_aprobacion") return false;
    const rolStr = String(user.rol || "").toLowerCase();
    const roles = user.roles || rolStr.split(",").map(r => r.trim());
    const approverRoles = ["admin", "administrador", "aprobador", "aprobador_solicitudes", "aprobador solicitudes", "aprobador de solicitudes", "coordinador", "jefe"];
    return roles.some(r => approverRoles.includes(r.toLowerCase()));
  }, [user, solicitud]);

  const handleAprobar = async () => {
    setActionLoading(true);
    setError("");
    try {
      await solicitudes.aprobar(id);
      setSuccess("Solicitud aprobada correctamente");
      await fetchSolicitud();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al aprobar la solicitud");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRechazar = async () => {
    const motivo = rejectDialog.motivo.trim();
    if (motivo.length < 5) {
      setError("El motivo debe tener al menos 5 caracteres");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      await solicitudes.rechazar(id, motivo);
      setSuccess("Solicitud rechazada");
      setRejectDialog({ open: false, motivo: "" });
      await fetchSolicitud();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error al rechazar la solicitud");
    } finally {
      setActionLoading(false);
    }
  };

  // Header component
  const PageHeader = ({ title, extra }) => (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            color: "text.disabled",
            "&:hover": { color: "text.secondary", bgcolor: "background.paper", border: 1, borderColor: "divider" },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          component="h1"
          sx={{ fontWeight: 700, color: "text.primary", textTransform: "uppercase", letterSpacing: "0.5px" }}
        >
          {title}
        </Typography>
      </Box>
      {extra}
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          <PageHeader title={t("detalle_loading", "Cargando solicitud...")} />
          <LoadingSkeleton />
        </Box>
      </Box>
    );
  }

  if (error && !solicitud) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          <PageHeader title={t("detalle_error_title", "Error")} />
          <Alert severity="error">{error}</Alert>
        </Box>
      </Box>
    );
  }

  if (!solicitud) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
          <PageHeader title={t("detalle_not_found", "Solicitud no encontrada")} />
          <Alert severity="warning">
            {t("detalle_not_found_msg", "La solicitud solicitada no existe o fue eliminada.")}
          </Alert>
        </Box>
      </Box>
    );
  }

  const items = solicitud.items || [];
  const estado = solicitud.estado || solicitud.status || "pendiente";
  const criticidad = solicitud.criticidad || "Normal";
  const isAltaCriticidad = criticidad.toLowerCase().includes("alta");

  const aprobadorNombre = [solicitud.aprobador_nombre, solicitud.aprobador_apellido]
    .filter(Boolean)
    .join(" ") || null;

  const tooltipInfo = {
    aprobador: aprobadorNombre,
    fechaEnvio: solicitud.created_at,
    fechaAprobacion: solicitud.fecha_aprobacion,
    planificador: [solicitud.planner_nombre, solicitud.planner_apellido]
      .filter(Boolean)
      .join(" ") || null,
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <PageHeader
        title={`${t("detalle_title", "Solicitud")} #${solicitud.id}`}
        extra={<StatusBadge estado={estado} tooltipInfo={tooltipInfo} />}
      />

      {/* Alerts */}
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      {/* Acciones de aprobacion */}
      {canApprove && (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "warning.50", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "warning.dark" }}>
              Esta solicitud requiere tu aprobacion
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={handleAprobar}
                disabled={actionLoading}
                sx={{ textTransform: "none" }}
              >
                {actionLoading ? "Procesando..." : "Aprobar"}
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<CancelIcon />}
                onClick={() => setRejectDialog({ open: true, motivo: "" })}
                disabled={actionLoading}
                sx={{ textTransform: "none" }}
              >
                Rechazar
              </Button>
            </Stack>
          </Box>
        </Paper>
      )}

      {/* Info Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        {/* Informacion General */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t("detalle_info_general", "Informacion General")}
            </Typography>
          </Box>
          <Stack spacing={2.5} sx={{ p: 2.5 }}>
            <DetailRow icon={TagIcon} label={t("detalle_id", "ID de Solicitud")} value={solicitud.id} />
            <DetailRow icon={PersonIcon} label={t("detalle_solicitante", "Solicitante")} value={solicitud.id_usuario || solicitud.solicitante} />
            <DetailRow icon={CalendarTodayIcon} label={t("detalle_fecha_creacion", "Fecha de Creacion")} value={formatDate(solicitud.created_at || solicitud.fecha_creacion)} />
            <DetailRow icon={AccessTimeIcon} label={t("detalle_fecha_necesidad", "Fecha de Necesidad")} value={formatDate(solicitud.fecha_necesidad)} />
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <Box sx={{ height: 36, width: 36, bgcolor: "action.hover", border: "1px solid", borderColor: "divider", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <WarningAmberIcon sx={{ fontSize: 18, color: isAltaCriticidad ? "error.main" : "text.secondary" }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                  {t("detalle_criticidad", "Criticidad")}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip label={criticidad} size="small" color={isAltaCriticidad ? "error" : "default"} sx={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.7rem" }} />
                </Box>
              </Box>
            </Box>
          </Stack>
        </Paper>

        {/* Ubicacion y Costos */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t("detalle_ubicacion", "Ubicacion y Costos")}
            </Typography>
          </Box>
          <Stack spacing={2.5} sx={{ p: 2.5 }}>
            <DetailRow icon={BusinessIcon} label={t("detalle_centro", "Centro")} value={solicitud.centro || solicitud.centro_id} />
            <DetailRow icon={LocationOnIcon} label={t("detalle_sector", "Sector")} value={getSectorNombre(solicitud.sector || solicitud.sector_id)} />
            <DetailRow icon={InventoryIcon} label={t("detalle_almacen", "Almacen Virtual")} value={formatAlmacen(solicitud.almacen_virtual || solicitud.almacen)} />
            <DetailRow icon={AttachMoneyIcon} label={t("detalle_centro_costos", "Centro de Costos")} value={solicitud.centro_costos} />
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <Box sx={{ height: 36, width: 36, bgcolor: "primary.50", border: "1px solid", borderColor: "primary.200", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <AttachMoneyIcon sx={{ fontSize: 18, color: "primary.main" }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                  {t("detalle_monto_total", "Monto Total")}
                </Typography>
                <Typography variant="h6" sx={{ color: "primary.main", fontWeight: 700, mt: 0.5 }}>
                  {formatCurrency(solicitud.total_monto || 0)}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* Justificacion */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("detalle_justificacion", "Justificacion")}
          </Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ height: 36, width: 36, bgcolor: "action.hover", border: "1px solid", borderColor: "divider", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <DescriptionIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            </Box>
            <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.7, flex: 1 }}>
              {solicitud.justificacion || t("detalle_sin_justificacion", "Sin justificacion proporcionada")}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Items/Materiales */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("detalle_materiales", "Materiales")} ({items.length})
          </Typography>
        </Box>
        <Box sx={{ p: items.length === 0 ? 2.5 : 0 }}>
          {items.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <InventoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary">
                {t("detalle_sin_items", "No hay materiales en esta solicitud")}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2.5 }}>
              <ItemsTable items={items} totalMonto={solicitud.total_monto} />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Acciones segun estado */}
      {estado.toLowerCase() === "borrador" && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button variant="outlined" size="small" onClick={() => navigate(`/solicitudes/${solicitud.id}/materiales`)} sx={{ textTransform: "none" }}>
            {t("detalle_btn_editar", "Editar Solicitud")}
          </Button>
        </Box>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, motivo: "" })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          Rechazar Solicitud #{id}
          <IconButton size="small" onClick={() => setRejectDialog({ open: false, motivo: "" })}><CloseIcon /></IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta accion no se puede deshacer. El solicitante sera notificado.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Motivo del rechazo"
            value={rejectDialog.motivo}
            onChange={(e) => setRejectDialog(prev => ({ ...prev, motivo: e.target.value }))}
            placeholder="Explica el motivo del rechazo (min. 5 caracteres)..."
            error={rejectDialog.motivo.length > 0 && rejectDialog.motivo.length < 5}
            helperText={rejectDialog.motivo.length > 0 && rejectDialog.motivo.length < 5 ? "Minimo 5 caracteres" : ""}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialog({ open: false, motivo: "" })} sx={{ textTransform: "none" }}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={handleRechazar}
            disabled={actionLoading || rejectDialog.motivo.trim().length < 5}
            sx={{ textTransform: "none" }}
          >
            {actionLoading ? "Procesando..." : "Confirmar Rechazo"}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
