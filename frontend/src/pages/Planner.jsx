/**
 * Planner Page - Material UI Migration
 * SAP/Enterprise UI with full MUI components
 */

import { useState, useMemo } from "react";
import { usePlanner, renderSolicitante } from "../hooks/usePlanner";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { formatDate, formatCurrency, getSectorNombre } from "../utils/formatters";
import { getCriticidadConfig } from "../utils/styleConfig";
import StatusBadge from "../components/ui/StatusBadge";
import PageLayout from "../components/ui/PageLayout";
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
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";

// MUI Icons
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
    <Box sx={{ minWidth: { xs: "calc(50% - 8px)", sm: 140 }, flex: 1 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 600,
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
          {t("planner_rechazar_solicitud_btn", "Rechazar solicitud")} #{solicitud?.id}
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
          {t("planner_rechazar_guardar", "Confirmar rechazo")}
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
  const columnDefs = useMemo(() => {
    const compactBtnSx = {
      minWidth: "auto",
      px: 1,
      py: 0.25,
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "none",
      lineHeight: 1.2,
    };
    const iaLabels = {
      Critica: t("planner_ia_critica", "Crítica"),
      Alta: t("planner_ia_alta", "Alta"),
      Media: t("planner_ia_media", "Media"),
      Baja: t("planner_ia_baja", "Baja"),
    };
    return [
      {
        field: "id",
        headerName: t("common_id", "ID"),
        width: 75,
        flex: 0,
        pinned: "left",
      },
      {
        field: "acciones",
        headerName: t("common_acciones", "Acciones"),
        width: 140,
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
              <Tooltip title={t("planner_ver_detalle_tooltip", "Ver detalle de la solicitud")}>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  aria-label={`${t("common_ver", "Ver")} ${t("common_solicitud", "solicitud")} #${row.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetalleModal({ open: true, solicitud: row });
                  }}
                  sx={compactBtnSx}
                >
                  {t("common_ver", "Ver")}
                </Button>
              </Tooltip>
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
                  sx={compactBtnSx}
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
                  sx={compactBtnSx}
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
        headerName: t("common_estado", "Estado"),
        flex: 0.8,
        minWidth: 150,
        valueGetter: (params) => params.data.status || params.data.estado || "pendiente",
        valueFormatter: (params) => {
          const map = {
            draft: t("status_draft", "Borrador"),
            submitted: t("status_submitted", "Enviada"),
            pending: t("status_pending", "Pendiente"),
            processing: t("status_processing", "En proceso"),
            in_planning: t("status_in_planning", "En progreso"),
            in_treatment: t("status_in_treatment", "En tratamiento"),
            treated: t("status_treated", "Tratado"),
            approved: t("status_approved", "Aprobada"),
            completed: t("status_completed", "Completada"),
            closed: t("status_closed", "Cerrada"),
            rejected: t("status_rejected", "Rechazada"),
            dispatched: t("status_dispatched", "Despachada"),
            cancelled: t("status_cancelled", "Cancelada"),
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
              tooltipInfo={{ aprobador, planificador: planner, fechaEnvio: data.created_at }}
            />
          );
        },
      },
      {
        field: "created_at",
        headerName: t("planner_col_creacion", "Creación"),
        headerTooltip: t("planner_col_fecha_creacion", "Fecha de creación"),
        flex: 0.5,
        minWidth: 110,
        valueFormatter: (params) => formatDate(params.value),
      },
      {
        field: "solicitante",
        headerName: t("common_solicitante", "Solicitante"),
        flex: 0.8,
        minWidth: 140,
        valueGetter: (params) => renderSolicitante(params.data),
      },
      {
        field: "justificacion",
        headerName: t("planner_col_asunto", "Asunto"),
        flex: 1.2,
        minWidth: 160,
        tooltipField: "justificacion",
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "items_count",
        headerName: t("planner_col_items", "Ítems"),
        headerTooltip: t("planner_col_items_tooltip", "Cantidad de ítems"),
        width: 90,
        flex: 0,
        type: "rightAligned",
        valueGetter: (params) => (params.data.items || []).length,
      },
      {
        field: "centro",
        headerName: t("common_centro", "Centro"),
        flex: 0.4,
        minWidth: 100,
      },
      {
        field: "almacen",
        headerName: t("common_almacen", "Almacén"),
        flex: 0.4,
        minWidth: 110,
        valueGetter: (params) => params.data.almacen || params.data.almacen_virtual || params.data.almacen_codigo || "-",
      },
      {
        field: "sector",
        headerName: t("common_sector", "Sector"),
        flex: 0.5,
        minWidth: 110,
        valueGetter: (params) => getSectorNombre(params.data.sector),
      },
      {
        field: "criticidad",
        headerName: t("common_criticidad", "Criticidad"),
        flex: 0.5,
        minWidth: 120,
        cellRenderer: (params) => {
          const config = getCriticidadConfig(params.value || "Normal");
          const Icon = config.icon;
          return (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, height: "100%" }}>
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />}
              <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, color: config.color }}>
                {config.label}
              </Box>
            </Box>
          );
        },
      },
      {
        field: "total_monto",
        headerName: t("common_monto", "Monto"),
        flex: 0.7,
        minWidth: 165,
        type: "rightAligned",
        valueFormatter: (params) => formatCurrency(params.value || 0),
      },
      {
        field: "fecha_necesidad",
        headerName: t("planner_col_necesidad", "Necesidad"),
        headerTooltip: t("planner_col_fecha_necesidad", "Fecha de necesidad"),
        flex: 0.5,
        minWidth: 115,
        valueFormatter: (params) => formatDate(params.value),
      },
      {
        field: "ai_priority",
        headerName: t("planner_col_ia", "IA"),
        headerTooltip: t("planner_col_ia_tooltip", "Prioridad sugerida por IA"),
        width: 95,
        flex: 0,
        cellRenderer: (params) => {
          const priority = params.value;
          const score = params.data?.ai_score;
          if (!priority) return null;
          const colors = { Critica: "var(--danger-light)", Alta: "var(--warning-light)", Media: "var(--info)", Baja: "var(--neutral)" };
          const puntaje = score ? `${Math.round(score * 100)}%` : "-";
          return (
            <Typography
              variant="body2"
              component="span"
              fontWeight={600}
              title={`${t("common_puntaje", "Puntaje")}: ${puntaje}`}
              sx={{ color: colors[priority] || "var(--fg-muted)", fontSize: "0.75rem" }}
            >
              {iaLabels[priority] || priority}
            </Typography>
          );
        },
      },
    ];
  }, [handleTratar, handleTomar, user, t]);

  const rows = useMemo(() => filtered.map((item) => ({ ...item, id: item.id })), [filtered]);

  // Tab mapping
  const tabMapping = ["pendientes", "en_progreso", "finalizadas"];

  const getTitle = () => {
    if (filterMode === "asignadas") return t("nav_asignadas", "Solicitudes asignadas a mí");
    if (filterMode === "no-asignadas") return t("nav_no_asignadas", "Solicitudes no asignadas a mí");
    return t("planner_title", "Planificador");
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <>
      <PageLayout title={getTitle()}>
        {/* Alerts */}
        <Box aria-live="polite" sx={{ display: "contents" }}>
          {success && (
            <Alert severity="success" onClose={clearSuccess}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert severity="error" onClose={clearError}>
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
            borderRadius: "8px",
          }}
        >
          {/* Row 1: Search + Date Range + Clear */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "stretch", md: "flex-end" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Box sx={{ flex: 1, maxWidth: { md: 280 } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
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

            <Divider orientation="vertical" flexItem sx={{ height: 48, alignSelf: "center", display: { xs: "none", md: "block" } }} />

            <Box sx={{ flex: 1, maxWidth: { md: 320 } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
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
            display: "flex",
            flexDirection: "column",
            minHeight: 400,
            height: "calc(100vh - 340px)",
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons={false}
            sx={{
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
              minHeight: 42,
              flexShrink: 0,
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
                        ? t("planner_tab_en_progreso", "En progreso")
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
            height="100%"
            pagination={true}
            paginationPageSize={25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            enableQuickFilter={true}
            onRowDoubleClick={(data) => setDetalleModal({ open: true, solicitud: data })}
            exportFileName="planner_solicitudes"
            emptyMessage={t("planner_empty_full", "Sin solicitudes asignadas")}
          />
        </Paper>
      </PageLayout>

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
    </>
  );
}
