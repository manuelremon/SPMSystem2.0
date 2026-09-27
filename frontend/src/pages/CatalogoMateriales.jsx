/**
 * CatalogoMateriales - Catalogo de materiales SAP
 * Tabla del catalogo + buscador conversacional (columna derecha en lg+, Drawer en <lg).
 * El detalle de cada material muestra y permite gestionar sus equivalencias.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { materiales, equivalencias } from "../services/spm";
import { formatCurrency, formatAlmacen, formatDate, formatNumber } from "../utils/formatters";
import { useI18n } from "../context/i18n";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useUserRoles } from "../hooks/useUserRoles";
import BuscadorMaterialesPanel from "../components/equivalencias/BuscadorMaterialesPanel";
import EquivalenciaFormModal from "../components/equivalencias/EquivalenciaFormModal";
import EquivalenciaDeleteModal from "../components/equivalencias/EquivalenciaDeleteModal";
import { TIPO_CONFIG } from "../components/equivalencias/EquivalenciasResultado";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
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
  Alert,
  Tooltip,
  Drawer,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InventoryIcon from "@mui/icons-material/Inventory";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ScheduleIcon from "@mui/icons-material/Schedule";
import DescriptionIcon from "@mui/icons-material/Description";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 500;
const PANEL_PREF_KEY = "spm_equiv_buscador_visible";
const ORDEN_TIPOS = ["E0_DUPLICADO", "E1_ESTRICTA", "E2_SUPLIBLE"];

/** Agrupa las equivalencias del material por tipo (orden: duplicado, estricta, suplible, otros). */
function agruparPorTipo(lista) {
  const grupos = new Map();
  for (const eq of lista) {
    const tipo = eq.tipo_equivalencia || "SIN_TIPO";
    if (!grupos.has(tipo)) grupos.set(tipo, []);
    grupos.get(tipo).push(eq);
  }
  const rango = (tipo) => (ORDEN_TIPOS.includes(tipo) ? ORDEN_TIPOS.indexOf(tipo) : ORDEN_TIPOS.length);
  return [...grupos.entries()].sort(([a], [b]) => rango(a) - rango(b));
}

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
function DetailModal({
  open,
  material,
  detail,
  loadingDetail,
  solicitudesData,
  loadingSolicitudes,
  equivalenciasData,
  loadingEquivalencias,
  canManage,
  avisoEquiv,
  onCerrarAviso,
  onNuevaEquivalencia,
  onEditarEquivalencia,
  onBorrarEquivalencia,
  onClose,
  t,
}) {
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
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flexWrap: "wrap" }}>
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
        <IconButton onClick={onClose} size="small" aria-label={t("common_cerrar", "Cerrar")} sx={{ color: "text.secondary" }}>
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
                  {t("catalogo_desc_larga", "Descripción larga")}
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
                  <Typography variant="caption" color="text.secondary">{t('cat_stock_total', 'Stock total')}</Typography>
                  <Typography variant="h5" fontWeight={700} color="text.primary">
                    {detail?.stock_total != null ? formatNumber(detail.stock_total) : "N/D"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('cat_pedidos_en_curso', 'Pedidos en curso')}</Typography>
                  <Typography variant="h5" fontWeight={700} color="text.primary">
                    {detail?.pedidos_en_curso != null ? formatNumber(detail.pedidos_en_curso) : "N/D"}
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
                          {t('cat_stock', 'Stock')}: {formatNumber(row.stock)}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CollapsibleSection>

            {/* MRP Section */}
            <CollapsibleSection
              title={t("catalogo_mrp", "Parámetros MRP")}
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
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>{t("catalogo_stock_seg", "Stock seg.")}</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatNumber(mrp.stock_seguridad ?? 0)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>{t("catalogo_pto_pedido", "Pto. de pedido")}</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatNumber(mrp.punto_pedido ?? 0)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>{t("catalogo_stock_max", "Stock máx.")}</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatNumber(mrp.stock_maximo ?? 0)}</Typography>
                        </Paper>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_mrp", "Este material no está planificado en MRP")}
                </Typography>
              )}
            </CollapsibleSection>

            {/* Consumo Section */}
            <CollapsibleSection
              title={t("catalogo_consumo", "Consumo histórico")}
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
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>{t("catalogo_prom_anual", "Prom. anual")}</Typography>
                          <Typography variant="body2" fontWeight={600} color="success.main">{formatNumber(c.promedio_anual)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>{t("common_total", "Total")}</Typography>
                          <Typography variant="body2" fontWeight={600}>{formatNumber(c.total)}</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, bgcolor: "grey.50" }} elevation={0}>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: "0.625rem" }}>{t("catalogo_anios", "Años")}</Typography>
                          <Typography variant="body2" fontWeight={600}>{c.anio_desde}-{c.anio_hasta}</Typography>
                        </Paper>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_consumo", "No hay consumo histórico registrado")}
                </Typography>
              )}
            </CollapsibleSection>

            {/* Solicitudes Section */}
            <CollapsibleSection
              title={t("catalogo_solicitudes_spm", "Solicitudes SPM activas")}
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
                        <StatusBadge estado={sol.estado} />
                      </Stack>
                      <Typography variant="caption" display="block" color="text.secondary">{t("catalogo_solicitante", "Solicitante")}: {sol.solicitante}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">{t("common_cantidad", "Cantidad")}: {formatNumber(sol.cantidad_solicitada)}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {t("common_fecha", "Fecha")}: {formatDate(sol.fecha)}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </CollapsibleSection>

            {/* Equivalencias Section */}
            <CollapsibleSection
              title={t("catalogo_equivalencias", "Materiales equivalentes")}
              icon={<SwapHorizIcon fontSize="small" />}
              expanded={expandedSections.equivalencias}
              onToggle={() => toggleSection("equivalencias")}
              badge={equivalenciasData.length}
              loading={loadingEquivalencias}
            >
              {avisoEquiv && (
                <Alert severity="success" onClose={onCerrarAviso} sx={{ mb: 1.5 }}>
                  {avisoEquiv}
                </Alert>
              )}
              {canManage && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
                  <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onNuevaEquivalencia} sx={{ textTransform: "none" }}>
                    {t("equiv_nueva", "Nueva equivalencia")}
                  </Button>
                </Box>
              )}
              {equivalenciasData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("catalogo_sin_equivalencias", "No hay materiales equivalentes registrados")}
                </Typography>
              ) : (
                <Stack spacing={2} data-testid="catalogo-equivalencias">
                  {agruparPorTipo(equivalenciasData).map(([tipo, items]) => {
                    const cfg = TIPO_CONFIG[tipo] || { labelKey: tipo, fallback: tipo, color: "default" };
                    return (
                      <Box key={tipo}>
                        <Chip size="small" color={cfg.color} label={`${t(cfg.labelKey, cfg.fallback)} (${items.length})`} sx={{ fontWeight: 600, mb: 1 }} />
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                          {items.map((eq, idx) => (
                            <Paper key={eq.id ?? `${eq.codigo_equivalente}-${idx}`} variant="outlined" sx={{ p: 1.5, display: "flex", gap: 1 }}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="primary.main">
                                  {eq.codigo_equivalente}
                                </Typography>
                                <Typography variant="body2" color="text.primary">{eq.descripcion_equivalente}</Typography>
                                {(eq.criterio || eq.motivo) && (
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                    {[eq.criterio && `${t("catalogo_criterio", "Criterio")}: ${eq.criterio}`, eq.motivo].filter(Boolean).join(" · ")}
                                  </Typography>
                                )}
                              </Box>
                              {canManage && eq.id != null && (
                                <Stack direction="row" spacing={0.5} alignItems="flex-start">
                                  <Tooltip title={t("common_editar", "Editar")}>
                                    <IconButton size="small" aria-label={t("common_editar", "Editar")} onClick={() => onEditarEquivalencia(eq)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={t("common_eliminar", "Eliminar")}>
                                    <IconButton size="small" color="error" aria-label={t("common_eliminar", "Eliminar")} onClick={() => onBorrarEquivalencia(eq)}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              )}
                            </Paper>
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
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
  const { isAdmin, isPlanner } = useUserRoles();
  const canManage = isAdmin || isPlanner;

  // Buscador conversacional: columna derecha en escritorio, Drawer en tablet/movil
  const theme = useTheme();
  const esEscritorio = useMediaQuery(theme.breakpoints.up("lg"));
  const [panelVisible, setPanelVisible] = useState(() => {
    try {
      return localStorage.getItem(PANEL_PREF_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  const alternarPanel = useCallback(() => {
    if (!esEscritorio) {
      setDrawerAbierto(true);
      return;
    }
    setPanelVisible((visible) => {
      try {
        localStorage.setItem(PANEL_PREF_KEY, visible ? "0" : "1");
      } catch {
        // preferencia no persistida: no es critico
      }
      return !visible;
    });
  }, [esEscritorio]);

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
  const [avisoEquiv, setAvisoEquiv] = useState("");
  const [formEquiv, setFormEquiv] = useState({ open: false, item: null });
  const [borrarEquiv, setBorrarEquiv] = useState({ open: false, item: null });

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
      .catch(() => {
        // Mensaje amigable: no se exponen errores internos
        setError(t("catalogo_error_busqueda", "No pudimos completar la búsqueda. Intenta nuevamente en unos minutos."));
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [debouncedCodigo, debouncedDesc, debouncedKeyword, searchGrupo, hasSearched, t]);

  const cargarEquivalencias = useCallback(async (codigo) => {
    setLoadingEquivalencias(true);
    try {
      const res = await equivalencias.porMaterial(codigo);
      setEquivalenciasData(res.data?.equivalencias || []);
    } catch {
      setEquivalenciasData([]);
    } finally {
      setLoadingEquivalencias(false);
    }
  }, []);

  // Load material detail
  const loadDetail = useCallback(async (mat) => {
    setSelectedMaterial(mat);
    setShowDetailModal(true);
    setLoadingDetail(true);
    setDetail(null);
    setSolicitudesData([]);
    setEquivalenciasData([]);
    setAvisoEquiv("");

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

    await cargarEquivalencias(mat.codigo);
  }, [cargarEquivalencias]);

  // "Filtrar tabla" del buscador: busca el codigo en el catalogo
  const filtrarTabla = useCallback((codigo) => {
    setSearchCodigo(codigo);
    setSearchDesc("");
    setSearchKeyword("");
    setSearchGrupo("");
    setDrawerAbierto(false);
  }, []);

  const abrirNuevaEquivalencia = useCallback(() => {
    setAvisoEquiv("");
    setFormEquiv({ open: true, item: null });
  }, []);

  // porMaterial devuelve el sentido real de la fila (codigo_original -> codigo_destino)
  const abrirEditarEquivalencia = useCallback((eq) => {
    setAvisoEquiv("");
    setFormEquiv({
      open: true,
      item: {
        id: eq.id,
        codigo_original: eq.codigo_original,
        codigo_equivalente: eq.codigo_destino,
        tipo_equivalencia: eq.tipo_equivalencia,
        criterio: eq.criterio,
        motivo: eq.motivo,
      },
    });
  }, []);

  const abrirBorrarEquivalencia = useCallback(
    (eq) => {
      setAvisoEquiv("");
      setBorrarEquiv({
        open: true,
        item: { id: eq.id, codigo_original: selectedMaterial?.codigo, codigo_equivalente: eq.codigo_equivalente },
      });
    },
    [selectedMaterial]
  );

  const trasGuardarEquivalencia = useCallback(
    (mensaje) => {
      setFormEquiv({ open: false, item: null });
      setBorrarEquiv({ open: false, item: null });
      setAvisoEquiv(mensaje);
      if (selectedMaterial) cargarEquivalencias(selectedMaterial.codigo);
    },
    [selectedMaterial, cargarEquivalencias]
  );

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
          <Typography variant="body2">{formatCurrency(params.value || 0)}</Typography>
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
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {t('common_ver_detalle', 'Ver detalle')}
          </Button>
        ),
      },
    ],
    [loadDetail, t]
  );

  return (
    <PageLayout
      title={t("catalogo_materiales_titulo", "Catálogo de materiales")}
      subtitle={t("catalogo_materiales_subtitulo", "Busca materiales SAP, consulta su detalle y gestiona sus equivalencias")}
      actions={
        <Button variant="outlined" size="small" startIcon={<ForumOutlinedIcon />} onClick={alternarPanel} sx={{ textTransform: "none" }}>
          {esEscritorio
            ? panelVisible
              ? t("equiv_bot_ocultar", "Ocultar buscador")
              : t("equiv_bot_mostrar", "Mostrar buscador")
            : t("equiv_bot_boton", "Buscador")}
        </Button>
      }
    >
      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Search Card */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
            <Box sx={{ minWidth: 150, flex: { xs: 1, md: "0 0 auto" } }}>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_codigo_sap", "Código SAP")}
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

            <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_descripcion", "Descripción")}
              </Typography>
              <TextField
                size="small"
                value={searchDesc}
                onChange={(e) => setSearchDesc(e.target.value)}
                placeholder={t("catalogo_buscar_desc", "Buscar por descripción...")}
                fullWidth
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}>
              <Typography
                variant="caption"
                fontWeight={600}
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

            <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}>
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{ mb: 0.75, display: "block" }}
              >
                {t("catalogo_grupo_articulos", "Grupo de artículos")}
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
                    label={`${formatNumber(results.length)} ${t("common_resultados", "resultados")}`}
                    color={results.length > 0 ? "primary" : "default"}
                    variant={results.length > 0 ? "filled" : "outlined"}
                    size="small"
                  />
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ fontWeight: 600, textTransform: "none" }}
                  >
                    {t("common_limpiar", "Limpiar")}
                  </Button>
                </>
              ) : (searchCodigo || searchDesc || searchKeyword || searchGrupo) ? (
                <IconButton onClick={handleClearSearch} size="small" color="error" aria-label={t("common_limpiar", "Limpiar")}>
                  <CloseIcon />
                </IconButton>
              ) : null}
            </Stack>
          </Box>
        </Paper>

        {/* Results */}
        <Paper
          variant="outlined"
          sx={{
            height: { xs: 560, md: "calc(100vh - 300px)" },
            minHeight: 500,
          }}
        >
          {error ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
              <EmptyState
                icon={<ErrorOutlineIcon sx={{ fontSize: 32, color: "error.main" }} />}
                title={t("catalogo_error_titulo", "No pudimos cargar los materiales")}
                description={error}
              />
            </Stack>
          ) : !hasSearched ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
              <EmptyState
                icon={<SearchIcon sx={{ fontSize: 32, color: "var(--fg-muted)" }} />}
                title={t("catalogo_instruccion", "Ingresa un código SAP, descripción o palabra clave para buscar materiales")}
              />
            </Stack>
          ) : results.length === 0 && !loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
              <EmptyState
                icon={<Inventory2Icon sx={{ fontSize: 32, color: "var(--fg-muted)" }} />}
                title={t("catalogo_sin_resultados", "No se encontraron materiales con los criterios de búsqueda")}
              />
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
        </Box>
        {esEscritorio && (
          <Box
            sx={{
              display: panelVisible ? "block" : "none",
              width: 380,
              flexShrink: 0,
              position: "sticky",
              top: 16,
              height: "calc(100vh - 160px)",
              minHeight: 480,
            }}
          >
            <BuscadorMaterialesPanel onFiltrarTabla={filtrarTabla} />
          </Box>
        )}
      </Box>

      {!esEscritorio && (
        <Drawer anchor="right" open={drawerAbierto} onClose={() => setDrawerAbierto(false)} keepMounted>
          <Box sx={{ width: { xs: "100vw", md: 420 }, height: "100%" }}>
            <BuscadorMaterialesPanel onFiltrarTabla={filtrarTabla} onCerrar={() => setDrawerAbierto(false)} />
          </Box>
        </Drawer>
      )}

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
          canManage={canManage}
          avisoEquiv={avisoEquiv}
          onCerrarAviso={() => setAvisoEquiv("")}
          onNuevaEquivalencia={abrirNuevaEquivalencia}
          onEditarEquivalencia={abrirEditarEquivalencia}
          onBorrarEquivalencia={abrirBorrarEquivalencia}
          onClose={handleCloseModal}
          t={t}
        />

        {canManage && (
          <>
            <EquivalenciaFormModal
              open={formEquiv.open}
              item={formEquiv.item}
              material={selectedMaterial}
              onClose={() => setFormEquiv({ open: false, item: null })}
              onSaved={trasGuardarEquivalencia}
            />
            <EquivalenciaDeleteModal
              open={borrarEquiv.open}
              item={borrarEquiv.item}
              onClose={() => setBorrarEquiv({ open: false, item: null })}
              onDeleted={trasGuardarEquivalencia}
            />
          </>
        )}
    </PageLayout>
  );
}
