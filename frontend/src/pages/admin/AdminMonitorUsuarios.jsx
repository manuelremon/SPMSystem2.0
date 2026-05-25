import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";
import { SPMAgGrid } from "../../components/ui/SPMAgGrid";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputAdornment,
  CircularProgress,
  Alert,
  Menu,
  Avatar,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import ActivityIcon from "@mui/icons-material/ShowChart";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FilterListIcon from "@mui/icons-material/FilterList";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InboxIcon from "@mui/icons-material/Inbox";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Tooltip from "@mui/material/Tooltip";

// Services
import { exportToXLSX } from "../../services/export";

// ============================================================================
// CONSTANTES
// ============================================================================

const ACTION_TYPES = [
  { value: "", label: "Todas las acciones", icon: "layers" },
  { value: "crear", label: "Crear", icon: "plus" },
  { value: "modificar", label: "Modificar", icon: "edit" },
  { value: "aprobar", label: "Aprobar", icon: "check" },
  { value: "rechazar", label: "Rechazar", icon: "x" },
  { value: "eliminar", label: "Eliminar", icon: "trash" },
  { value: "consumo", label: "Consumo", icon: "trending-down" },
  { value: "reversion", label: "Reversión", icon: "rotate-ccw" },
  { value: "DB_INSERT", label: "DB Insert", icon: "database" },
  { value: "DB_UPDATE", label: "DB Update", icon: "database" },
  { value: "DB_DELETE", label: "DB Delete", icon: "database" },
];

const DAY_PRESETS = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

// ============================================================================
// UTILIDADES
// ============================================================================

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionStyle(action) {
  const actionLower = (action || "").toLowerCase();

  if (actionLower.includes("crear") || actionLower.includes("aprobar") || actionLower.includes("insert")) {
    return {
      bgcolor: "success.50",
      color: "success.700",
      borderColor: "success.200",
      dotColor: "success.main",
    };
  }
  if (actionLower.includes("modificar") || actionLower.includes("update")) {
    return {
      bgcolor: "info.50",
      color: "info.700",
      borderColor: "info.200",
      dotColor: "info.main",
    };
  }
  if (actionLower.includes("rechazar") || actionLower.includes("eliminar") || actionLower.includes("delete")) {
    return {
      bgcolor: "error.50",
      color: "error.700",
      borderColor: "error.200",
      dotColor: "error.main",
    };
  }
  if (actionLower.includes("reversion") || actionLower.includes("consumo")) {
    return {
      bgcolor: "warning.50",
      color: "warning.700",
      borderColor: "warning.200",
      dotColor: "warning.main",
    };
  }
  return {
    bgcolor: "grey.100",
    color: "grey.600",
    borderColor: "grey.300",
    dotColor: "grey.400",
  };
}

function formatDetails(details) {
  if (!details) return "—";
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2).substring(0, 120);
    } catch {
      return details.substring(0, 120);
    }
  }
  return JSON.stringify(details, null, 2).substring(0, 120);
}


// ============================================================================
// COMPONENTES UI REUTILIZABLES
// ============================================================================

/** Badge de estado para acciones */
function ActionBadge({ action }) {
  const style = getActionStyle(action);
  return (
    <Chip
      size="small"
      label={action || "—"}
      icon={
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: style.dotColor,
            ml: 1,
          }}
        />
      }
      sx={{
        height: 24,
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        bgcolor: style.bgcolor,
        color: style.color,
        border: 1,
        borderColor: style.borderColor,
        "& .MuiChip-icon": {
          ml: 1,
        },
        "& .MuiChip-label": {
          px: 1,
        },
      }}
    />
  );
}

/** Chip clickeable para IDs de entidad */
function EntityIdChip({ entityType, entityId, onClick }) {
  if (entityType === "solicitud" && entityId) {
    return (
      <Chip
        size="small"
        label={`#${entityId}`}
        onClick={onClick}
        onDelete={undefined}
        deleteIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
        sx={{
          height: 24,
          fontSize: "var(--text-xs)",
          fontFamily: "monospace",
          fontWeight: 600,
          bgcolor: "primary.50",
          color: "primary.700",
          border: 1,
          borderColor: "primary.200",
          cursor: "pointer",
          "&:hover": {
            bgcolor: "primary.100",
            borderColor: "primary.300",
          },
          "& .MuiChip-label": {
            px: 1,
          },
        }}
      />
    );
  }
  return (
    <Typography
      variant="body2"
      sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "var(--text-base)" }}
    >
      {entityId || "—"}
    </Typography>
  );
}

/** Selector de usuario con autocompletado */
function UserSelector({ usuarios, selectedUser, onSelect, loading }) {
  const { t } = useI18n();
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState("");
  const isOpen = Boolean(anchorEl);

  const filteredUsers = useMemo(() => {
    if (!search) return usuarios;
    const searchLower = search.toLowerCase();
    return usuarios.filter(u =>
      `${u.nombre} ${u.apellido}`.toLowerCase().includes(searchLower) ||
      (u.mail || "").toLowerCase().includes(searchLower) ||
      (u.id_spm || "").toLowerCase().includes(searchLower)
    );
  }, [usuarios, search]);

  const handleSelect = (user) => {
    onSelect(user);
    setAnchorEl(null);
    setSearch("");
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearch("");
  };

  return (
    <Box sx={{ position: "relative" }}>
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon sx={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
        startIcon={<PersonIcon sx={{ color: "text.secondary" }} />}
        sx={{
          minWidth: 280,
          height: 40,
          px: 1.5,
          justifyContent: "space-between",
          bgcolor: "background.paper",
          borderColor: isOpen ? "primary.main" : "grey.300",
          color: selectedUser ? "text.primary" : "text.secondary",
          textTransform: "none",
          fontWeight: selectedUser ? 500 : 400,
          "&:hover": {
            borderColor: "grey.400",
            bgcolor: "background.paper",
          },
        }}
      >
        <Box sx={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedUser ? (
            <>
              {selectedUser.nombre} {selectedUser.apellido}
              <Typography component="span" sx={{ color: "text.secondary", fontWeight: 400, ml: 1 }}>
                ({selectedUser.id_spm})
              </Typography>
            </>
          ) : (
            "Seleccionar usuario..."
          )}
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 320,
            maxHeight: 400,
            mt: 0.5,
          },
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {/* Search input */}
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "grey.200" }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('admin_monitor_users_search_placeholder', 'Buscar por nombre, email o ID...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: "grey.50",
                "& fieldset": { borderColor: "grey.200" },
                "&:hover fieldset": { borderColor: "grey.300" },
                "&.Mui-focused fieldset": { borderColor: "primary.main" },
              },
            }}
          />
        </Box>

        {/* User list */}
        <Box sx={{ maxHeight: 300, overflow: "auto" }}>
          {loading ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Cargando usuarios...
              </Typography>
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No se encontraron usuarios
              </Typography>
            </Box>
          ) : (
            filteredUsers.map((user) => (
              <MenuItem
                key={user.id_spm || user.id}
                onClick={() => handleSelect(user)}
                selected={selectedUser?.id_spm === user.id_spm}
                sx={{
                  py: 1.5,
                  "&.Mui-selected": { bgcolor: "primary.50" },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "grey.200",
                      color: "grey.600",
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                    }}
                  >
                    {(user.nombre?.[0] || "")}{(user.apellido?.[0] || "")}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                      {user.nombre} {user.apellido}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {user.mail || user.id_spm}
                    </Typography>
                  </Box>
                </Stack>
              </MenuItem>
            ))
          )}
        </Box>
      </Menu>
    </Box>
  );
}

/** Botones de preset de días */
function DayPresetButtons({ value, onChange }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontSize: "var(--text-xs)",
        }}
      >
        Período
      </Typography>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(e, newValue) => newValue !== null && onChange(newValue)}
        size="small"
        sx={{
          "& .MuiToggleButton-root": {
            px: 1.5,
            py: 0.5,
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            borderColor: "grey.300",
            "&.Mui-selected": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": {
                bgcolor: "primary.dark",
              },
            },
          },
        }}
      >
        {DAY_PRESETS.map((preset) => (
          <ToggleButton key={preset.value} value={preset.value}>
            {preset.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}

/** Selector de tipo de acción */
function ActionTypeSelect({ value, onChange }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontSize: "var(--text-xs)",
        }}
      >
        Acción
      </Typography>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          displayEmpty
          IconComponent={KeyboardArrowDownIcon}
          sx={{
            height: 36,
            fontSize: "0.875rem",
            fontWeight: 500,
            bgcolor: "background.paper",
            "& .MuiSelect-select": {
              py: 1,
              px: 1.5,
            },
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "grey.300",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "grey.400",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "primary.main",
            },
          }}
        >
          {ACTION_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

/** Contador de resultados */
function ResultsCounter({ count, loading }) {
  if (loading) return null;
  return (
    <Chip
      size="small"
      icon={
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: "grey.500",
            ml: 1,
          }}
        />
      }
      label={`${count.toLocaleString()} registros`}
      sx={{
        height: 28,
        bgcolor: "grey.100",
        color: "text.secondary",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        "& .MuiChip-icon": {
          ml: 1,
        },
      }}
    />
  );
}

/** Estado vacio */
function EmptyState({ type = "no-selection", message }) {
  const content = {
    "no-selection": {
      icon: <PersonIcon sx={{ fontSize: 48 }} />,
      title: "Selecciona un usuario",
      description: "Elige un usuario de la lista para ver su historial de actividad.",
    },
    "no-results": {
      icon: <InboxIcon sx={{ fontSize: 48 }} />,
      title: "Sin actividad",
      description: message || "No hay actividad registrada para los filtros seleccionados.",
    },
  };

  const { icon, title, description } = content[type];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, textAlign: "center" }}>
      <Box sx={{ color: "grey.300", mb: 2 }}>{icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.secondary", mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 320 }}>
        {description}
      </Typography>
    </Box>
  );
}

/** Spinner de carga */
function LoadingSpinner() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 8 }}>
      <CircularProgress size={40} />
    </Box>
  );
}

/** Alerta de error */
function ErrorAlert({ message, onDismiss }) {
  if (!message) return null;
  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineIcon />}
      onClose={onDismiss}
      sx={{
        mb: 2,
        "& .MuiAlert-message": {
          fontWeight: 500,
        },
      }}
    >
      {message}
    </Alert>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * Componente tabla de actividad migrado a SPMAgGrid
 */
function ActivityTable({ data, selectedUser }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const rows = useMemo(() => {
    return data.map((row, idx) => ({
      ...row,
      id: row.id || `${row.created_at}-${row.action}-${row.entity_id}-${idx}`,
      formatted_date: formatDateTime(row.created_at),
      entity_display: row.entity_type || '—',
      ip_display: row.ip_address || '—',
    }))
  }, [data])

  const columnDefs = useMemo(() => [
    {
      field: 'formatted_date',
      headerName: t('common_date_time', 'Fecha / Hora'),
      flex: 0.7,
      minWidth: 160,
      cellRenderer: (params) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTimeIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-base)', color: 'text.secondary' }}
          >
            {params.value}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'action',
      headerName: t('common_action', 'Acción'),
      flex: 0.5,
      minWidth: 130,
      cellRenderer: (params) => <ActionBadge action={params.value} />,
    },
    {
      field: 'entity_display',
      headerName: t('common_entity', 'Entidad'),
      flex: 0.4,
      minWidth: 120,
      valueFormatter: (params) => params.value,
    },
    {
      field: 'entity_id',
      headerName: t('common_id', 'ID'),
      flex: 0.3,
      minWidth: 100,
      cellRenderer: (params) => (
        <EntityIdChip
          entityType={params.data.entity_type}
          entityId={params.value}
          onClick={() => navigate(`/solicitudes/${params.value}`)}
        />
      ),
    },
    {
      field: 'details',
      headerName: t('common_details', 'Detalles'),
      flex: 1,
      minWidth: 200,
      valueFormatter: (params) => formatDetails(params.value),
    },
    {
      field: 'ip_display',
      headerName: 'IP',
      flex: 0.4,
      minWidth: 120,
      cellStyle: {
        textAlign: 'right',
        fontFamily: 'monospace',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--text-sm)',
      },
    },
  ], [t, navigate])

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={500}
      pagination={true}
      paginationPageSize={25}
      enableQuickFilter={true}
      exportFileName={`audit_logs_${selectedUser.id_spm}`}
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  )
}

export default function AdminMonitorUsuarios() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Estado
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [actionType, setActionType] = useState("");

  // Cargar lista de usuarios
  const loadUsuarios = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get("/admin/usuarios");
      const data = Array.isArray(res.data) ? res.data : [];
      setUsuarios(data);
    } catch (err) {
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Cargar actividad del usuario seleccionado
  const loadActividad = useCallback(async () => {
    if (!selectedUser) {
      setActividad([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        user_id: selectedUser.id_spm || selectedUser.id,
        days: days.toString(),
        limit: "500",
      });
      if (actionType) {
        params.append("operation", actionType);
      }

      const res = await api.get(`/admin/database/audit-logs?${params.toString()}`);
      if (res.data?.ok) {
        setActividad(res.data.logs || []);
      } else {
        setError("Error al cargar actividad");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [selectedUser, days, actionType]);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  useEffect(() => {
    loadActividad();
  }, [loadActividad]);

  // Columnas de la tabla
  const columns = useMemo(() => [
    {
      key: "created_at",
      header: "Fecha / Hora",
      width: "160px",
      align: "left",
    },
    {
      key: "action",
      header: "Acción",
      width: "130px",
      align: "left",
    },
    {
      key: "entity_type",
      header: "Entidad",
      width: "120px",
      align: "left",
    },
    {
      key: "entity_id",
      header: "ID",
      width: "100px",
      align: "center",
    },
    {
      key: "details",
      header: "Detalles",
      width: "auto",
      align: "left",
    },
    {
      key: "ip_address",
      header: "IP",
      width: "120px",
      align: "right",
    },
  ], []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <Paper
        component="header"
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "grey.200",
          boxShadow: 1,
        }}
      >
        <Box sx={{ maxWidth: 1600, mx: "auto", px: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 56 }}>
            {/* Left: Navigation + Title */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  ml: -1,
                  color: "text.secondary",
                  "&:hover": {
                    color: "text.primary",
                    bgcolor: "grey.100",
                  },
                }}
                aria-label={t("aria_back", "Volver")}
              >
                <ArrowBackIcon sx={{ fontSize: 20 }} />
              </IconButton>

              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontSize: "var(--text-base)",
                    }}
                  >
                    {t("admin_monitor_usuarios", "Monitor de Usuarios")}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Right: Actions */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 18, ...(loading && { animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }) }} />}
              onClick={loadActividad}
              disabled={loading || !selectedUser}
              sx={{
                textTransform: "uppercase",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                letterSpacing: "0.05em",
              }}
            >
              Actualizar
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* ================================================================== */}
      {/* MAIN CONTENT */}
      {/* ================================================================== */}
      <Box component="main" sx={{ maxWidth: 1600, mx: "auto", px: 3, py: 3 }}>
        <ErrorAlert message={error} onDismiss={() => setError("")} />

        {/* ================================================================ */}
        {/* FILTERS PANEL */}
        {/* ================================================================ */}
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "grey.100",
              bgcolor: "grey.50",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <FilterListIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "var(--text-xs)",
                }}
              >
                Filtros
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <Stack
              direction="row"
              flexWrap="wrap"
              alignItems="center"
              spacing={3}
              divider={<Divider orientation="vertical" flexItem sx={{ mx: 1.5 }} />}
            >
              {/* User Selector */}
              <UserSelector
                usuarios={usuarios}
                selectedUser={selectedUser}
                onSelect={setSelectedUser}
                loading={loadingUsers}
              />

              {/* Day Presets */}
              <DayPresetButtons value={days} onChange={setDays} />

              {/* Action Type */}
              <ActionTypeSelect value={actionType} onChange={setActionType} />

              {/* Results Counter */}
              {selectedUser && <ResultsCounter count={actividad.length} loading={loading} />}
            </Stack>
          </Box>
        </Paper>

        {/* ================================================================ */}
        {/* DATA TABLE */}
        {/* ================================================================ */}
        <Paper variant="outlined">
          {/* Table Header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "grey.200",
              bgcolor: "grey.50",
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  {t("monitor_user_activity", "Historial de Actividad")}
                </Typography>
                {selectedUser && (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    — {selectedUser.nombre} {selectedUser.apellido}
                  </Typography>
                )}
              </Stack>
              {selectedUser && !loading && actividad.length > 0 && (
                <Typography variant="caption" sx={{ color: "text.disabled" }}>
                  Últimos {days} días
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Table Content */}
          {!selectedUser ? (
            <EmptyState type="no-selection" />
          ) : loading ? (
            <LoadingSpinner />
          ) : actividad.length === 0 ? (
            <EmptyState
              type="no-results"
              message={t("monitor_no_activity", "No hay actividad registrada para este usuario")}
            />
          ) : (
            <ActivityTable
              data={actividad}
              onRowClick={(id) => {}}
              selectedUser={selectedUser}
            />
          )}

        </Paper>
      </Box>
      </Box>
    </Box>
  );
}
