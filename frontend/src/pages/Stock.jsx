/**
 * Stock Masivo - Visualización masiva de stock
 * Shows current stock with inmovilizado and MRP indicators
 *
 * Migrated to AG-Grid (2026-02)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";
import api from "../services/api";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Chip,
  InputAdornment,
  Divider,
  Backdrop,
  CircularProgress,
  LinearProgress,
} from "@mui/material";

// MUI Icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

// AG-Grid component
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// ============================================================================
// UTILITIES
// ============================================================================

function formatCurrency(value) {
  if (value == null || isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value) {
  if (value == null || isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

/** Summary card */
function SummaryCard({ label, value, subvalue, variant = "default" }) {
  const variantStyles = {
    default: { bgcolor: "background.paper" },
    primary: { bgcolor: "primary.50", borderColor: "primary.200" },
    warning: { bgcolor: "warning.50", borderColor: "warning.200" },
    danger: { bgcolor: "error.50", borderColor: "error.200" },
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        ...variantStyles[variant],
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontSize: "11px",
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          mb: 0.5,
          display: "block",
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

// ============================================================================
// AG-GRID CELL RENDERERS
// ============================================================================

/** Boolean badge cell renderer */
function BooleanCellRenderer({ value }) {
  if (value) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
        label="Sí"
        size="small"
        sx={{
          height: 22,
          fontSize: "10px",
          fontWeight: 600,
          bgcolor: "success.50",
          color: "success.800",
          border: 1,
          borderColor: "success.200",
          "& .MuiChip-icon": {
            color: "success.800",
          },
        }}
      />
    );
  }
  return (
    <Chip
      icon={<CancelIcon sx={{ fontSize: 14 }} />}
      label="No"
      size="small"
      sx={{
        height: 22,
        fontSize: "10px",
        fontWeight: 600,
        bgcolor: "grey.100",
        color: "grey.600",
        border: 1,
        borderColor: "grey.200",
        "& .MuiChip-icon": {
          color: "grey.600",
        },
      }}
    />
  );
}

/** Days without movement cell renderer with color coding */
function DaysCellRenderer({ value }) {
  const days = value;
  if (days == null) return <span style={{ color: "#9e9e9e" }}>-</span>;

  let color = "#666";
  let fontWeight = 400;

  if (days > 365) {
    color = "#d32f2f"; // error.main
    fontWeight = 600;
  } else if (days > 180) {
    color = "#ed6c02"; // warning.main
    fontWeight = 500;
  }

  return (
    <span style={{ color, fontWeight, fontVariantNumeric: "tabular-nums" }}>
      {days}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Stock() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Data state
  const [data, setData] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [filtros, setFiltros] = useState({ centros: [], almacenes: [] });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [centro, setCentro] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [inmovilizado, setInmovilizado] = useState("");
  const [mrp, setMrp] = useState("");

  // AG-Grid column definitions
  const columnDefs = useMemo(() => [
    {
      headerName: "Material",
      field: "material",
      width: 120,
      pinned: "left",
      cellStyle: { fontFamily: "monospace", fontWeight: 500 },
    },
    {
      headerName: "Descripción",
      field: "descripcion",
      flex: 2,
      minWidth: 200,
      tooltipField: "descripcion",
    },
    {
      headerName: "Centro",
      field: "centro",
      width: 100,
    },
    {
      headerName: "Almacén",
      field: "almacen",
      width: 100,
    },
    {
      headerName: "Stock",
      field: "stock",
      width: 120,
      type: "numericColumn",
      valueFormatter: ({ value, data: row }) => {
        const num = formatNumber(value);
        return row?.um ? `${num} ${row.um}` : num;
      },
      cellStyle: { fontWeight: 500, fontVariantNumeric: "tabular-nums" },
    },
    {
      headerName: "Valor USD",
      field: "stock_valorizado",
      width: 130,
      type: "numericColumn",
      valueFormatter: ({ value }) => formatCurrency(value),
      cellStyle: { textAlign: 'right', paddingRight: '16px', fontVariantNumeric: "tabular-nums" },
    },
    {
      headerName: "Inmovilizado",
      field: "inmovilizado",
      width: 120,
      cellRenderer: BooleanCellRenderer,
      cellStyle: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' },
      filter: "agSetColumnFilter",
      filterParams: {
        values: [true, false],
        valueFormatter: ({ value }) => value ? "Sí" : "No",
      },
    },
    {
      headerName: "MRP",
      field: "mrp",
      width: 100,
      cellRenderer: BooleanCellRenderer,
      cellStyle: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' },
      filter: "agSetColumnFilter",
      filterParams: {
        values: [true, false],
        valueFormatter: ({ value }) => value ? "Sí" : "No",
      },
    },
    {
      headerName: "Días s/Mov",
      field: "dias_sin_movimiento",
      width: 120,
      type: "numericColumn",
      cellRenderer: DaysCellRenderer,
      filter: "agNumberColumnFilter",
    },
  ], []);

  // Load stock data - load all at once for AG-Grid virtualization
  const loadStock = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0);
    setError("");

    // Simulate progress
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 30;
      });
    }, 200);

    try {
      const params = {
        limit: 999999, // Load all stock data (unlimited)
        offset: 0,
      };

      if (centro) params.centro = centro;
      if (almacen) params.almacen = almacen;
      if (search) {
        if (/^\d+$/.test(search)) {
          params.material = search;
        } else {
          params.descripcion = search;
        }
      }
      if (inmovilizado !== "") params.inmovilizado = inmovilizado;
      if (mrp !== "") params.mrp = mrp;

      const [stockRes, resumenRes] = await Promise.all([
        api.get("/stock", { params }),
        api.get("/stock/resumen", { params: { centro, almacen } }),
      ]);

      if (stockRes.data?.ok) {
        setData(stockRes.data.data);
        setTotal(stockRes.data.total);
        setFiltros(stockRes.data.filtros || { centros: [], almacenes: [] });
      } else {
        setError("Error al cargar stock");
      }

      if (resumenRes.data?.ok) {
        setResumen(resumenRes.data.data);
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoading(false);
    }
  }, [centro, almacen, search, inmovilizado, mrp]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const clearFilters = () => {
    setSearch("");
    setCentro("");
    setAlmacen("");
    setInmovilizado("");
    setMrp("");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
              sx={{ fontWeight: 700, color: "text.primary", textTransform: "uppercase", letterSpacing: "0.5px" }}
            >
              {t("stock_masivo_titulo", "Stock Masivo")}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {resumen && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(6, 1fr)",
            },
            gap: 2,
          }}
        >
          <SummaryCard
            label={t("stock_total_items", "Items en Stock")}
            value={formatNumber(resumen.total_items)}
          />
          <SummaryCard
            label={t("stock_valor_total", "Valor Total")}
            value={formatCurrency(resumen.valor_total)}
            variant="primary"
          />
          <SummaryCard
            label={t("stock_inmovilizado", "Inmovilizado")}
            value={formatNumber(resumen.inmovilizado_items)}
            subvalue={formatCurrency(resumen.inmovilizado_valor)}
            variant="warning"
          />
          <SummaryCard
            label={t("stock_sin_consumo", "Sin Consumo 365d")}
            value={formatNumber(resumen.sin_consumo_365d)}
            variant="danger"
          />
          <SummaryCard
            label={t("stock_mrp", "Con MRP")}
            value={formatNumber(resumen.mrp_items)}
          />
          <SummaryCard
            label={t("stock_unidades", "Stock Total")}
            value={formatNumber(resumen.stock_total)}
            subvalue="unidades"
          />
        </Box>
      )}

      {/* Main Card with Filters and Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {/* Filter Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}>
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

        {/* Filters Section */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" flexWrap="wrap" alignItems="center" spacing={2} useFlexGap>
            {/* Search */}
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o descripción..."
              sx={{ flex: 1, minWidth: 250, maxWidth: 400 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Centro */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Centro</InputLabel>
              <Select
                value={centro}
                onChange={(e) => setCentro(e.target.value)}
                label="Centro"
              >
                <MenuItem value="">Todos los centros</MenuItem>
                {filtros.centros.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Almacen */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Almacén</InputLabel>
              <Select
                value={almacen}
                onChange={(e) => setAlmacen(e.target.value)}
                label="Almacén"
              >
                <MenuItem value="">Todos los almacenes</MenuItem>
                {filtros.almacenes.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Inmovilizado */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Inmovilizado</InputLabel>
              <Select
                value={inmovilizado}
                onChange={(e) => setInmovilizado(e.target.value)}
                label="Inmovilizado"
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="true">Sí</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>

            {/* MRP */}
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>MRP</InputLabel>
              <Select
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                label="MRP"
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="true">Sí</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>

            {/* Clear filters - always visible */}
            <Button
              variant="outlined"
              size="small"
              onClick={clearFilters}
              disabled={!search && !centro && !almacen && !inmovilizado && !mrp}
              sx={{ textTransform: "none" }}
            >
              Limpiar filtros
            </Button>

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Counter */}
            <Chip
              size="small"
              label={`${formatNumber(total)} items`}
              sx={{
                height: 28,
                bgcolor: "primary.50",
                color: "primary.main",
                fontWeight: 600,
              }}
            />
          </Stack>
        </Box>

        {/* AG-Grid Data Table */}
        <SPMAgGrid
          rowData={data}
          columnDefs={columnDefs}
          loading={loading}
          height={560}
          pagination={true}
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100, 200]}
          enableQuickFilter={true}
          exportFileName="stock"
          emptyMessage="No se encontraron registros de stock"
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
        />
      </Paper>

      {/* Loading Overlay */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(4px)",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        open={loading}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            width: "300px",
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Cargando stock...
          </Typography>
          <Box sx={{ width: "100%" }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(loadingProgress, 100)}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 4,
                },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
            {Math.min(Math.round(loadingProgress), 100)}%
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  );
}
