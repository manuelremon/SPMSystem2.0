/**
 * Planner Page - Material UI Migration
 * SAP/Enterprise UI with full MUI components
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanner, renderSolicitante } from "../hooks/usePlanner";
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
import Badge from "@mui/material/Badge";
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
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

/* ─────────────────────────────────────────────────────────────
   Multi-Select Dropdown Component (MUI)
───────────────────────────────────────────────────────────── */
function MultiSelect({ label, options, selected, onChange, keyField, labelField }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const getKey = (opt) => opt[keyField] || opt.value || opt.id || opt;
  const getLabel = (opt) => opt[labelField] || opt.label || opt.nombre || opt;

  const selectedKeys = selected.map((s) => getKey(s));
  const allSelected = selectedKeys.length === options.length && options.length > 0;

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
      ? "Ninguno"
      : selectedKeys.length === 1
      ? getLabel(selected[0])
      : `${selectedKeys.length} seleccionados`;

  return (
    <Box sx={{ minWidth: 130 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.secondary",
          mb: 0.5,
          fontSize: "10px",
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
          fontWeight: 400,
          fontSize: "0.75rem",
          py: 0.75,
          px: 1.5,
          color: selectedKeys.length === 0 ? "text.secondary" : "text.primary",
          borderColor: "divider",
          "&:hover": {
            borderColor: "primary.main",
            bgcolor: "action.hover",
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
            maxHeight: 208,
            minWidth: anchorEl?.offsetWidth || 150,
          },
        }}
      >
        <MenuItem onClick={toggleAll} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Checkbox
            checked={allSelected}
            size="small"
            sx={{ p: 0, mr: 1 }}
          />
          <ListItemText
            primary="Seleccionar todos"
            primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }}
          />
        </MenuItem>
        {options.map((opt) => {
          const key = getKey(opt);
          const isSelected = selectedKeys.includes(key);
          return (
            <MenuItem
              key={key}
              onClick={() => toggleOption(opt)}
              sx={{ fontSize: "0.75rem" }}
            >
              <Checkbox
                checked={isSelected}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              <ListItemText
                primary={getLabel(opt)}
                primaryTypographyProps={{ fontSize: "0.75rem", noWrap: true }}
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
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
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
        flex: 0.3,
        minWidth: 60,
      },
      {
        field: "acciones",
        headerName: "Acción",
        flex: 0.6,
        minWidth: 120,
        sortable: false,
        cellRenderer: (params) => (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                setDetalleModal({ open: true, solicitud: params.data });
              }}
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.5,
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Ver
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={(e) => {
                e.stopPropagation();
                handleTratar(params.data);
              }}
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.5,
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Tratar
            </Button>
          </Stack>
        ),
      },
      {
        field: "items_count",
        headerName: "Items",
        flex: 0.3,
        minWidth: 60,
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
        field: "created_at",
        headerName: "F. Creación",
        flex: 0.5,
        minWidth: 90,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "centro",
        headerName: "Centro",
        flex: 0.4,
        minWidth: 70,
      },
      {
        field: "almacen",
        headerName: "Almacén",
        flex: 0.4,
        minWidth: 70,
        valueGetter: (params) => params.data.almacen || params.data.almacen_codigo || "-",
      },
      {
        field: "sector",
        headerName: "Sector",
        flex: 0.6,
        minWidth: 100,
        valueGetter: (params) => getSectorNombre(params.data.sector),
      },
      {
        field: "solicitante",
        headerName: "Solicitante",
        flex: 0.7,
        minWidth: 120,
        valueGetter: (params) => renderSolicitante(params.data),
      },
      {
        field: "criticidad",
        headerName: "Criticidad",
        flex: 0.5,
        minWidth: 80,
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
        field: "justificacion",
        headerName: "Asunto",
        flex: 1,
        minWidth: 120,
        cellRenderer: (params) => {
          const texto = params.value || "-";
          const truncado = texto.length > 25;
          return (
            <Typography
              variant="body2"
              noWrap
              title={truncado ? texto : undefined}
            >
              {truncado ? texto.slice(0, 25) + "..." : texto}
            </Typography>
          );
        },
      },
      {
        field: "total_monto",
        headerName: "Monto",
        flex: 0.6,
        minWidth: 100,
        type: "numericColumn",
        cellStyle: { textAlign: 'right', paddingRight: '16px' },
        cellRenderer: (params) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {formatCurrency(params.value || 0)}
          </Typography>
        ),
      },
      {
        field: "fecha_necesidad",
        headerName: "F. Necesidad",
        flex: 0.5,
        minWidth: 90,
        cellRenderer: (params) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(params.value)}
          </Typography>
        ),
      },
      {
        field: "estado",
        headerName: "Estado",
        flex: 0.7,
        minWidth: 100,
        valueGetter: (params) => params.data.status || params.data.estado || "pendiente",
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
    ],
    [handleTratar]
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
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: "text.secondary",
              "&:hover": {
                bgcolor: "background.paper",
                color: "text.primary",
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h5"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing="0.05em"
            color="text.primary"
          >
            {getTitle()}
          </Typography>
        </Stack>

        {/* Alerts */}
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

        {/* Filters */}
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 2,
            mb: 3,
          }}
        >
          <Stack direction="row" flexWrap="wrap" alignItems="flex-end" spacing={2}>
            {/* Date Range Slider */}
            <Box sx={{ minWidth: 260 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 0.5,
                  fontSize: "10px",
                }}
              >
                Desde{" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {sliderAFecha(rangoFechasLocal[0])}
                </Box>{" "}
                hasta{" "}
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
                sx={{
                  mt: 1,
                  "& .MuiSlider-thumb": {
                    width: 14,
                    height: 14,
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.disabled">
                  Hace 1 año
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Hoy
                </Typography>
              </Stack>
            </Box>

            {/* Separator */}
            <Divider orientation="vertical" flexItem sx={{ height: 48, alignSelf: "center" }} />

            {/* Search */}
            <Box sx={{ minWidth: 140 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 0.5,
                  fontSize: "10px",
                }}
              >
                Buscar
              </Typography>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ID, asunto..."
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    fontSize: "0.75rem",
                  },
                  "& .MuiOutlinedInput-input": {
                    py: 0.75,
                    px: 1.5,
                  },
                }}
              />
            </Box>

            {/* Centro */}
            <MultiSelect
              label="Centro"
              options={catalogos.centros || []}
              selected={filtroCentros}
              onChange={setFiltroCentros}
              keyField="id"
              labelField="nombre"
            />

            {/* Almacén */}
            <MultiSelect
              label="Almacén"
              options={catalogos.almacenes || []}
              selected={filtroAlmacenes}
              onChange={setFiltroAlmacenes}
              keyField="codigo"
              labelField="nombre"
            />

            {/* Sector */}
            <MultiSelect
              label="Sector"
              options={catalogos.sectores || []}
              selected={filtroSectores}
              onChange={setFiltroSectores}
              keyField="nombre"
              labelField="nombre"
            />

            {/* Estado */}
            <MultiSelect
              label="Estado"
              options={estadosOptions}
              selected={filtroEstados}
              onChange={setFiltroEstados}
              keyField="value"
              labelField="label"
            />

            {/* Criticidad */}
            <MultiSelect
              label="Criticidad"
              options={criticidadOptions}
              selected={filtroCriticidades}
              onChange={setFiltroCriticidades}
              keyField="value"
              labelField="label"
            />

            {/* Clear Filters */}
            <Button
              onClick={() => {
                limpiarFiltros();
                setRangoFechasLocal([0, 365]);
              }}
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<FilterAltOffIcon />}
              sx={{
                fontWeight: 500,
                fontSize: "0.75rem",
                py: 0.75,
                textTransform: "none",
              }}
            >
              Limpiar
            </Button>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: "8px 8px 0 0",
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              "& .MuiTab-root": {
                fontWeight: 600,
                fontSize: "0.875rem",
                textTransform: "none",
                py: 1.75,
                px: 2.5,
              },
            }}
          >
            {tabMapping.map((tab) => (
              <Tab
                key={tab}
                value={tab}
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
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
                        fontSize: "10px",
                        fontWeight: 700,
                        "& .MuiChip-label": { px: 1 },
                      }}
                    />
                  </Stack>
                }
              />
            ))}
          </Tabs>
        </Paper>

        {/* AG Grid */}
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderTop: 0,
            borderColor: "divider",
            borderRadius: "0 0 8px 8px",
            overflow: "hidden",
          }}
        >
          <SPMAgGrid
            rowData={rows}
            columnDefs={columnDefs}
            loading={loading}
            height={600}
            pagination={true}
            paginationPageSize={25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            enableQuickFilter={true}
            onRowDoubleClick={(data) => setDetalleModal({ open: true, solicitud: data })}
            exportFileName="planner_solicitudes"
            emptyMessage={t("planner_empty_full", "Sin solicitudes asignadas")}
          />
        </Paper>

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
