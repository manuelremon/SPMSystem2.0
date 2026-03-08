/**
 * MisSolicitudes - Lista de solicitudes del usuario
 * Material UI Implementation
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useDebouncedValue as useDebounced } from "../hooks/useDebouncedValue";
import { useI18n } from "../context/i18n";
import { formatDate, formatCurrency, getSectorNombre, formatAlmacen } from "../utils/formatters";
import { getCriticidadConfig } from "../utils/styleConfig";
import StatusBadge from "../components/ui/StatusBadge";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Stack,
  Divider,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import BusinessIcon from "@mui/icons-material/Business";
import PlaceIcon from "@mui/icons-material/Place";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import TagIcon from "@mui/icons-material/Tag";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";

const DEBOUNCE_MS = 300;

/* -------------------------------------------------------------
   Delete Modal
------------------------------------------------------------- */
function DeleteModal({ open, onClose, onConfirm, deleting, t }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {}
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: "50%",
            bgcolor: "error.lighter",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DeleteIcon sx={{ fontSize: 20, color: "error.main" }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          {t("mis_delete_title", "Eliminar solicitud")}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t("mis_delete_desc", "Esta seguro de eliminar esta solicitud? Esta accion no se puede deshacer.")}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50" }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{ textTransform: "none" }}
        >
          {t("common_cancel", "Cancelar")}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={deleting}
          variant="contained"
          color="error"
          size="small"
          sx={{ textTransform: "none" }}
        >
          {deleting ? "Eliminando..." : t("mis_delete_confirm", "Eliminar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* -------------------------------------------------------------
   Detail Modal
------------------------------------------------------------- */
function DetalleModal({ open, solicitud, sectores, onClose, onViewFull, t }) {
  if (!solicitud) return null;

  const criticidadConfig = getCriticidadConfig(solicitud.criticidad || "Normal");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: "90vh" }
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          Solicitud #{solicitud.id}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: "text.secondary" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={3}>
          {/* Estado y Criticidad */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <StatusBadge
              estado={solicitud.estado || solicitud.status}
              tooltipInfo={{
                aprobador: [solicitud.aprobador_nombre, solicitud.aprobador_apellido].filter(Boolean).join(" ") || null,
                planificador: [solicitud.planner_nombre, solicitud.planner_apellido].filter(Boolean).join(" ") || null,
                fechaEnvio: solicitud.created_at,
              }}
            />
            {solicitud.criticidad && (
              <Chip
                label={criticidadConfig.label}
                size="small"
                sx={{
                  color: criticidadConfig.color,
                  bgcolor: criticidadConfig.bg,
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
            )}
          </Box>

          {/* Info y Ubicacion */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            {/* Informacion General */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: "block" }}
              >
                {t('sol_info_general', 'Información General')}
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TagIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>ID:</strong> {solicitud.id}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarTodayIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Creacion:</strong> {formatDate(solicitud.created_at)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Necesidad:</strong> {formatDate(solicitud.fecha_necesidad)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Ubicacion */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: "block" }}
              >
                {t('sol_ubicacion', 'Ubicación')}
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BusinessIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Centro:</strong> {solicitud.centro || "-"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PlaceIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Sector:</strong> {getSectorNombre(solicitud.sector, sectores)}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <WarehouseIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Almacen:</strong> {formatAlmacen(solicitud.almacen_virtual) || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>

          {/* Justificacion */}
          {solicitud.justificacion && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderColor: "info.light",
                bgcolor: "info.lighter",
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1, display: "block" }}
              >
                {t('common_justificacion', 'Justificación')}
              </Typography>
              <Typography variant="body2" color="text.primary">
                {solicitud.justificacion}
              </Typography>
            </Paper>
          )}

          {/* Items */}
          {solicitud.items && solicitud.items.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1.5, display: "block" }}
              >
                {t('sol_materiales', 'Materiales')} ({solicitud.items.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t('common_codigo', 'Código')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t('common_descripcion', 'Descripción')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t('sol_cant', 'Cant.')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t('common_precio', 'Precio')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t('sol_subtotal', 'Subtotal')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {solicitud.items.map((item, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                          {item.codigo || item.codigo_sap}
                        </TableCell>
                        <TableCell sx={{ color: "text.primary" }}>
                          {item.descripcion}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: "text.primary" }}>
                          {item.cantidad}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          {formatCurrency(item.precio_unitario || 0)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: "text.primary" }}>
                          {formatCurrency((item.cantidad || 0) * (item.precio_unitario || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell colSpan={4} align="right" sx={{ fontWeight: 700, color: "text.primary", borderTop: 1, borderColor: "divider" }}>
                        {t('common_total', 'Total')}:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main", borderTop: 1, borderColor: "divider" }}>
                        {formatCurrency(solicitud.total_monto || 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: "grey.50", borderTop: 1, borderColor: "divider" }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{ textTransform: "none" }}
        >
          {t('common_cerrar', 'Cerrar')}
        </Button>
        <Button
          onClick={onViewFull}
          variant="contained"
          size="small"
          sx={{ textTransform: "none" }}
        >
          {t('sol_ver_detalle', 'Ver detalle completo')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* -------------------------------------------------------------
   Main Component
------------------------------------------------------------- */
export default function MisSolicitudes() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);

  // Filtros
  const [activeTab, setActiveTab] = useState(0);

  // Modal de confirmacion para eliminar
  const [deleteModal, setDeleteModal] = useState({ open: false, solicitudId: null });
  const [deleting, setDeleting] = useState(false);

  // Modal de detalle de solicitud
  const [detalleModal, setDetalleModal] = useState({ open: false, solicitud: null });

  // Auto-clear success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Cargar sectores desde el backend
  useEffect(() => {
    const fetchSectores = async () => {
      try {
        const res = await api.get("/catalogos/sectores");
        const data = Array.isArray(res.data) ? res.data : [];
        setSectores(data);
      } catch (err) {
      }
    };
    fetchSectores();
  }, []);

  // Funcion para cargar solicitudes
  const fetchSolicitudes = useCallback(async (showLoading = true) => {
    if (!user?.id) return;
    if (showLoading) setLoading(true);
    try {
      const res = await solicitudes.listar({ user_id: user.id, page_size: 500 });
      const data = res.data.solicitudes || res.data.results || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  // Mapeo de tabs a estados (cubre valores en ingles y espanol legacy)
  const tabFilters = [
    { label: t('sol_tab_todas', 'Todas'), key: "todas", filter: () => true },
    { label: t('sol_tab_borradores', 'Borradores'), key: "borradores", filter: (e) => ["draft", "borrador"].includes(e) },
    { label: t('sol_tab_enviadas', 'Enviadas'), key: "enviadas", filter: (e) => ["submitted", "enviada", "pendiente", "pendiente_de_aprobacion"].includes(e) },
    { label: t('sol_tab_aprobadas', 'Aprobadas'), key: "aprobadas", filter: (e) => ["approved", "aprobada", "in_planning", "in_treatment", "treated", "en_planificacion", "en_tratamiento", "tratado"].includes(e) },
    { label: t('sol_tab_rechazadas', 'Rechazadas'), key: "rechazadas", filter: (e) => ["rejected", "rechazada", "cancelled", "cancelada"].includes(e) },
    { label: t('sol_tab_cerradas', 'Cerradas'), key: "cerradas", filter: (e) => ["closed", "completed", "cerrada", "completada", "finalizada"].includes(e) },
  ];

  // Calcular estadisticas
  const stats = useMemo(() => {
    return tabFilters.map((tab) => {
      if (tab.key === "todas") return items.length;
      return items.filter((s) => tab.filter((s.estado || s.status || "").toLowerCase())).length;
    });
  }, [items]);

  // Filtrado
  const filtered = useMemo(() => {
    let result = items;

    // Filtro por tab activo
    const currentTab = tabFilters[activeTab];
    if (currentTab && currentTab.key !== "todas") {
      result = result.filter((s) => {
        const estado = (s.estado || s.status || "").toLowerCase();
        return currentTab.filter(estado);
      });
    }

    // Filtro de busqueda
    const term = debouncedQ.trim().toLowerCase();
    if (term) {
      result = result.filter((s) => {
        return (
          String(s.id).includes(term) ||
          (s.justificacion || "").toLowerCase().includes(term) ||
          (s.centro || "").toLowerCase().includes(term) ||
          (s.sector || "").toLowerCase().includes(term)
        );
      });
    }

    // Ordenar por fecha descendente
    result.sort((a, b) => {
      const fechaA = new Date(a.fecha_creacion || a.created_at || 0).getTime();
      const fechaB = new Date(b.fecha_creacion || b.created_at || 0).getTime();
      return fechaB - fechaA;
    });

    return result;
  }, [items, debouncedQ, activeTab]);

  // Eliminar solicitud
  const handleEliminar = useCallback(async () => {
    const id = deleteModal.solicitudId;
    if (!id) return;

    setDeleting(true);
    try {
      await solicitudes.eliminar(id);
      setSuccess(t("mis_delete_success", "Solicitud eliminada correctamente"));
      setItems((prev) => prev.filter((s) => s.id !== id));
      setDeleteModal({ open: false, solicitudId: null });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setDeleting(false);
    }
  }, [deleteModal.solicitudId, t]);

  // Columnas del DataGrid - AG Grid format
  const columnDefs = useMemo(
    () => [
      {
        field: "id",
        headerName: t('common_id', 'ID'),
        flex: 0.4,
        minWidth: 60,
      },
      {
        field: "fecha_creacion",
        headerName: t('common_fecha', 'Fecha'),
        flex: 0.6,
        minWidth: 90,
        valueGetter: (params) => params.data.fecha_creacion || params.data.created_at,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "justificacion",
        headerName: t('common_justificacion', 'Justificación'),
        flex: 1.5,
        minWidth: 150,
        cellRenderer: (params) => {
          const texto = params.value || "-";
          const truncado = texto.length > 30;
          return (
            <Typography
              variant="body2"
              color="text.primary"
              noWrap
              title={truncado ? texto : undefined}
            >
              {truncado ? texto.slice(0, 30) + "..." : texto}
            </Typography>
          );
        },
      },
      {
        field: "centro",
        headerName: t('common_centro', 'Centro'),
        flex: 0.5,
        minWidth: 70,
        valueGetter: (params) => params.data.centro || params.data.centro_id || "-",
      },
      {
        field: "almacen_virtual",
        headerName: t('common_almacen', 'Almacén'),
        flex: 0.5,
        minWidth: 70,
        cellRenderer: (params) => formatAlmacen(params.value || params.data.almacen) || "-",
      },
      {
        field: "sector",
        headerName: t('common_sector', 'Sector'),
        flex: 0.8,
        minWidth: 100,
        valueGetter: (params) => getSectorNombre(params.data.sector || params.data.sector_id, sectores),
      },
      {
        field: "criticidad",
        headerName: t('common_criticidad', 'Criticidad'),
        flex: 0.5,
        minWidth: 80,
        cellRenderer: (params) => {
          const criticidad = params.value || "Normal";
          const config = getCriticidadConfig(criticidad);
          return (
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ color: config.color }}
            >
              {config.label}
            </Typography>
          );
        },
      },
      {
        field: "total_monto",
        headerName: t('common_monto', 'Monto'),
        flex: 0.7,
        minWidth: 100,
        cellStyle: { textAlign: 'right', paddingRight: '16px' },
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.primary" }}>
            {formatCurrency(params.value || 0)}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: t('common_estado', 'Estado'),
        flex: 0.7,
        minWidth: 100,
        valueGetter: (params) => params.data.estado || params.data.status || "pendiente",
        cellRenderer: (params) => {
          const data = params.data;
          const aprobador = [data.aprobador_nombre, data.aprobador_apellido].filter(Boolean).join(" ") || null;
          const planner = [data.planner_nombre, data.planner_apellido].filter(Boolean).join(" ") || null;
          return (
            <StatusBadge
              estado={params.value}
              showIcon={false}
              tooltipInfo={{
                aprobador,
                planificador: planner,
                fechaEnvio: data.created_at,
              }}
            />
          );
        },
      },
      {
        field: "planner_nombre",
        headerName: t('common_planificador', 'Planificador'),
        flex: 0.8,
        minWidth: 120,
        valueGetter: (params) => {
          const nombre = params.data.planner_nombre || "";
          const apellido = params.data.planner_apellido || "";
          return `${nombre} ${apellido}`.trim() || "-";
        },
      },
      {
        field: "acciones",
        headerName: t('common_acciones', 'Acciones'),
        flex: 1,
        minWidth: 180,
        sortable: false,
        filter: false,
        cellRenderer: (params) => {
          const estado = (params.data.estado || params.data.status || "").toLowerCase();
          const esBorrador = estado === "draft" || estado === "borrador";

          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {esBorrador ? (
                <>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => navigate(`/solicitudes/${params.data.id}/materiales`)}
                    sx={{
                      minWidth: "auto",
                      px: 1,
                      py: 0.25,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "warning.dark",
                      "&:hover": { bgcolor: "warning.lighter" },
                    }}
                  >
                    {t('common_editar', 'Editar')}
                  </Button>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setDeleteModal({ open: true, solicitudId: params.data.id })}
                    sx={{
                      minWidth: "auto",
                      px: 1,
                      py: 0.25,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "error.main",
                      "&:hover": { bgcolor: "error.lighter" },
                    }}
                  >
                    {t('common_borrar', 'Borrar')}
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setDetalleModal({ open: true, solicitud: params.data })}
                  sx={{
                    minWidth: "auto",
                    px: 1,
                    py: 0.25,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "primary.main",
                    "&:hover": { bgcolor: "primary.lighter" },
                  }}
                >
                  {t('common_ver', 'Ver')}
                </Button>
              )}
            </Stack>
          );
        },
      },
    ],
    [navigate, sectores, t]
  );

  // Rows para DataGrid
  const rows = useMemo(() => filtered.map((item) => ({ ...item, id: item.id })), [filtered]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: "text.disabled",
              "&:hover": {
                color: "text.secondary",
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t("mis_page_title", "Mis Solicitudes")}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate("/solicitudes/nueva")}
          sx={{ textTransform: "none" }}
        >
          {t("btn_crear_solicitud", "Crear Solicitud")}
        </Button>
      </Box>

      {/* Alertas */}
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Main Card */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 48,
              "& .MuiTab-root": {
                minHeight: 48,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
              },
            }}
          >
            {tabFilters.map((tab, idx) => (
              <Tab
                key={tab.key}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {tab.label}
                    <Chip
                      label={stats[idx]}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        bgcolor: activeTab === idx ? "primary.light" : "grey.200",
                        color: activeTab === idx ? "primary.dark" : "text.secondary",
                      }}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Box>

        {/* AG Grid */}
        <SPMAgGrid
          rowData={rows}
          columnDefs={columnDefs}
          loading={loading}
          height={600}
          paginationPageSize={25}
          paginationPageSizeSelector={[10, 25, 50, 100]}
          enableQuickFilter={true}
          onRowDoubleClick={(data) => setDetalleModal({ open: true, solicitud: data })}
          exportFileName="mis_solicitudes"
          emptyMessage={t("mis_empty_title", "No tienes solicitudes")}
        />
      </Paper>

      {/* Modal de confirmacion para eliminar */}
      <DeleteModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, solicitudId: null })}
        onConfirm={handleEliminar}
        deleting={deleting}
        t={t}
      />

      {/* Modal de detalle */}
      <DetalleModal
        open={detalleModal.open}
        solicitud={detalleModal.solicitud}
        sectores={sectores}
        onClose={() => setDetalleModal({ open: false, solicitud: null })}
        onViewFull={() => {
          setDetalleModal({ open: false, solicitud: null });
          navigate(`/solicitudes/${detalleModal.solicitud?.id}`);
        }}
        t={t}
      />
      </Box>
    </Box>
  );
}
