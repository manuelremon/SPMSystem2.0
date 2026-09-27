import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import { TempDataBanner } from "../components/ui/TempDataBanner";
import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import { formatDate, formatNumber } from "../utils/formatters";
// MUI Components
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Slider from "@mui/material/Slider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import OutlinedInput from "@mui/material/OutlinedInput";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
// MUI Icons
import WarningIcon from "@mui/icons-material/Warning";
import InventoryIcon from "@mui/icons-material/Inventory";
import SpeedIcon from "@mui/icons-material/Speed";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PieChartIcon from "@mui/icons-material/PieChart";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";

// Colores del sistema SPM (usando CSS variables)
const COLORS = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--danger)",
  info: "var(--info)",
};

// Icon mapping for KPIs
const kpiIcons = {
  materiales_en_riesgo: WarningIcon,
  materiales_sobrestock: InventoryIcon,
  rotacion_promedio: SpeedIcon,
  lead_time_promedio: AccessTimeIcon,
  cumplimiento_mrp: CheckCircleIcon,
  pedidos_vencidos: ErrorIcon,
  pct_pedidos_vencidos: ErrorIcon,
  velocidad_respuesta: SpeedIcon,
};

const kpiColors = {
  materiales_en_riesgo: COLORS.error,
  materiales_sobrestock: COLORS.warning,
  rotacion_promedio: COLORS.info,
  lead_time_promedio: COLORS.primary,
  cumplimiento_mrp: COLORS.success,
  pedidos_vencidos: COLORS.error,
  pct_pedidos_vencidos: COLORS.error,
  velocidad_respuesta: COLORS.info,
};

// Etiquetas legibles de cada KPI (claves del backend)
const KPI_LABELS = {
  materiales_en_riesgo: ["mrp_kpi_materiales_en_riesgo", "Materiales en riesgo"],
  materiales_sobrestock: ["mrp_kpi_materiales_sobrestock", "Materiales en sobrestock"],
  rotacion_promedio: ["mrp_kpi_rotacion_promedio", "Rotación promedio"],
  lead_time_promedio: ["mrp_kpi_lead_time_promedio", "Lead time promedio"],
  cumplimiento_mrp: ["mrp_kpi_cumplimiento_mrp", "Cumplimiento MRP"],
  pedidos_vencidos: ["mrp_kpi_pedidos_vencidos", "Pedidos vencidos"],
  pct_pedidos_vencidos: ["mrp_kpi_pct_pedidos_vencidos", "% de pedidos vencidos"],
  velocidad_respuesta: ["mrp_kpi_velocidad_respuesta", "Velocidad de respuesta"],
};

// KPIs donde un valor mas alto es mejor (el resto: mas bajo es mejor)
const HIGHER_IS_BETTER = new Set(["cumplimiento_mrp", "rotacion_promedio"]);

/** Formatea con coma decimal (max. 1 decimal) */
function formatKpiValue(valor) {
  if (valor == null || valor === "") return "-";
  const num = Number(valor);
  if (!Number.isFinite(num)) return String(valor);
  return formatNumber(Math.round(num * 10) / 10);
}

/** Color semantico para porcentajes donde mas alto es mejor */
function colorCumplimiento(pct) {
  if (pct >= 80) return COLORS.success;
  if (pct >= 50) return COLORS.warning;
  return COLORS.error;
}

// KPI Card component
function KPICard({ titulo, valor, unidad, tendencia, objetivo, descripcion, icon: Icon, color = COLORS.primary, higherIsBetter = false }) {
  const { t } = useI18n();
  // Una tendencia es "buena" si va en la direccion deseada del indicador
  const isGood = tendencia === "up" ? higherIsBetter : tendencia === "down" ? !higherIsBetter : null;
  const trendColor = isGood === null ? "var(--fg-muted)" : isGood ? COLORS.success : COLORS.error;
  const trendBg = isGood === null
    ? "var(--bg-soft)"
    : `color-mix(in srgb, ${isGood ? "var(--success)" : "var(--danger)"} 15%, transparent)`;

  const TrendIcon = tendencia === "up" ? TrendingUpIcon : tendencia === "down" ? TrendingDownIcon : TrendingFlatIcon;
  const trendLabel = tendencia === "up"
    ? t("mrp_tendencia_up", "Subiendo")
    : tendencia === "down"
      ? t("mrp_tendencia_down", "Bajando")
      : t("mrp_tendencia_stable", "Estable");

  const numValor = Number(valor);
  const numObjetivo = Number(objetivo);
  const cumpleObjetivo = higherIsBetter ? numValor >= numObjetivo : numValor <= numObjetivo;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: "1px solid var(--border)",
        height: "100%",
        minHeight: 168,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon sx={{ fontSize: 20, color }} />
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            backgroundColor: trendBg,
          }}
        >
          <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
          <Typography variant="caption" sx={{ fontWeight: 500, fontSize: "0.7rem", color: trendColor }}>
            {trendLabel}
          </Typography>
        </Box>
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--fg-muted)" }}>
        {titulo}
      </Typography>
      <Box sx={{ mb: 0.5 }}>
        <Typography variant="h5" component="span" sx={{ fontWeight: 700, color: "var(--fg-strong)" }}>
          {formatKpiValue(valor)}
        </Typography>
        {unidad && (
          <Typography variant="body2" component="span" sx={{ color: "var(--fg-muted)", ml: 0.5 }}>
            {unidad}
          </Typography>
        )}
      </Box>
      {descripcion && (
        <Typography variant="caption" sx={{ color: "var(--fg-subtle)", flex: 1 }}>
          {descripcion}
        </Typography>
      )}

      {objetivo != null && objetivo !== "" && (
        <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px solid var(--border)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "var(--fg-subtle)" }}>
              {t("mrp_objetivo", "Objetivo:")}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: cumpleObjetivo ? COLORS.success : COLORS.error,
              }}
            >
              {formatKpiValue(objetivo)} {unidad}
            </Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

// Donut Chart component
function DonutChart({ data = [], t }) {
  const total = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, item) => sum + (item.valor || 0), 0);
  }, [data]);

  let currentAngle = 0;

  const createArc = (startAngle, endAngle) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    const radius = 70;
    const cx = 90;
    const cy = 90;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  if (!data || data.length === 0) {
    return (
      <Typography color="text.secondary" textAlign="center" py={4}>
        {t("common_sin_datos", "Sin datos")}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
      <svg viewBox="0 0 180 180" width={160} height={160}>
        {data.map((item, idx) => {
          const angle = total > 0 ? (item.valor / total) * 360 : 0;
          const path = createArc(currentAngle, currentAngle + angle);
          currentAngle += angle;
          return (
            <path key={idx} d={path} fill={item.color} style={{ transition: "all 0.3s ease" }} />
          );
        })}
        <circle cx="90" cy="90" r="45" fill="var(--surface)" />
        <text x="90" y="85" textAnchor="middle" fontSize="11" fill="var(--fg-muted)">
          {t("mrp_total", "Total")}
        </text>
        <text x="90" y="105" textAnchor="middle" fontSize="18" fontWeight="bold" fill="var(--fg-strong)">
          {formatNumber(Math.round(total))}%
        </text>
      </svg>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {data.map((item, idx) => (
          <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
              {item.nombre}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
              {formatKpiValue(item.valor || 0)}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// Bar Chart component
function SimpleBarChart({ data = [], height = 160 }) {
  const { t } = useI18n();
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => Math.max(d.alertas || 0, d.resueltas || 0)), 1);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Typography color="text.secondary" textAlign="center" py={4}>
        {t("common_sin_datos", "Sin datos")}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.5, justifyContent: "space-between", height }}>
      {data.map((item, idx) => (
        <Box key={idx} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-end", height: "100%" }}>
            <Tooltip title={`${t("mrp_alertas_generadas_tooltip", "Alertas generadas")}: ${formatNumber(item.alertas || 0)}`}>
              <Box
                sx={{
                  width: 14,
                  backgroundColor: COLORS.error,
                  borderRadius: "3px 3px 0 0",
                  transition: "all 0.5s ease",
                  height: `${((item.alertas || 0) / maxValue) * 100}%`,
                  minHeight: 3,
                }}
              />
            </Tooltip>
            <Tooltip title={`${t("mrp_alertas_resueltas_tooltip", "Alertas resueltas")}: ${formatNumber(item.resueltas || 0)}`}>
              <Box
                sx={{
                  width: 14,
                  backgroundColor: COLORS.success,
                  borderRadius: "3px 3px 0 0",
                  transition: "all 0.5s ease",
                  height: `${((item.resueltas || 0) / maxValue) * 100}%`,
                  minHeight: 3,
                }}
              />
            </Tooltip>
          </Box>
          <Typography variant="caption" sx={{ color: "var(--fg-subtle)", whiteSpace: "nowrap", fontSize: "0.65rem" }}>
            {new Date(item.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// Indicador de porcentaje: numero grande + barra de progreso (mas alto es mejor)
function PercentMetric({ value, label }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color = colorCumplimiento(pct);
  return (
    <Box sx={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 1, py: 2 }}>
      <Typography variant="h3" component="p" sx={{ fontWeight: 700, color, textAlign: "center" }}>
        {formatKpiValue(pct)}%
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        aria-label={label}
        sx={{
          height: 10,
          borderRadius: 5,
          backgroundColor: "var(--bg-soft)",
          "& .MuiLinearProgress-bar": { backgroundColor: color, borderRadius: 5 },
        }}
      />
      <Typography variant="body2" sx={{ color: "var(--fg-muted)", textAlign: "center" }}>
        {label}
      </Typography>
    </Box>
  );
}

// Estados posibles para filtro
const ESTADOS_OPTIONS = [
  { id: "critico", label: "Crítico" },
  { id: "bajo_stock", label: "Bajo stock" },
  { id: "sobrestock", label: "Sobrestock" },
  { id: "normal", label: "Normal" },
];

export default function MRPKPIs() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpisData, setKpisData] = useState(null);

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    centros: [],
    almacenes: [],
    sectores: [],
    estados: [],
  });
  const [catalogos, setCatalogos] = useState({ centros: [], almacenes: [], sectores: [] });

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

  // Función para convertir valor del slider a fecha ISO (YYYY-MM-DD)
  const sliderAFechaISO = (valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    return fecha.toISOString().split("T")[0];
  };

  // Cargar catálogos al montar y seleccionar todos por defecto
  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const res = await api.get("/mrp/catalogos");
        if (res.data?.ok) {
          const centros = res.data.centros || [];
          const almacenes = res.data.almacenes || [];
          const sectores = res.data.sectores || [];
          setCatalogos({ centros, almacenes, sectores });
          // Seleccionar todos los filtros por defecto
          setFiltros({
            centros: centros.map((c) => c.id),
            almacenes: almacenes.map((a) => a.id),
            sectores: sectores.map((s) => s.id),
            estados: ESTADOS_OPTIONS.map((e) => e.id),
          });
        }
      } catch {
        // Sin catálogos: los filtros quedan vacíos
      }
    };
    fetchCatalogos();
  }, []);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      // Agregar fechas del slider
      params.append("fecha_desde", sliderAFechaISO(rangoFechas[0]));
      params.append("fecha_hasta", sliderAFechaISO(rangoFechas[1]));
      if (filtros.centros.length) params.append("centros", filtros.centros.join(","));
      if (filtros.almacenes.length) params.append("almacenes", filtros.almacenes.join(","));
      if (filtros.sectores.length) params.append("sectores", filtros.sectores.join(","));
      if (filtros.estados.length) params.append("estados", filtros.estados.join(","));

      const res = await api.get(`/mrp/kpis?${params.toString()}`);
      if (res.data?.ok) {
        setKpisData(res.data);
      } else {
        setError(t("mrp_kpis_error_carga", "Revisa tu conexión e intenta nuevamente."));
      }
    } catch (err) {
      setError(t("mrp_kpis_error_carga", "Revisa tu conexión e intenta nuevamente."));
    } finally {
      setLoading(false);
    }
  }, [filtros, rangoFechas, t]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  // Handlers para filtros (Select multiselect)
  const handleFiltroChange = (campo, opciones) => (event) => {
    const value = event.target.value;
    if (value.includes("__todos__")) {
      const currentValues = filtros[campo];
      if (currentValues.length === opciones.length) {
        setFiltros((prev) => ({ ...prev, [campo]: [] }));
      } else {
        setFiltros((prev) => ({ ...prev, [campo]: opciones.map((o) => o.id || o) }));
      }
    } else {
      setFiltros((prev) => ({ ...prev, [campo]: typeof value === "string" ? value.split(",") : value }));
    }
  };

  const handleLimpiarFiltros = () => {
    setFiltros({ centros: [], almacenes: [], sectores: [], estados: [] });
    setRangoFechasLocal([0, 365]);
  };

  // MenuProps para los multiselect
  const MenuProps = {
    PaperProps: { style: { maxHeight: 32 * 6 + 4, width: 160 } },
  };

  return (
    <PageLayout title={t("mrp_indicadores_titulo", "Indicadores MRP")}>

      {/* Temp Data Banner */}
      <TempDataBanner />

      {/* Filtros - estilo Dashboard */}
      <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
        <Box sx={{ py: 1.5, px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {/* Slider de fechas */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0, width: { xs: "100%", md: 320 } }}>
            <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mt: 1 }}>
              {t("mrp_rango_desde", "Desde")} <Box component="span" sx={{ color: "var(--primary)", fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[0])}</Box> {t("mrp_rango_hasta", "hasta")} <Box component="span" sx={{ color: "var(--primary)", fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[1])}</Box>
            </Typography>
            <Slider
              size="small"
              value={rangoFechasLocal}
              onChange={(_, value) => setRangoFechasLocal(value)}
              min={0}
              max={365}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => sliderAFecha(value)}
              getAriaLabel={() => t("mrp_rango_fechas", "Rango de fechas")}
              sx={{ color: "var(--primary)", "& .MuiSlider-thumb": { width: 14, height: 14 }, "& .MuiSlider-valueLabel": { fontSize: 10 } }}
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-2xs)", color: "var(--fg-subtle)", mt: -0.5 }}>
              <Typography variant="caption" sx={{ fontSize: "var(--text-2xs)", color: "inherit" }}>{t("mrp_hace_un_anio", "Hace 1 año")}</Typography>
              <Typography variant="caption" sx={{ fontSize: "var(--text-2xs)", color: "inherit" }}>{t("mrp_hoy", "Hoy")}</Typography>
            </Box>
          </Box>

          {/* Separador */}
          <Box sx={{ height: 48, width: "1px", backgroundColor: "var(--border)", display: { xs: "none", md: "block" } }} />

          {/* Centro */}
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel id="centro-label" sx={{ fontSize: "0.75rem" }}>{t("mrp_filtro_centro", "Centro")}</InputLabel>
            <Select
              labelId="centro-label"
              multiple
              value={filtros.centros}
              onChange={handleFiltroChange("centros", catalogos.centros)}
              input={<OutlinedInput label={t("mrp_filtro_centro", "Centro")} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} ${t("mrp_seleccionados", "seleccionados")}` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.centros.length === catalogos.centros.length && catalogos.centros.length > 0} size="small" />
                <ListItemText primary={t("common_seleccionar_todos", "Seleccionar todos")} primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
              </MenuItem>
              {catalogos.centros.map((centro) => (
                <MenuItem key={centro.id} value={centro.id}>
                  <Checkbox checked={filtros.centros.includes(centro.id)} size="small" />
                  <ListItemText primary={centro.nombre} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Almacén */}
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel id="almacen-label" sx={{ fontSize: "0.75rem" }}>{t("mrp_filtro_almacen", "Almacén")}</InputLabel>
            <Select
              labelId="almacen-label"
              multiple
              value={filtros.almacenes}
              onChange={handleFiltroChange("almacenes", catalogos.almacenes)}
              input={<OutlinedInput label={t("mrp_filtro_almacen", "Almacén")} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} ${t("mrp_seleccionados", "seleccionados")}` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.almacenes.length === catalogos.almacenes.length && catalogos.almacenes.length > 0} size="small" />
                <ListItemText primary={t("common_seleccionar_todos", "Seleccionar todos")} primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
              </MenuItem>
              {catalogos.almacenes.map((almacen) => (
                <MenuItem key={almacen.id} value={almacen.id}>
                  <Checkbox checked={filtros.almacenes.includes(almacen.id)} size="small" />
                  <ListItemText primary={almacen.nombre} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sector */}
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel id="sector-label" sx={{ fontSize: "0.75rem" }}>{t("mrp_filtro_sector", "Sector")}</InputLabel>
            <Select
              labelId="sector-label"
              multiple
              value={filtros.sectores}
              onChange={handleFiltroChange("sectores", catalogos.sectores)}
              input={<OutlinedInput label={t("mrp_filtro_sector", "Sector")} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} ${t("mrp_seleccionados", "seleccionados")}` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.sectores.length === catalogos.sectores.length && catalogos.sectores.length > 0} size="small" />
                <ListItemText primary={t("common_seleccionar_todos", "Seleccionar todos")} primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
              </MenuItem>
              {catalogos.sectores.map((sector) => (
                <MenuItem key={sector.id} value={sector.id}>
                  <Checkbox checked={filtros.sectores.includes(sector.id)} size="small" />
                  <ListItemText primary={sector.nombre} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Estado */}
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 140 } }}>
            <InputLabel id="estado-label" sx={{ fontSize: "0.75rem" }}>{t("mrp_filtro_estado", "Estado")}</InputLabel>
            <Select
              labelId="estado-label"
              multiple
              value={filtros.estados}
              onChange={handleFiltroChange("estados", ESTADOS_OPTIONS)}
              input={<OutlinedInput label={t("mrp_filtro_estado", "Estado")} />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} ${t("mrp_seleccionados", "seleccionados")}` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.estados.length === ESTADOS_OPTIONS.length} size="small" />
                <ListItemText primary={t("common_seleccionar_todos", "Seleccionar todos")} primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
              </MenuItem>
              {ESTADOS_OPTIONS.map((estado) => (
                <MenuItem key={estado.id} value={estado.id}>
                  <Checkbox checked={filtros.estados.includes(estado.id)} size="small" />
                  <ListItemText primary={estado.label} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

            {/* Limpiar filtros */}
            <Button
              variant="outlined"
              size="small"
              onClick={handleLimpiarFiltros}
              sx={{ textTransform: "none" }}
            >
              {t("mrp_limpiar_filtros", "Limpiar filtros")}
            </Button>
          </Box>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper elevation={0} sx={{ border: "1px solid var(--border)" }}>
          <EmptyState
            title={t("mrp_kpis_error_titulo", "No se pudieron cargar los indicadores")}
            description={error}
            action={t("mrp_reintentar", "Reintentar")}
            onAction={fetchKPIs}
          />
        </Paper>
      ) : kpisData ? (
        <>
          {/* KPI Cards Grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {Object.entries(kpisData.kpis || {}).map(([key, kpi]) => (
              <KPICard
                key={key}
                titulo={KPI_LABELS[key] ? t(KPI_LABELS[key][0], KPI_LABELS[key][1]) : key.replace(/_/g, " ")}
                valor={kpi.valor}
                unidad={kpi.unidad}
                tendencia={kpi.tendencia}
                objetivo={kpi.objetivo}
                descripcion={kpi.descripcion}
                icon={kpiIcons[key] || BarChartIcon}
                color={key === "cumplimiento_mrp" ? colorCumplimiento(Number(kpi.valor) || 0) : kpiColors[key] || COLORS.primary}
                higherIsBetter={HIGHER_IS_BETTER.has(key)}
              />
            ))}
          </Box>

          {/* Charts Row */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 2,
            }}
          >
            {/* Distribution Chart */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
              <Box sx={{ p: 1.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 1 }}>
                <PieChartIcon sx={{ color: COLORS.primary, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                  {t("mrp_distribucion_estados", "Distribución de Estados")}
                </Typography>
              </Box>
              <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
                {kpisData.graficos?.distribucion_estados && (
                  <DonutChart data={kpisData.graficos.distribucion_estados} t={t} />
                )}
              </Box>
            </Paper>

            {/* Cumplimiento Gauge */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
              <Box sx={{ p: 1.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircleIcon sx={{ color: COLORS.primary, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                  {t("mrp_cumplimiento", "Cumplimiento MRP")}
                </Typography>
              </Box>
              <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
                <PercentMetric
                  value={kpisData.kpis?.cumplimiento_mrp?.valor || 0}
                  label={t("mrp_nivel_cumplimiento", "Nivel de Cumplimiento")}
                />
              </Box>
            </Paper>
          </Box>

          {/* Evolution Chart */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <Box sx={{ p: 1.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 1 }}>
              <ShowChartIcon sx={{ color: COLORS.primary, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                {t("mrp_evolucion_alertas", "Evolución de Alertas")}
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: "flex", gap: 3, mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, backgroundColor: COLORS.error }} />
                  <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
                    {t("mrp_alertas_generadas", "Alertas Generadas")}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, backgroundColor: COLORS.success }} />
                  <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
                    {t("mrp_alertas_resueltas", "Alertas Resueltas")}
                  </Typography>
                </Box>
              </Box>
              {kpisData.graficos?.evolucion_alertas && (
                <SimpleBarChart data={kpisData.graficos.evolucion_alertas} height={160} />
              )}
            </Box>
          </Paper>

          {/* Top Materials at Risk */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <Box sx={{ p: 1.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 1 }}>
              <WarningIcon sx={{ color: COLORS.warning, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                {t("mrp_top_riesgo", "Top Materiales en Riesgo")}
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {(kpisData.graficos?.top_materiales_riesgo || []).length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: COLORS.success, opacity: 0.6, mb: 1 }} />
                  <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                    {t("mrp_sin_materiales_riesgo", "No hay materiales en riesgo")}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {(kpisData.graficos?.top_materiales_riesgo || []).map((mat, idx) => (
                    <Box
                      key={mat.codigo}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1.5,
                        border: "1px solid var(--border)",
                        "&:hover": { borderColor: COLORS.primary, backgroundColor: "var(--bg-soft)" },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12,
                            backgroundColor: idx === 0 ? "color-mix(in srgb, var(--danger) 15%, transparent)" : idx === 1 ? "color-mix(in srgb, var(--warning) 15%, transparent)" : "color-mix(in srgb, var(--primary) 15%, transparent)",
                            color: idx === 0 ? COLORS.error : idx === 1 ? COLORS.warning : COLORS.primary,
                          }}
                        >
                          {idx + 1}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.primary }}>
                            {mat.codigo}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
                            {mat.descripcion}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: COLORS.error }}>
                          {formatNumber(mat.dias_sin_stock)} {t("mrp_dias", "días")}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "var(--fg-subtle)" }}>
                          {t("mrp_sin_stock", "sin stock")}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Paper>

          {/* Info footer */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-soft)",
            }}
          >
            <Box sx={{ display: "flex", gap: { xs: 1, md: 4 }, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                <strong>{t("mrp_periodo", "Período:")}</strong> {formatDate(kpisData.fecha_inicio)} {t("mrp_periodo_a", "a")} {formatDate(kpisData.fecha_fin)}
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                <strong>{t("mrp_kpis_total_materiales", "Total de materiales")}:</strong> {formatNumber(kpisData.total_materiales)}
              </Typography>
            </Box>
          </Paper>
        </>
      ) : null}
    </PageLayout>
  );
}
