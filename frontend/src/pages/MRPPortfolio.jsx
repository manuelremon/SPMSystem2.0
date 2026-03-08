/**
 * MRPPortfolio - Materials planned by MRP
 * ✨ Migrado a SPMAgGrid para mejor rendimiento y consistencia
 * Shows datagrid with material, description, center, warehouse, sector, planning parameters
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Alert,
  InputAdornment,
  Chip,
} from "@mui/material";

// MUI Icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LayersIcon from "@mui/icons-material/Layers";
import RefreshIcon from "@mui/icons-material/Refresh";
import InboxIcon from "@mui/icons-material/Inbox";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// ============================================================================
// UTILITIES
// ============================================================================

function formatNumber(value) {
  if (value == null || isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

/** Summary card */
function SummaryCard({ label, value, subvalue }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "block",
          mb: 0.5,
          fontSize: "11px",
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: "text.primary",
        }}
      >
        {value}
      </Typography>
      {subvalue && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            mt: 0.5,
            display: "block",
          }}
        >
          {subvalue}
        </Typography>
      )}
    </Paper>
  );
}

/** Select filter */
function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        displayEmpty
        IconComponent={KeyboardArrowDownIcon}
        sx={{
          height: 40,
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
        <MenuItem value="">{placeholder}</MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** Empty state */
function EmptyState({ onClearFilters }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        textAlign: "center",
      }}
    >
      <Box sx={{ color: "grey.300", mb: 2 }}>
        <InboxIcon sx={{ fontSize: 48 }} />
      </Box>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}
      >
        No se encontraron materiales MRP
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Prueba ajustando los filtros de busqueda
      </Typography>
      <Button
        onClick={onClearFilters}
        size="small"
        sx={{
          fontWeight: 600,
          textTransform: "none",
          color: "primary.main",
          bgcolor: "primary.50",
          "&:hover": {
            bgcolor: "primary.100",
          },
        }}
      >
        Limpiar filtros
      </Button>
    </Box>
  );
}

/** Alert wrapper */
function AlertMessage({ type = "error", children, onDismiss }) {
  if (!children) return null;
  return (
    <Alert
      severity={type}
      onClose={onDismiss}
      sx={{
        "& .MuiAlert-message": {
          fontWeight: 500,
        },
      }}
    >
      {children}
    </Alert>
  );
}

/**
 * Portfolio tabla migrada a SPMAgGrid
 */
function PortfolioTable({ data, loading }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    return data.map((item, idx) => ({
      ...item,
      id: `${item.codigo_material}-${item.centro}-${item.almacen}-${idx}`,
    }));
  }, [data]);

  const columnDefs = useMemo(() => [
    {
      field: "codigo_material",
      headerName: t("common_material", "Material"),
      flex: 0.35,
      minWidth: 100,
      cellStyle: {
        fontFamily: "monospace",
      },
    },
    {
      field: "descripcion",
      headerName: t("common_description", "Descripción"),
      flex: 0.8,
      minWidth: 200,
    },
    {
      field: "centro",
      headerName: t("common_center", "Centro"),
      flex: 0.3,
      minWidth: 100,
    },
    {
      field: "almacen",
      headerName: t("mrp_almacen", "Almacén"),
      flex: 0.3,
      minWidth: 100,
    },
    {
      field: "sector",
      headerName: t("common_sector", "Sector"),
      flex: 0.3,
      minWidth: 100,
      valueFormatter: (params) => params.value || "-",
    },
    {
      field: "stock_de_seguridad",
      headerName: t("mrp_stock_safety", "Stock Seguridad"),
      flex: 0.4,
      minWidth: 120,
      type: "numericColumn",
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      field: "punto_de_pedido",
      headerName: t("mrp_reorder_point", "Punto Pedido"),
      flex: 0.4,
      minWidth: 120,
      type: "numericColumn",
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      field: "stock_maximo",
      headerName: t("mrp_stock_max", "Stock Máximo"),
      flex: 0.4,
      minWidth: 120,
      type: "numericColumn",
      valueFormatter: (params) => formatNumber(params.value),
    },
  ], [t]);

  if (loading) {
    return null; // SPMAgGrid manejará el estado de carga
  }

  if (data.length === 0) {
    return null; // Mostrar EmptyState en el componente principal
  }

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      loading={loading}
      height={600}
      pagination={true}
      paginationPageSize={25}
      enableQuickFilter={true}
      exportFileName="mrp_portfolio"
      emptyMessage={t("common_no_data", "Sin datos")}
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MRPPortfolio() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Data state
  const [data, setData] = useState([]);
  const [filtros, setFiltros] = useState({ centros: [], almacenes: [], sectores: [] });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [centro, setCentro] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [sector, setSector] = useState("");

  // Load MRP portfolio data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Con SPMAgGrid, cargamos todos los datos (sin paginación en API)
      const params = {};

      if (centro) params.centro = centro;
      if (almacen) params.almacen = almacen;
      if (sector) params.sector = sector;
      if (search) {
        if (/^\d+$/.test(search)) {
          params.material = search;
        } else {
          params.descripcion = search;
        }
      }

      const res = await api.get("/mrp/portfolio", { params });

      if (res.data?.ok) {
        setData(res.data.data);
        setTotal(res.data.total);
        setFiltros(res.data.filtros || { centros: [], almacenes: [], sectores: [] });
      } else {
        setError("Error al cargar portfolio MRP");
      }
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, [centro, almacen, sector, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearFilters = () => {
    setSearch("");
    setCentro("");
    setAlmacen("");
    setSector("");
  };

  const hasActiveFilters = search || centro || almacen || sector;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "grey.200",
          boxShadow: 1,
          mx: -4,
        }}
      >
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ height: 56 }}
          >
            {/* Left */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton
                onClick={() => navigate(-1)}
                size="small"
                sx={{
                  ml: -1,
                  color: "grey.400",
                  "&:hover": {
                    color: "grey.600",
                    bgcolor: "grey.100",
                  },
                }}
                aria-label="Volver"
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "primary.main",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LayersIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: "text.primary",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {t("mrp_portfolio_titulo", "Portfolio MRP")}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {t("mrp_portfolio_subtitulo", "Materiales planificados por MRP")}
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Right */}
            <Button
              onClick={loadData}
              disabled={loading}
              variant="outlined"
              size="small"
              startIcon={
                loading ? (
                  <RefreshIcon
                    fontSize="small"
                    sx={{
                      animation: "spin 1s linear infinite",
                      "@keyframes spin": {
                        "0%": { transform: "rotate(0deg)" },
                        "100%": { transform: "rotate(360deg)" },
                      },
                    }}
                  />
                ) : (
                  <RefreshIcon fontSize="small" />
                )
              }
              sx={{
                height: 36,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.75rem",
                color: "text.secondary",
                borderColor: "grey.200",
                "&:hover": {
                  bgcolor: "grey.50",
                  borderColor: "grey.300",
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Actualizar
              </Box>
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Main */}
      <Box component="main">
        {error && (
          <Box sx={{ mb: 3 }}>
            <AlertMessage type="error" onDismiss={() => setError("")}>
              {error}
            </AlertMessage>
          </Box>
        )}

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <SummaryCard
              label={t("mrp_total_materiales", "Materiales MRP")}
              value={formatNumber(total)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryCard
              label={t("mrp_centros", "Centros")}
              value={formatNumber(filtros.centros?.length || 0)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryCard
              label={t("mrp_almacenes", "Almacenes")}
              value={formatNumber(filtros.almacenes?.length || 0)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryCard
              label={t("mrp_sectores", "Sectores")}
              value={formatNumber(filtros.sectores?.length || 0)}
            />
          </Grid>
        </Grid>

        {/* Filters */}
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
              <FilterListIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Filtros
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={2}>
              {/* Search */}
              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por codigo o descripcion..."
                size="small"
                sx={{
                  flex: 1,
                  minWidth: 250,
                  maxWidth: 400,
                  "& .MuiOutlinedInput-root": {
                    height: 40,
                    bgcolor: "background.paper",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: "grey.400" }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Centro */}
              <FilterSelect
                value={centro}
                onChange={setCentro}
                options={filtros.centros}
                placeholder="Todos los centros"
              />

              {/* Almacen */}
              <FilterSelect
                value={almacen}
                onChange={setAlmacen}
                options={filtros.almacenes}
                placeholder="Todos los almacenes"
              />

              {/* Sector */}
              <FilterSelect
                value={sector}
                onChange={setSector}
                options={filtros.sectores}
                placeholder="Todos los sectores"
              />

              {/* Counter */}
              <Chip
                icon={<Box sx={{ width: 6, height: 6, bgcolor: "grey.400" }} />}
                label={`${total} materiales`}
                size="small"
                sx={{
                  bgcolor: "grey.100",
                  color: "text.secondary",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  "& .MuiChip-icon": { ml: 1 },
                }}
              />
            </Stack>
          </Box>
        </Paper>

        {/* Data Table */}
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "grey.200",
              bgcolor: "grey.50",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: "text.primary",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t("mrp_lista", "Materiales Planificados MRP")}
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("common_loading", "Cargando...")}
              </Typography>
            </Box>
          ) : data.length === 0 ? (
            <EmptyState onClearFilters={clearFilters} />
          ) : (
            <PortfolioTable data={data} loading={loading} />
          )}
        </Paper>
      </Box>
    </Box>
    </Box>
  );
}
