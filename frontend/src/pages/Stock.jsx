/**
 * Stock Masivo - Visualización masiva de stock
 * Shows current stock with inmovilizado and MRP indicators
 *
 * Migrated to AG-Grid (2026-02)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import PageLayout from "../components/ui/PageLayout";
import { formatCurrency as fmtCurrency, formatNumber as fmtNumber, formatDateFull } from "../utils/formatters";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Chip,
  InputAdornment,
  Divider,
  LinearProgress,
} from "@mui/material";

// MUI Icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

// AG-Grid component
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// ============================================================================
// UTILITIES
// ============================================================================

// Montos sin decimales ("USD 702.715.204"); "-" si no hay dato
function formatCurrency(value) {
  if (value == null || isNaN(value)) return "-";
  return fmtCurrency(value, 0);
}

function formatNumber(value) {
  if (value == null || isNaN(value)) return "-";
  return fmtNumber(Math.round(Number(value) * 100) / 100);
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
        ...variantStyles[variant],
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontSize: "var(--text-xs)",
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
  const { t } = useI18n();
  if (value) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
        label={t("common_si", "Sí")}
        size="small"
        sx={{
          height: 22,
          fontSize: "var(--text-2xs)",
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
      label={t("common_no", "No")}
      size="small"
      sx={{
        height: 22,
        fontSize: "var(--text-2xs)",
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

/** Days without movement cell renderer with color coding (null = nunca consumio) */
function DaysCellRenderer({ value }) {
  const { t } = useI18n();
  const days = value;
  if (days == null) {
    return (
      <span style={{ color: "var(--danger)", fontWeight: 500 }}>
        {t("stock_sin_consumo_registrado", "Sin consumo")}
      </span>
    );
  }

  let color = "var(--fg-muted)";
  let fontWeight = 400;

  if (days > 365) {
    color = "var(--danger)"; // error.main
    fontWeight = 600;
  } else if (days > 180) {
    color = "var(--warning)"; // warning.main
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
  const { t } = useI18n();

  // Data state
  const [data, setData] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [filtros, setFiltros] = useState({ centros: [], almacenes: [] });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sortCol, setSortCol] = useState("stock_valorizado");
  const [sortOrder, setSortOrder] = useState("desc");

  // Filter state
  const [search, setSearch] = useState("");
  const [centro, setCentro] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [inmovilizado, setInmovilizado] = useState("");
  const [mrp, setMrp] = useState("");

  // AG-Grid column definitions
  const columnDefs = useMemo(() => [
    {
      headerName: t("common_material", "Material"),
      field: "material",
      width: 120,
      pinned: "left",
      cellStyle: { fontFamily: "monospace", fontWeight: 500 },
    },
    {
      headerName: t("common_descripcion", "Descripción"),
      field: "descripcion",
      flex: 2,
      minWidth: 200,
      tooltipField: "descripcion",
    },
    {
      headerName: t("common_centro", "Centro"),
      field: "centro",
      width: 100,
    },
    {
      headerName: t("common_almacen", "Almacén"),
      field: "almacen",
      width: 110,
    },
    {
      headerName: t("stock_col_stock", "Stock"),
      field: "stock",
      width: 130,
      type: "rightAligned",
      valueFormatter: ({ value, data: row }) => {
        const num = formatNumber(value);
        return row?.um ? `${num} ${row.um}` : num;
      },
      cellStyle: { fontWeight: 500, fontVariantNumeric: "tabular-nums" },
    },
    {
      headerName: t("stock_col_valor", "Valor"),
      field: "stock_valorizado",
      width: 150,
      type: "rightAligned",
      valueFormatter: ({ value }) => formatCurrency(value),
      cellStyle: { fontVariantNumeric: "tabular-nums" },
    },
    {
      headerName: t("stock_inmovilizado", "Inmovilizado"),
      field: "inmovilizado",
      width: 130,
      headerTooltip: t("stock_inmovilizado_tt", "Sin consumo en los 12 meses previos a la fecha de corte del stock"),
      cellRenderer: BooleanCellRenderer,
      cellStyle: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' },
      filter: true,
    },
    {
      headerName: t("stock_col_marca_sap", "Marca SAP"),
      field: "inmovilizado_sap",
      width: 120,
      cellRenderer: BooleanCellRenderer,
      cellStyle: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' },
      headerTooltip: t("stock_col_marca_sap_tt", "Marca de inmovilizado informada por SAP (solo informativa)"),
      filter: true,
    },
    {
      headerName: t("stock_col_mrp", "MRP"),
      field: "mrp",
      width: 100,
      cellRenderer: BooleanCellRenderer,
      cellStyle: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' },
      filter: true,
    },
    {
      headerName: t("stock_col_dias_sin_mov", "Días sin mov."),
      field: "dias_sin_movimiento",
      width: 140,
      type: "rightAligned",
      cellRenderer: DaysCellRenderer,
      filter: "agNumberColumnFilter",
    },
  ], [t]);

  // Load stock data with server-side pagination
  const loadStock = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        limit: pageSize,
        offset: page * pageSize,
        sort: sortCol,
        order: sortOrder,
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
        setError(t("stock_error_carga", "No se pudo cargar el stock. Inténtalo de nuevo."));
      }

      if (resumenRes.data?.ok) {
        setResumen(resumenRes.data.data);
      }
    } catch {
      setError(t("stock_error_conexion", "No se pudo conectar con el servidor. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  }, [centro, almacen, search, inmovilizado, mrp, page, pageSize, sortCol, sortOrder, t]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [centro, almacen, search, inmovilizado, mrp]);

  const handleSortChanged = useCallback((event) => {
    const cols = event.api.getColumnState();
    const sorted = cols.find((c) => c.sort);
    if (sorted) {
      setSortCol(sorted.colId);
      setSortOrder(sorted.sort);
    } else {
      setSortCol("stock_valorizado");
      setSortOrder("desc");
    }
    setPage(0);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // "al 19/07/2025": fecha de corte del stock con la que se calcula el inmovilizado
  const alCorte = resumen?.fecha_corte
    ? t("stock_al_corte", "al {fecha}").replace("{fecha}", formatDateFull(resumen.fecha_corte))
    : null;

  const clearFilters = () => {
    setSearch("");
    setCentro("");
    setAlmacen("");
    setInmovilizado("");
    setMrp("");
  };

  return (
    <PageLayout title={t("stock_masivo_titulo", "Stock masivo")}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
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
            label={t("stock_total_items", "Ítems en stock")}
            value={formatNumber(resumen.total_items)}
          />
          <SummaryCard
            label={t("stock_valor_total", "Valor total")}
            value={formatCurrency(resumen.valor_total)}
            variant="primary"
          />
          <SummaryCard
            label={t("stock_inmovilizado", "Inmovilizado")}
            value={formatNumber(resumen.inmovilizado_items)}
            subvalue={alCorte ? `${formatCurrency(resumen.inmovilizado_valor)} · ${alCorte}` : formatCurrency(resumen.inmovilizado_valor)}
            variant="warning"
          />
          <SummaryCard
            label={t("stock_sin_consumo_12m", "Sin consumo 12 meses")}
            value={formatNumber(resumen.sin_consumo_365d)}
            subvalue={alCorte}
            variant="danger"
          />
          <SummaryCard
            label={t("stock_mrp", "Con MRP")}
            value={formatNumber(resumen.mrp_items)}
          />
          <SummaryCard
            label={t("stock_unidades", "Stock total")}
            value={formatNumber(resumen.stock_total)}
            subvalue={t("stock_unidades_sub", "unidades")}
          />
        </Box>
      )}
      {resumen?.fecha_corte && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
          {t(
            "stock_leyenda_inmovilizado",
            "Inmovilizado: sin consumo en los 12 meses previos a la fecha de corte del stock ({fecha}), por material, centro y almacén. La marca SAP es solo informativa."
          ).replace("{fecha}", formatDateFull(resumen.fecha_corte))}
        </Typography>
      )}

      {/* Main Card with Filters and Table */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
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
              {t("common_filtros", "Filtros")}
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
              placeholder={t("stock_buscar_placeholder", "Busca por código o descripción...")}
              sx={{ flex: 1, minWidth: { xs: "100%", sm: 250 }, maxWidth: { xs: "100%", sm: 400 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Centro */}
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 } }}>
              <InputLabel>{t("common_centro", "Centro")}</InputLabel>
              <Select
                value={centro}
                onChange={(e) => setCentro(e.target.value)}
                label={t("common_centro", "Centro")}
              >
                <MenuItem value="">{t("stock_todos_centros", "Todos los centros")}</MenuItem>
                {filtros.centros.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Almacen */}
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 } }}>
              <InputLabel>{t("common_almacen", "Almacén")}</InputLabel>
              <Select
                value={almacen}
                onChange={(e) => setAlmacen(e.target.value)}
                label={t("common_almacen", "Almacén")}
              >
                <MenuItem value="">{t("stock_todos_almacenes", "Todos los almacenes")}</MenuItem>
                {filtros.almacenes.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Inmovilizado */}
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 130 } }}>
              <InputLabel>{t("stock_inmovilizado", "Inmovilizado")}</InputLabel>
              <Select
                value={inmovilizado}
                onChange={(e) => setInmovilizado(e.target.value)}
                label={t("stock_inmovilizado", "Inmovilizado")}
              >
                <MenuItem value="">{t("common_todos", "Todos")}</MenuItem>
                <MenuItem value="true">{t("common_si", "Sí")}</MenuItem>
                <MenuItem value="false">{t("common_no", "No")}</MenuItem>
              </Select>
            </FormControl>

            {/* MRP */}
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 100 } }}>
              <InputLabel>{t("stock_col_mrp", "MRP")}</InputLabel>
              <Select
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                label={t("stock_col_mrp", "MRP")}
              >
                <MenuItem value="">{t("common_todos", "Todos")}</MenuItem>
                <MenuItem value="true">{t("common_si", "Sí")}</MenuItem>
                <MenuItem value="false">{t("common_no", "No")}</MenuItem>
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
              {t("common_limpiar_filtros", "Limpiar filtros")}
            </Button>

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Counter */}
            <Chip
              size="small"
              label={`${formatNumber(total)} ${t("common_items_lower", "ítems")}`}
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
          pagination={false}
          enableQuickFilter={false}
          exportFileName="stock"
          emptyMessage={t("stock_empty", "No se encontraron registros de stock")}
          defaultColDef={{
            sortable: true,
            filter: false,
            resizable: true,
          }}
          onSortChanged={handleSortChanged}
        />

        {/* Server-side pagination controls */}
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 1.5,
          px: 2, py: 1.5, borderTop: 1, borderColor: "divider", bgcolor: "grey.50",
        }}>
          <Stack direction="row" alignItems="center" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {formatNumber(Math.min(page * pageSize + 1, total))}–{formatNumber(Math.min((page + 1) * pageSize, total))} {t("stock_de", "de")} {formatNumber(total)}
            </Typography>
            <Divider orientation="vertical" flexItem />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ whiteSpace: "nowrap" }}>
              <Typography variant="body2" color="text.secondary">
                {t("stock_filas_por_pagina", "Filas por página")}
              </Typography>
              <Select
                value={pageSize}
                onChange={(e) => { setPageSize(e.target.value); setPage(0); }}
                variant="standard"
                size="small"
                sx={{ fontSize: "0.875rem", minWidth: 60 }}
                inputProps={{ "aria-label": t("stock_filas_por_pagina", "Filas por página") }}
              >
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
                <MenuItem value={500}>500</MenuItem>
              </Select>
            </Stack>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: { xs: 0, sm: "auto" } }}>
            <Button
              size="small"
              disabled={page === 0 || loading}
              onClick={() => setPage(0)}
              aria-label={t("common_primera_pagina", "Primera página")}
              sx={{ minWidth: 36, textTransform: "none" }}
            >
              ««
            </Button>
            <Button
              size="small"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label={t("common_pagina_anterior", "Página anterior")}
              sx={{ minWidth: 36, textTransform: "none" }}
            >
              «
            </Button>
            <Typography variant="body2" sx={{ fontWeight: 600, mx: 1, whiteSpace: "nowrap" }}>
              {formatNumber(page + 1)} / {formatNumber(totalPages)}
            </Typography>
            <Button
              size="small"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t("common_pagina_siguiente", "Página siguiente")}
              sx={{ minWidth: 36, textTransform: "none" }}
            >
              »
            </Button>
            <Button
              size="small"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage(totalPages - 1)}
              aria-label={t("common_ultima_pagina", "Última página")}
              sx={{ minWidth: 36, textTransform: "none" }}
            >
              »»
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Loading indicator */}
      {loading && (
        <LinearProgress sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }} />
      )}
    </PageLayout>
  );
}
