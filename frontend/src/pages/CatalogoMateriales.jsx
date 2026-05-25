/**
 * CatalogoMateriales - Catalogo de materiales SAP
 * Enterprise Design - MUI components
 * Mantiene MUI DataGrid para performance con 28K+ items
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { materiales, equivalencias } from "../services/spm";
import { formatCurrency, formatAlmacen } from "../utils/formatters";
import { useI18n } from "../context/i18n";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  Collapse,
  List,
  ListItem,
  Autocomplete,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ScheduleIcon from "@mui/icons-material/Schedule";
import DescriptionIcon from "@mui/icons-material/Description";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 500;

/* ─────────────────────────────────────────────────────────────
   Collapsible Section
───────────────────────────────────────────────────────────── */
function CollapsibleSection({ title, icon, expanded, onToggle, variant = "default", badge, loading, children }) {
  const getVariantStyles = () => {
    const variants = {
      default: { bg: "grey.100", borderColor: "grey.300" },
      primary: { bg: "primary.50", borderColor: "primary.main" },
      warning: { bg: "warning.50", borderColor: "warning.main" },
      success: { bg: "success.50", borderColor: "success.main" },
      info: { bg: "info.50", borderColor: "info.main" },
    };
    return variants[variant] || variants.default;
  };

  const styles = getVariantStyles();

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderColor: expanded ? "grey.400" : "grey.300",
      }}
    >
      <Box
        component="button"
        onClick={onToggle}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.5,
          textAlign: "left",
          transition: "background-color 0.2s",
          bgcolor: styles.bg,
          border: "none",
          cursor: "pointer",
          "&:hover": { bgcolor: "grey.200" },
        }}
      >
        <Box sx={{ color: "text.secondary" }}>{icon}</Box>
        <Typography variant="body2" fontWeight={600} color="text.primary">
          {title}
        </Typography>
        {badge !== undefined && badge > 0 && (
          <Chip
            label={badge}
            size="small"
            color="primary"
            sx={{ height: 20, fontSize: "0.75rem" }}
          />
        )}
        {loading && (
          <CircularProgress size={16} sx={{ ml: 0.5, color: "text.secondary" }} />
        )}
        <Box sx={{ ml: "auto", color: "text.secondary" }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
}

/* ─────────────────────────────────────────────────────────────
   Detail Modal
───────────────────────────────────────────────────────────── */
function DetailModal({ open, material, detail, loadingDetail, solicitudesData, loadingSolicitudes, equivalenciasData, loadingEquivalencias, onClose, t }) {
  const [expandedSections, setExpandedSections] = useState({
    stock: true,
    mrp: true,
    consumo: true,
    solicitudes: true,
    equivalencias: true,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!open || !material) return null;

  const getStatusColor = (status) => {
    const colors = {
      submitted: "warning",
      approved: "success",
      processing: "info",
      dispatched: "info",
      rejected: "error",
    };
    return colors[status] || "default";
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
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
          py: 2,
          px: 3,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography
            variant="subtitle1"
            fontFamily="monospace"
            fontWeight={700}
            color="primary.main"
          >
            {material.codigo}
          </Typography>
          <Typography variant="body1" color="text.primary">
            {material.descripcion}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loadingDetail ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* Basic Info */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  textTransform="uppercase"
                  letterSpacing={0.5}
                  color="text.secondary"
                  sx={{ mb: 1, display: "block" }}
                >
                  {t("catalogo_desc_larga", "Descripcion larga")}
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {material.descripcion_larga || material.descripcion || "N/D"}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                    {t("catalogo_unidad", "Unidad")}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    {material.unidad || "N/D"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} color="text.secondary">
                    {t("catalogo_precio_usd", "Precio USD")}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    {formatCurrency(material.precio_usd || 0)}
                  </Typography>
                </Box>
              </Paper>
            </Box>

            {/* Stock Section */}
            <CollapsibleSection
              title={t("catalogo_stock", "Stock")}
              icon={<InventoryIcon fontSize="small" />}
              expanded={expandedSections.stock}
              onToggle={() => toggleSection("stock")}
              variant="info"
            >
              <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('cat_stock_total', 'Stock Total')}</Typography>
                  <Typography variant="h5" fontWeight={700} color="text.primary">
                    {detail?.stock_total ?? "N/D"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('cat_pedidos_en_curso', 'Pedidos en Curso')}</Typography>
                  <Typography variant="h5" fontWeight={700} color="text.primary">
                    {detail?.pedidos_en_curso ?? "N/D"}
                  </Typography>
                </Box>
              </Stack>
              {detail?.stock_detalle?.length > 0 && (
                <Box sx={{ maxHeight: 160, overflow: "auto" }}>
                  <List disablePadding>
                    {detail.stock_detalle.map((row, idx) => (
                      <ListItem
                        key={idx}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          py: 0.75,
                          px: 1.5,
                          bgcolor: idx % 2 ? "grey.50" : "background.paper",
                        }}
                      >
                        <Typography variant="body2">{t('common_centro', 'Centro')} {row.centro}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          / {t('common_almacen', 'Almacén')} {formatAlmacen(row.almacen_consultado || row.almacen)}
                        </Typography>
                        {row.lote && <Typography variant="body2" color="text.secondary">/ {t('cat_lote', 'Lote')} {row.lote}</Typography>}
                        <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ ml: "auto" }}>
                          {t('cat_stock', 'Stock')}: {row.stock}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CollapsibleSection>

            {/* MRP Section */}
            <CollapsibleSection
              title={t("catalogo_mrp", "Parametros MRP")}
              icon={<TrendingUpIcon fontSize="small" />}
              expanded={expandedSections.mrp}
              onToggle={() => toggleSection("mrp")}
              variant="warning"
              badge={detail?.mrp_list?.length}
            >
              {detail?.mrp_list?.length > 0 ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                  {detail.mrp_list.map((mrp, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{t('common_centro', 'Centro')}: {mrp.centro}</Typography>
                        <Typography variant="body2" color="text.secondary">| {t('common_almacen', 'Almacén')}: {mrp.almacen}</Typography>
                        {mrp.sector && (
                          <Chip label={mrp.sector} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                        )}
                      </Stack>
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, textAlign: "center" }}>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>Stock Seg.</Typography>
                          <Typography variant="body2" fontWeight={600}>{mrp.stock_seguridad ?? 0}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>Pto. Pedido</Typography>
                          <Typography variant="body2" fontWeight={600}>{mrp.punto_pedido ?? 0}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>Stock Max.</Typography>
                          <Typography variant="body2" fontWeight={600}>{mrp.stock_maximo ?? 0}</Typography>
                        </Paper>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_mrp", "Este material no esta planificado en MRP")}
                </Typography>
              )}
            </CollapsibleSection>

            {/* Consumo Section */}
            <CollapsibleSection
              title={t("catalogo_consumo", "Consumo Historico")}
              icon={<ScheduleIcon fontSize="small" />}
              expanded={expandedSections.consumo}
              onToggle={() => toggleSection("consumo")}
              variant="success"
              badge={detail?.consumo_list?.length}
            >
              {detail?.consumo_list?.length > 0 ? (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                  {detail.consumo_list.map((c, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{t('common_centro', 'Centro')}: {c.centro}</Typography>
                        <Typography variant="body2" color="text.secondary">| {t('common_almacen', 'Almacén')}: {c.almacen}</Typography>
                      </Stack>
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, textAlign: "center" }}>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>Prom. Anual</Typography>
                          <Typography variant="body2" fontWeight={600} color="success.main">{c.promedio_anual}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>Total</Typography>
                          <Typography variant="body2" fontWeight={600}>{c.total}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>Anos</Typography>
                          <Typography variant="body2" fontWeight={600}>{c.anio_desde}-{c.anio_hasta}</Typography>
                        </Paper>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_consumo", "No hay consumo historico registrado")}
                </Typography>
              )}
            </CollapsibleSection>

            {/* Solicitudes Section */}
            <CollapsibleSection
              title={t("catalogo_solicitudes_spm", "Solicitudes SPM Activas")}
              icon={<DescriptionIcon fontSize="small" />}
              expanded={expandedSections.solicitudes}
              onToggle={() => toggleSection("solicitudes")}
              variant="primary"
              badge={solicitudesData.length}
              loading={loadingSolicitudes}
            >
              {solicitudesData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_solicitudes", "No hay solicitudes SPM activas para este material")}
                </Typography>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                  {solicitudesData.map((sol) => (
                    <Paper key={sol.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          SPM #{sol.id}
                        </Typography>
                        <Chip
                          label={sol.estado}
                          size="small"
                          color={getStatusColor(sol.estado)}
                          sx={{ height: 20, fontSize: "0.7rem" }}
                        />
                      </Stack>
                      <Typography variant="caption" display="block" color="text.secondary">Solicitante: {sol.solicitante}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">Cantidad: {sol.cantidad_solicitada}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Fecha: {new Date(sol.fecha).toLocaleDateString()}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </CollapsibleSection>

            {/* Equivalencias Section */}
            <CollapsibleSection
              title={t("catalogo_equivalencias", "Materiales Equivalentes")}
              icon={<SwapHorizIcon fontSize="small" />}
              expanded={expandedSections.equivalencias}
              onToggle={() => toggleSection("equivalencias")}
              badge={equivalenciasData.length}
              loading={loadingEquivalencias}
            >
              {equivalenciasData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_equivalencias", "No hay materiales equivalentes registrados")}
                </Typography>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                  {equivalenciasData.map((eq, idx) => (
                    <Paper key={eq.codigo_equivalente || idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="primary.main">
                          {eq.codigo_equivalente}
                        </Typography>
                        {eq.tipo_equivalencia && (
                          <Chip label={eq.tipo_equivalencia} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.primary">{eq.descripcion_equivalente}</Typography>
                      {eq.criterio && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                          Criterio: {eq.criterio}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}
            </CollapsibleSection>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function CatalogoMateriales() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // Search state
  const [searchCodigo, setSearchCodigo] = useState("");
  const [searchDesc, setSearchDesc] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchGrupo, setSearchGrupo] = useState("");
  const [gruposOptions, setGruposOptions] = useState([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  const debouncedCodigo = useDebouncedValue(searchCodigo, DEBOUNCE_MS);
  const debouncedDesc = useDebouncedValue(searchDesc, DEBOUNCE_MS);
  const debouncedKeyword = useDebouncedValue(searchKeyword, DEBOUNCE_MS);
  const debouncedGrupo = useDebouncedValue(searchGrupo, DEBOUNCE_MS);

  // Results state
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Detail state
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [solicitudesData, setSolicitudesData] = useState([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [equivalenciasData, setEquivalenciasData] = useState([]);
  const [loadingEquivalencias, setLoadingEquivalencias] = useState(false);

  // Load grupos options
  useEffect(() => {
    setLoadingGrupos(true);
    materiales
      .grupos(debouncedGrupo, 100)
      .then((res) => setGruposOptions(res.data?.data || []))
      .catch(() => setGruposOptions([]))
      .finally(() => setLoadingGrupos(false));
  }, [debouncedGrupo]);

  // Search materials
  useEffect(() => {
    const shouldSearch = debouncedCodigo.trim() !== "" || debouncedDesc.trim() !== "" || debouncedKeyword.trim() !== "" || searchGrupo !== "";
    if (!shouldSearch) {
      if (hasSearched) {
        setResults([]);
        setHasSearched(false);
      }
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);

    const searchTerms = [debouncedDesc.trim(), debouncedKeyword.trim()].filter(Boolean).join(" ");

    materiales
      .buscar({ codigo: debouncedCodigo.trim(), descripcion: searchTerms, grupo: searchGrupo || "", limit: MAX_RESULTS })
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setResults(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || err.message);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [debouncedCodigo, debouncedDesc, debouncedKeyword, searchGrupo, hasSearched]);

  // Load material detail
  const loadDetail = useCallback(async (mat) => {
    setSelectedMaterial(mat);
    setShowDetailModal(true);
    setLoadingDetail(true);
    setDetail(null);
    setSolicitudesData([]);
    setEquivalenciasData([]);

    try {
      const res = await materiales.detalle(mat.codigo);
      setDetail(res.data || {});
    } catch (err) {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }

    setLoadingSolicitudes(true);
    try {
      const res = await materiales.solicitudes(mat.codigo);
      setSolicitudesData(res.data?.solicitudes || []);
    } catch (err) {
      setSolicitudesData([]);
    } finally {
      setLoadingSolicitudes(false);
    }

    setLoadingEquivalencias(true);
    try {
      const res = await equivalencias.porMaterial(mat.codigo);
      setEquivalenciasData(res.data?.equivalencias || []);
    } catch (err) {
      setEquivalenciasData([]);
    } finally {
      setLoadingEquivalencias(false);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchCodigo("");
    setSearchDesc("");
    setSearchKeyword("");
    setSearchGrupo("");
    setResults([]);
    setHasSearched(false);
    setSelectedMaterial(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedMaterial(null);
    setDetail(null);
  }, []);

  // AG Grid column definitions
  const columnDefs = useMemo(
    () => [
      {
        field: "codigo",
        headerName: t('common_codigo', 'Código'),
        flex: 0.6,
        minWidth: 120,
        cellStyle: { textAlign: 'center' },
        headerClass: 'ag-center-aligned-header',
        cellRenderer: (params) => (
          <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="primary.main">
            {params.value}
          </Typography>
        ),
      },
      {
        field: "descripcion",
        headerName: t('common_descripcion', 'Descripción'),
        flex: 1.5,
        minWidth: 250,
        cellRenderer: (params) => (
          <Box>
            <Typography variant="body2" sx={{ lineHeight: 1.3 }}>{params.value}</Typography>
            {params.data.descripcion_larga && params.data.descripcion_larga !== params.value && (
              <Typography variant="caption" color="text.secondary">
                {params.data.descripcion_larga.substring(0, 60)}...
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: "unidad_medida",
        headerName: t('common_unidad', 'Unidad'),
        flex: 0.4,
        minWidth: 80,
        cellStyle: { textAlign: 'center' },
        headerClass: 'ag-center-aligned-header',
        valueGetter: (params) => params.data.unidad_medida || params.data.unidad || "-",
      },
      {
        field: "precio_usd",
        headerName: t('common_precio_usd', 'Precio USD'),
        flex: 0.5,
        minWidth: 100,
        cellStyle: { textAlign: 'right' },
        headerClass: 'ag-right-aligned-header',
        cellRenderer: (params) => (
          <Typography variant="body2" fontFamily="monospace">{formatCurrency(params.value || 0)}</Typography>
        ),
      },
      {
        field: "acciones",
        headerName: t('common_acciones', 'Acciones'),
        flex: 0.5,
        minWidth: 120,
        cellStyle: { textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' },
        headerClass: 'ag-center-aligned-header',
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Button
            variant="outlined"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              loadDetail(params.data);
            }}
            sx={{ textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 600 }}
          >
            {t('common_detalle', 'Ver Detalle')}
          </Button>
        ),
      },
    ],
    [loadDetail, t]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box sx={{ maxWidth: 1600, mx: "auto", px: 3, py: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: "text.secondary" }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t("catalogo_materiales_titulo", "Catálogo de Materiales")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("catalogo_materiales_subtitulo", "Busca y consulta informacion de materiales SAP")}
            </Typography>
          </Box>
        </Stack>

        {/* Search Card */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
            <Box sx={{ minWidth: 150 }}>
              <Typography
                variant="caption"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_codigo_sap", "Codigo SAP")}
              </Typography>
              <TextField
                size="small"
                value={searchCodigo}
                onChange={(e) => setSearchCodigo(e.target.value)}
                placeholder={t('materials_catalogo_codigo_example', 'Ej: 100012345')}
                fullWidth
                InputProps={{
                  sx: { fontFamily: "monospace" }
                }}
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography
                variant="caption"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_descripcion", "Descripcion")}
              </Typography>
              <TextField
                size="small"
                value={searchDesc}
                onChange={(e) => setSearchDesc(e.target.value)}
                placeholder={t("catalogo_buscar_desc", "Buscar por descripcion...")}
                fullWidth
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography
                variant="caption"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_palabra_clave", "Palabra clave")}
              </Typography>
              <TextField
                size="small"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder={t("catalogo_buscar_keyword", "Filtro adicional...")}
                fullWidth
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography
                variant="caption"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing={0.5}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_grupo_articulos", "Grupo de Articulos")}
              </Typography>
              <Autocomplete
                freeSolo
                size="small"
                options={gruposOptions}
                value={searchGrupo}
                onInputChange={(event, newValue) => setSearchGrupo(newValue)}
                loading={loadingGrupos}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("catalogo_buscar_grupo", "Buscar grupo...")}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingGrupos ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>

            <Stack direction="row" alignItems="center" spacing={1} sx={{ height: 40 }}>
              {loading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    {t("common_buscando", "Buscando...")}
                  </Typography>
                </Stack>
              ) : hasSearched ? (
                <>
                  <Chip
                    label={`${results.length} ${t("common_resultados", "resultados")}`}
                    color={results.length > 0 ? "primary" : "default"}
                    variant={results.length > 0 ? "filled" : "outlined"}
                    size="small"
                  />
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ fontWeight: 600 }}
                  >
                    {t("common_limpiar", "Limpiar")}
                  </Button>
                </>
              ) : (searchCodigo || searchDesc || searchKeyword || searchGrupo) ? (
                <IconButton onClick={handleClearSearch} size="small" color="error">
                  <CloseIcon />
                </IconButton>
              ) : null}
            </Stack>
          </Box>
        </Paper>

        {/* Error */}
        {error && (
          <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Results */}
        <Paper
          variant="outlined"
          sx={{
            height: "calc(100vh - 280px)",
            minHeight: 500,
          }}
        >
          {!hasSearched ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "text.secondary" }}>
              <SearchIcon sx={{ fontSize: 40, color: "grey.400" }} />
              <Typography variant="body2" sx={{ mt: 2 }}>
                {t("catalogo_instruccion", "Ingresa un codigo SAP, descripcion o palabra clave para buscar materiales")}
              </Typography>
            </Stack>
          ) : results.length === 0 && !loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", color: "text.secondary" }}>
              <Inventory2Icon sx={{ fontSize: 40, color: "grey.400" }} />
              <Typography variant="body2" sx={{ mt: 2 }}>
                {t("catalogo_sin_resultados", "No se encontraron materiales con los criterios de busqueda")}
              </Typography>
            </Stack>
          ) : (
            <SPMAgGrid
              rowData={results}
              columnDefs={columnDefs}
              loading={loading}
              height="100%"
              pagination={true}
              paginationPageSize={100}
              paginationPageSizeSelector={[25, 50, 100]}
              enableQuickFilter={true}
              onRowClick={(data) => loadDetail(data)}
              exportFileName="catalogo_materiales"
              emptyMessage={t("catalogo_sin_resultados", "No se encontraron materiales")}
              gridOptions={{
                getRowId: (params) => params.data.codigo,
                rowHeight: 67,
              }}
            />
          )}
        </Paper>

        {/* Detail Modal */}
        <DetailModal
          open={showDetailModal}
          material={selectedMaterial}
          detail={detail}
          loadingDetail={loadingDetail}
          solicitudesData={solicitudesData}
          loadingSolicitudes={loadingSolicitudes}
          equivalenciasData={equivalenciasData}
          loadingEquivalencias={loadingEquivalencias}
          onClose={handleCloseModal}
          t={t}
        />
      </Box>
    </Box>
  );
}
