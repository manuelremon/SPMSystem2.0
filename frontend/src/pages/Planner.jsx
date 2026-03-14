/**
 * Planner Page - Material UI Migration
 * SAP/Enterprise UI with full MUI components
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanner, renderSolicitante } from "../hooks/usePlanner";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { formatDate, formatCurrency, getSectorNombre } from "../utils/formatters";
import { getCriticidadConfig } from "../utils/styleConfig";
import StatusBadge from "../components/ui/StatusBadge";
import TratarSolicitudModal from "../components/Planner/TratarSolicitudModal";
import SolicitudDetalleModal from "../components/Planner/SolicitudDetalleModal";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Slider from "@mui/material/Slider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";

/* ─────────────────────────────────────────────────────────────
   Helper: normalize estado string to canonical key
───────────────────────────────────────────────────────────── */
const ESTADO_MAP = {
  aprobada: "approved", aprobado: "approved", approved: "approved",
  "en progreso": "in_treatment", "en tratamiento": "in_treatment",
  in_treatment: "in_treatment", in_planning: "in_planning",
  completada: "completed", completed: "completed",
  finalizada: "completed", tratado: "treated", treated: "treated",
  cerrada: "closed", closed: "closed",
  despachada: "dispatched", dispatched: "dispatched",
  rechazada: "rejected", rejected: "rejected",
  cancelada: "cancelled", cancelled: "cancelled",
};

function normalizeEstado(val) {
  const key = (val || "").toLowerCase().trim();
  return ESTADO_MAP[key] || key;
}

/* ─────────────────────────────────────────────────────────────
   Multi-Select Dropdown Component (MUI)
───────────────────────────────────────────────────────────── */
function MultiSelect({ label, options, selected, onChange, keyField, labelField }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const { t } = useI18n();
  const open = Boolean(anchorEl);

  const getKey = (opt) => opt[keyField] || opt.value || opt.id || opt;
  const getLabel = (opt) => opt[labelField] || opt.label || opt.nombre || opt;

  const selectedKeys = selected.map((s) => getKey(s));
  const allSelected = selectedKeys.length === options.length && options.length > 0;
  const hasSelection = selectedKeys.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options);
    }
  };

  const toggleOption = (opt) => {
    const key = getKey(opt);
    if (selectedKeys.includes(key)) {
      onChange(selected.filter((s) => getKey(s) !== key));
    } else {
      onChange([...selected, opt]);
    }
  };

  const displayText =
    selectedKeys.length === 0
      ? t("common_todos", "Todos")
      : selectedKeys.length === 1
      ? getLabel(selected[0])
      : `${selectedKeys.length} ${t("common_seleccionados", "seleccionados")}`;

  return (
    <Box sx={{ minWidth: 140, flex: 1 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.secondary",
          mb: 0.5,
          fontSize: "var(--text-2xs)",
        }}
      >
        {label}
      </Typography>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        variant="outlined"
        size="small"
        endIcon={<KeyboardArrowDownIcon />}
        sx={{
          width: "100%",
          justifyContent: "space-between",
          textTransform: "none",
          fontWeight: hasSelection ? 600 : 400,
          fontSize: "0.8rem",
          py: 0.75,
          px: 1.5,
          color: hasSelection ? "primary.main" : "text.secondary",
          borderColor: hasSelection ? "primary.main" : "divider",
          bgcolor: hasSelection ? "primary.50" : "transparent",
          "&:hover": {
            borderColor: "primary.main",
            bgcolor: hasSelection ? "primary.100" : "action.hover",
          },
        }}
      >
        {displayText}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            maxHeight: 240,
            minWidth: anchorEl?.offsetWidth || 160,
            boxShadow: "var(--shadow-md)",
          },
        }}
      >
        <MenuItem onClick={toggleAll} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Checkbox
            checked={allSelected}
            indeterminate={hasSelection && !allSelected}
            size="small"
            sx={{ p: 0, mr: 1 }}
          />
          <ListItemText
            primary={t("common_seleccionar_todos", "Seleccionar todos")}
            primaryTypographyProps={{ fontSize: "0.8rem", fontWeight: 600 }}
          />
        </MenuItem>
        {options.map((opt) => {
          const key = getKey(opt);
          const isSelected = selectedKeys.includes(key);
          return (
            <MenuItem
              key={key}
              onClick={() => toggleOption(opt)}
              sx={{ fontSize: "0.8rem" }}
            >
              <Checkbox
                checked={isSelected}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              <ListItemText
                primary={getLabel(opt)}
                primaryTypographyProps={{ fontSize: "0.8rem", noWrap: true }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Reject Modal Component (MUI)
───────────────────────────────────────────────────────────── */
function RejectModal({ open, solicitud, motivo, onMotivoChange, onClose, onConfirm, t }) {
  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          pb: 2,
        }}
      >
        <Typography variant="h6" fontWeight={700} color="text.primary">
          {t("planner_rechazar_solicitud", "Rechazar Solicitud")} #{solicitud?.id}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }} aria-label={t("common_cerrar", "Cerrar")}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "text.secondary",
            mb: 0.75,
          }}
        >
          {t("planner_rechazar_motivo_label", "Motivo del rechazo")}{" "}
          <Box component="span" sx={{ color: "error.main" }}>
            *
          </Box>
        </Typography>
        <TextField
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          placeholder={t(
            "planner_rechazar_placeholder",
            "Explica brevemente el motivo del rechazo..."
          )}
          multiline
          rows={3}
          fullWidth
          size="small"
          aria-label={t("planner_rechazar_motivo_label", "Motivo del rechazo")}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "0.875rem",
            },
          }}
        />
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "grey.50",
        }}
      >
        <Button onClick={onClose} variant="outlined" color="inherit">
          {t("common_cancelar", "Cancelar")}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!motivo.trim()}
          variant="contained"
          color="error"
        >
          {t("planner_confirmar_rechazo", "Confirmar Rechazo")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function Planner({ filterMode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Modal de detalle
  const [detalleModal, setDetalleModal] = useState({ open: false, solicitud: null });

  // Estados para slider de fechas (0 = hace 1 año, 365 = hoy)
  const [rangoFechasLocal, setRangoFechasLocal] = useState([0, 365]);
  const rangoFechas = useDebouncedValue(rangoFechasLocal, 300);

  // Función para convertir valor del slider a fecha (formato DD/MM/AA)
  const sliderAFecha = (valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    const dd = String(fecha.getDate()).padStart(2, "0");
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const yy = String(fecha.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  // All state and logic extracted to usePlanner hook
  const {
    error,
    success,
    loading,
    q,
    filtroCentros,
    filtroAlmacenes,
    filtroSectores,
    filtroEstados,
    filtroCriticidades,
    activeTab,
    selectedParaTratar,
    rejectModal,
    filtered,
    tabCounts,
    catalogos,
    estadosOptions,
    criticidadOptions,
    hayFiltrosActivos,
    setQ,
    setFiltroCentros,
    setFiltroAlmacenes,
    setFiltroSectores,
    setFiltroEstados,
    setFiltroCriticidades,
    setActiveTab,
    handleTratar,
    handleTomar,
    rechazar,
    closeTratarModal,
    onTratarComplete,
    closeRejectModal,
    updateRejectMotivo,
    clearError,
    clearSuccess,
    limpiarFiltros,
  } = usePlanner({ t, filterMode });

  // AG Grid column definitions
  const columnDefs = useMemo(
    () => [
      {
        field: "id",
        headerName: "ID",
        width: 70,
        flex: 0,
        pinned: "left",
      },
      {
        field: "acciones",
        headerName: "Acción",
        width: 180,
        flex: 0,
        pinned: "left",
        sortable: false,
        filter: false,
        cellRenderer: (params) => {
          const row = params.data;
          const estado = normalizeEstado(row.status || row.estado || "");
          const currentUserId = String(user?.id_spm || user?.id || "");
          const plannerId = String(row.planner_id || "").trim();
          const isMine = !plannerId || plannerId === currentUserId;
          const isFinished = ["completed", "closed", "treated", "dispatched", "cancelled"].includes(estado);
          const canTomar = !isMine && !isFinished;
          const canTratar = isMine && !isFinished;

          return (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                aria-label={`${t("planner_ver", "Ver")} ${t("common_solicitud", "solicitud")} #${row.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDetalleModal({ open: true, solicitud: row });
                }}
                sx={{
                  minWidth: "auto",
                  px: 1,
                  py: 0.25,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                {t("planner_ver", "Ver")}
              </Button>
              {canTratar && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  aria-label={`${t("planner_tratar", "Tratar")} ${t("common_solicitud", "solicitud")} #${row.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTratar(row);
                  }}
                  sx={{
                    minWidth: "auto",
                    px: 1,
                    py: 0.25,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  {t("planner_tratar", "Tratar")}
                </Button>
              )}
              {canTomar && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  aria-label={`${t("planner_tomar", "Tomar")} ${t("common_solicitud", "solicitud")} #${row.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTomar(row);
                  }}
                  sx={{
                    minWidth: "auto",
                    px: 1,
                    py: 0.25,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  {t("planner_tomar", "Tomar")}
                </Button>
              )}
            </Stack>
          );
        },
      },
      {
        field: "estado",
        headerName: "Estado",
        flex: 0.7,
        minWidth: 110,
        valueGetter: (params) => params.data.status || params.data.estado || "pendiente",
        valueFormatter: (params) => {
          const map = {
            draft: "Borrador", submitted: "Enviada", pending: "Pendiente",
            processing: "En Proceso", in_planning: "En Progreso",
            in_treatment: "En tratamiento", treated: "Tratado",
            approved: "Aprobada", completed: "Completada", closed: "Cerrada",
            rejected: "Rechazada", dispatched: "Despachada", cancelled: "Cancelada",
          };
          return map[params.value] || params.value;
        },
        cellRenderer: (params) => {
          const data = params.data;
          const aprobador = [data.aprobador_nombre, data.aprobador_apellido].filter(Boolean).join(" ") || null;
          const planner = [data.planner_nombre, data.planner_apellido].filter(Boolean).join(" ") || null;
          return (
            <StatusBadge
              estado={params.value}
              showIcon={false}
              tooltipInfo={{ aprobador, planificador: planner, fechaEnvio: data.created_at }}
            />
          );
        },
      },
      {
        field: "created_at",
        headerName: "F. Creación",
        flex: 0.5,
        minWidth: 95,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "solicitante",
        headerName: "Solicitante",
        flex: 0.8,
        minWidth: 130,
        valueGetter: (params) => renderSolicitante(params.data),
      },
      {
        field: "justificacion",
        headerName: "Asunto",
        flex: 1.2,
        minWidth: 150,
        cellRenderer: (params) => {
          const texto = params.value || "-";
          return (
            <Typography
              variant="body2"
              noWrap
              title={texto}
              sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {texto}
            </Typography>
          );
        },
      },
      {
        field: "items_count",
        headerName: "Items",
        width: 70,
        flex: 0,
        valueGetter: (params) => (params.data.items || []).length,
        cellRenderer: (params) => (
          <Chip
            label={params.value}
            size="small"
            variant="outlined"
            sx={{
              minWidth: 28,
              height: 22,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          />
        ),
      },
      {
        field: "centro",
        headerName: "Centro",
        flex: 0.4,
        minWidth: 75,
      },
      {
        field: "almacen",
        headerName: "Almacén",
        flex: 0.4,
        minWidth: 75,
        valueGetter: (params) => params.data.almacen || params.data.almacen_codigo || "-",
      },
      {
        field: "sector",
        headerName: "Sector",
        flex: 0.5,
        minWidth: 90,
        valueGetter: (params) => getSectorNombre(params.data.sector),
      },
      {
        field: "criticidad",
        headerName: "Criticidad",
        flex: 0.5,
        minWidth: 85,
        cellRenderer: (params) => {
          const criticidad = params.value || "Normal";
          const config = getCriticidadConfig(criticidad);
          return (
            <Typography variant="body2" fontWeight={600} sx={{ color: config.color }}>
              {config.label}
            </Typography>
          );
        },
      },
      {
        field: "total_monto",
        headerName: "Monto",
        flex: 0.5,
        minWidth: 100,
        type: "numericColumn",
        cellStyle: { textAlign: 'right', paddingRight: '12px' },
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
            {formatCurrency(params.value || 0)}
          </Typography>
        ),
      },
      {
        field: "fecha_necesidad",
        headerName: "F. Necesidad",
        flex: 0.5,
        minWidth: 95,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "ai_priority",
        headerName: "IA",
        width: 65,
        flex: 0,
        cellRenderer: (params) => {
          const priority = params.value;
          const score = params.data?.ai_score;
          if (!priority) return null;
          const colors = { 'Critica': 'var(--danger-light)', 'Alta': 'var(--warning-light)', 'Media': 'var(--info)', 'Baja': 'var(--neutral)' };
          return (
            <Typography variant="body2" fontWeight={700} title={`Score: ${score ? (score * 100).toFixed(0) + '%' : '-'}`}
              sx={{ color: colors[priority] || 'var(--fg-muted)', fontSize: '0.75rem' }}>
              {priority}
            </Typography>
          );
        },
      },
    ],
    [handleTratar, handleTomar, user, t]
  );

  const rows = useMemo(() => filtered.map((item) => ({ ...item, id: item.id })), [filtered]);

  // Tab mapping
  const tabMapping = ["pendientes", "en_progreso", "finalizadas"];

  const getTitle = () => {
    if (filterMode === "asignadas") return t("nav_asignadas", "Solicitudes Asignadas a Mí");
    if (filterMode === "no-asignadas") return t("nav_no_asignadas", "Solicitudes Sin Asignar");
    return t("planner_title", "Planificador");
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ bgcolor: "grey.100", mx: { xs: -1.5, sm: -2, lg: -3 }, mt: { xs: -1.5, sm: -2, lg: -3 }, mb: { xs: -1.5, sm: -2, lg: -3 }, px: { xs: 1.5, sm: 2, lg: 3 }, pt: { xs: 1.5, sm: 2, lg: 3 }, minHeight: "calc(100vh - 43px)" }}>
      <Box sx={{ maxWidth: 1800, mx: "auto" }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <IconButton
            onClick={() => navigate(-1)}
            size="small"
            aria-label={t('common_volver', 'Volver')}
            sx={{
              color: "text.secondary",
              "&:hover": {
                bgcolor: "background.paper",
                color: "text.primary",
              },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="h6"
            component="h1"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing="0.05em"
            color="text.primary"
          >
            {getTitle()}
          </Typography>
        </Stack>

        {/* Alerts */}
        <Box aria-live="polite">
          {success && (
            <Alert
              severity="success"
              onClose={clearSuccess}
              sx={{ mb: 2 }}
            >
              {success}
            </Alert>
          )}
          {error && (
            <Alert
              severity="error"
              onClose={clearError}
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}
        </Box>

        {/* Filters */}
        <Paper
          elevation={0}
          role="search"
          aria-label={t("planner_filtros", "Filtros de solicitudes")}
          sx={{
            border: 1,
            borderColor: "divider",
            p: 2,
            mb: 2,
            borderRadius: "8px",
          }}
        >
          {/* Row 1: Search + Date Range + Clear */}
          <Stack direction="row" alignItems="flex-end" spacing={2} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 280 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 0.5,
                  fontSize: "var(--text-2xs)",
                }}
              >
                {t("planner_buscar", "Buscar")}
              </Typography>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("planner_buscar_placeholder", "ID, asunto, solicitante...")}
                size="small"
                fullWidth
                aria-label={t("planner_buscar", "Buscar solicitudes")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    fontSize: "0.8rem",
                  },
                  "& .MuiOutlinedInput-input": {
                    py: 0.75,
                  },
                }}
              />
            </Box>

            <Divider orientation="vertical" flexItem sx={{ height: 48, alignSelf: "center" }} />

            <Box sx={{ flex: 1, maxWidth: 320 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 0.5,
                  fontSize: "var(--text-2xs)",
                }}
              >
                {t("planner_rango_fechas", "Rango de fechas")}:{" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {sliderAFecha(rangoFechasLocal[0])}
                </Box>{" "}
                — {" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {sliderAFecha(rangoFechasLocal[1])}
                </Box>
              </Typography>
              <Slider
                value={rangoFechasLocal}
                onChange={(e, newValue) => setRangoFechasLocal(newValue)}
                min={0}
                max={365}
                size="small"
                getAriaLabel={() => t("planner_rango_fechas", "Rango de fechas")}
                getAriaValueText={(value) => sliderAFecha(value)}
                sx={{
                  mt: 0.5,
                  "& .MuiSlider-thumb": {
                    width: 14,
                    height: 14,
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between" sx={{ mt: -0.5 }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                  {t("planner_hace_1_anio", "Hace 1 año")}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                  {t("common_hoy", "Hoy")}
                </Typography>
              </Stack>
            </Box>

            <Box sx={{ flexShrink: 0 }}>
              {hayFiltrosActivos && (
                <Button
                  onClick={() => {
                    limpiarFiltros();
                    setRangoFechasLocal([0, 365]);
                  }}
                  variant="outlined"
                  color="inherit"
                  size="small"
                  startIcon={<FilterAltOffIcon />}
                  aria-label={t("planner_limpiar_filtros", "Limpiar todos los filtros")}
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.75rem",
                    py: 0.75,
                    textTransform: "none",
                    borderColor: "divider",
                  }}
                >
                  {t("planner_limpiar", "Limpiar")}
                </Button>
              )}
            </Box>
          </Stack>

          {/* Row 2: Multi-select filters */}
          <Divider sx={{ mb: 1.5 }} />
          <Stack direction="row" flexWrap="wrap" spacing={1.5} alignItems="flex-end" useFlexGap>
            <MultiSelect
              label={t("planner_filtro_centro", "Centro")}
              options={catalogos.centros || []}
              selected={filtroCentros}
              onChange={setFiltroCentros}
              keyField="id"
              labelField="nombre"
            />

            <MultiSelect
              label={t("planner_filtro_almacen", "Almacén")}
              options={catalogos.almacenes || []}
              selected={filtroAlmacenes}
              onChange={setFiltroAlmacenes}
              keyField="codigo"
              labelField="nombre"
            />

            <MultiSelect
              label={t("planner_filtro_sector", "Sector")}
              options={catalogos.sectores || []}
              selected={filtroSectores}
              onChange={setFiltroSectores}
              keyField="nombre"
              labelField="nombre"
            />

            <MultiSelect
              label={t("planner_filtro_estado", "Estado")}
              options={estadosOptions}
              selected={filtroEstados}
              onChange={setFiltroEstados}
              keyField="value"
              labelField="label"
            />

            <MultiSelect
              label={t("planner_filtro_criticidad", "Criticidad")}
              options={criticidadOptions}
              selected={filtroCriticidades}
              onChange={setFiltroCriticidades}
              keyField="value"
              labelField="label"
            />
          </Stack>
        </Paper>

        {/* Tabs + Grid Container */}
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
              minHeight: 42,
              "& .MuiTab-root": {
                fontWeight: 600,
                fontSize: "0.8rem",
                textTransform: "none",
                py: 1,
                px: 2.5,
                minHeight: 42,
              },
              "& .MuiTabs-indicator": {
                height: 3,
              },
            }}
          >
            {tabMapping.map((tab) => (
              <Tab
                key={tab}
                value={tab}
                label={
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <span>
                      {tab === "pendientes"
                        ? t("planner_tab_pendientes", "Pendientes")
                        : tab === "en_progreso"
                        ? t("planner_tab_en_progreso", "En Progreso")
                        : t("planner_tab_finalizadas", "Finalizadas")}
                    </span>
                    <Chip
                      label={tabCounts[tab] || 0}
                      size="small"
                      color={activeTab === tab ? "primary" : "default"}
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        "& .MuiChip-label": { px: 0.75 },
                      }}
                    />
                  </Stack>
                }
              />
            ))}
          </Tabs>
          <SPMAgGrid
            rowData={rows}
            columnDefs={columnDefs}
            loading={loading}
            height="calc(100vh - 340px)"
            pagination={true}
            paginationPageSize={25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            enableQuickFilter={true}
            onRowDoubleClick={(data) => setDetalleModal({ open: true, solicitud: data })}
            exportFileName="planner_solicitudes"
            emptyMessage={t("planner_empty_full", "Sin solicitudes asignadas")}
          />
        </Paper>  {/* End Tabs + Grid Container */}

        {/* Treatment Modal */}
        <TratarSolicitudModal
          solicitud={selectedParaTratar}
          isOpen={!!selectedParaTratar}
          onClose={closeTratarModal}
          onComplete={onTratarComplete}
        />

        {/* Reject Modal */}
        <RejectModal
          open={rejectModal.open}
          solicitud={rejectModal.solicitud}
          motivo={rejectModal.motivo}
          onMotivoChange={updateRejectMotivo}
          onClose={closeRejectModal}
          onConfirm={rechazar}
          t={t}
        />

        {/* Detalle Modal */}
        <SolicitudDetalleModal
          isOpen={detalleModal.open}
          onClose={() => setDetalleModal({ open: false, solicitud: null })}
          solicitud={detalleModal.solicitud}
        />
      </Box>
    </Box>
  );
}
