/**
 * Stock Individual - Búsqueda de material individual
 * Shows stock availability by center and warehouse for a single material
 *
 * (2026-02)
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
  Alert,
  Stack,
  Backdrop,
  CircularProgress,
  LinearProgress,
  Card,
  Grid,
  Divider,
} from "@mui/material";

// MUI Icons
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import BusinessIcon from "@mui/icons-material/Business";

// AG-Grid component
import { SPMAgGrid } from "../components/ui/SPMAgGrid";

// ============================================================================
// UTILITIES
// ============================================================================

function formatNumber(value) {
  if (value == null || isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value) {
  if (value == null || isNaN(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// SUMMARY CARD
// ============================================================================

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <Card
      sx={{
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          p: 1.5,
          bgcolor: "primary.50",
          display: "flex",
          color: "primary.main",
        }}
      >
        {Icon && <Icon fontSize="medium" />}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
          {value}
        </Typography>
      </Box>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StockIndividual() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Column definitions for AG-Grid
  const columnDefs = useMemo(
    () => [
      {
        headerName: "Centro",
        field: "centro",
        width: 100,
        pinned: "left",
      },
      {
        headerName: "Almacén",
        field: "almacen",
        width: 100,
      },
      {
        headerName: "Stock",
        field: "stock",
        width: 130,
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
        cellStyle: { textAlign: "right", paddingRight: "16px", fontVariantNumeric: "tabular-nums" },
      },
      {
        headerName: "Precio Unitario",
        field: "precio",
        width: 130,
        type: "numericColumn",
        valueFormatter: ({ value }) => formatCurrency(value),
        cellStyle: { textAlign: "right", paddingRight: "16px", fontVariantNumeric: "tabular-nums" },
      },
      {
        headerName: "U.M.",
        field: "um",
        width: 80,
      },
    ],
    []
  );

  // Search material
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError("Ingresa un código o descripción de material");
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setError("");
    setStockData([]);
    setSelectedMaterial(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 30;
      });
    }, 200);

    try {
      const params = {};
      if (/^\d+$/.test(searchQuery)) {
        params.material = searchQuery;
      } else {
        params.descripcion = searchQuery;
      }

      const res = await api.get("/stock", { params });

      if (res.data?.ok && res.data.data.length > 0) {
        // Group by material and show all locations
        const material = res.data.data[0];
        setSelectedMaterial({
          codigo: material.material,
          descripcion: material.descripcion,
          um: material.um,
        });

        // Get summary stats
        const totalStock = res.data.data.reduce((sum, row) => sum + (row.stock || 0), 0);
        const totalValor = res.data.data.reduce((sum, row) => sum + (row.stock_valorizado || 0), 0);
        const centrosUnicos = new Set(res.data.data.map((r) => r.centro)).size;
        const almacenesUnicos = new Set(res.data.data.map((r) => r.almacen)).size;

        // Store original data
        setStockData(res.data.data);

        // Also return summary
        window._materialSummary = {
          totalStock,
          totalValor,
          centrosUnicos,
          almacenesUnicos,
        };
      } else {
        setError("No se encontró stock para este material");
      }
    } catch (err) {
      setError("Error al buscar material");
    } finally {
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoading(false);
    }
  }, [searchQuery]);

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Get summary stats
  const summary = useMemo(() => {
    if (stockData.length === 0) return null;

    const totalStock = stockData.reduce((sum, row) => sum + (row.stock || 0), 0);
    const totalValor = stockData.reduce((sum, row) => sum + (row.stock_valorizado || 0), 0);
    const centrosUnicos = new Set(stockData.map((r) => r.centro)).size;
    const almacenesUnicos = new Set(stockData.map((r) => r.almacen)).size;

    return { totalStock, totalValor, centrosUnicos, almacenesUnicos };
  }, [stockData]);

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
              sx={{ fontWeight: 700, color: "text.primary", textTransform: "uppercase", letterSpacing: "0.5px" }}
            >
              {t("stock_individual_titulo", "Stock Individual")}
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

      {/* Search Card */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-end">
          <TextField
            label="Buscar material"
            placeholder="Ingresa código o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />,
            }}
            sx={{ flex: 1, minWidth: 300 }}
            size="small"
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{ textTransform: "none" }}
          >
            Buscar
          </Button>
        </Stack>
      </Paper>

      {/* Material Info and Summary */}
      {selectedMaterial && (
        <>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                Material Encontrado
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                {selectedMaterial.codigo}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selectedMaterial.descripcion}
              </Typography>
            </Box>
          </Paper>

          {/* Summary Cards */}
          {summary && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <SummaryCard
                  label="Stock Total"
                  value={formatNumber(summary.totalStock)}
                  icon={WarehouseIcon}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <SummaryCard label="Valor Total" value={formatCurrency(summary.totalValor)} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <SummaryCard
                  label="Centros"
                  value={summary.centrosUnicos}
                  icon={BusinessIcon}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <SummaryCard label="Almacenes" value={summary.almacenesUnicos} icon={WarehouseIcon} />
              </Grid>
            </Grid>
          )}

          {/* Stock by Location Table */}
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "grey.50",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Existencias por Centro y Almacén ({stockData.length})
              </Typography>
            </Box>

            <SPMAgGrid
              rowData={stockData}
              columnDefs={columnDefs}
              loading={loading}
              height={400}
              pagination={true}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50]}
              enableQuickFilter={true}
              emptyMessage="Sin existencias"
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
            />
          </Paper>
        </>
      )}

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
            Buscando material...
          </Typography>
          <Box sx={{ width: "100%" }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(loadingProgress, 100)}
              sx={{
                height: 8,
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 3,
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
    </Box>
  );
}
