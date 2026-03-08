import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import { TempDataBanner } from "../components/ui/TempDataBanner";
// MUI Components
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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
// Chart.js Components
import { SPMGauge } from "../components/ui/SPMChartJS";

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

// KPI Card component
function KPICard({ titulo, valor, unidad, tendencia, objetivo, descripcion, icon: Icon, color = COLORS.primary }) {
  const getTendenciaIcon = () => {
    switch (tendencia) {
      case "up": return <TrendingUpIcon sx={{ fontSize: 16, color: COLORS.success }} />;
      case "down": return <TrendingDownIcon sx={{ fontSize: 16, color: COLORS.error }} />;
      default: return <TrendingFlatIcon sx={{ fontSize: 16, color: COLORS.warning }} />;
    }
  };

  const getTendenciaLabel = () => {
    switch (tendencia) {
      case "up": return "Subiendo";
      case "down": return "Bajando";
      default: return "Estable";
    }
  };

  const getTendenciaBg = () => {
    switch (tendencia) {
      case "up": return "color-mix(in srgb, var(--success) 15%, transparent)";
      case "down": return "color-mix(in srgb, var(--danger) 15%, transparent)";
      default: return "color-mix(in srgb, var(--warning) 15%, transparent)";
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: "1px solid var(--border)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Box
          sx={{
            p: 1,
            backgroundColor: `${color}15`,
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
            backgroundColor: getTendenciaBg(),
          }}
        >
          {getTendenciaIcon()}
          <Typography variant="caption" sx={{ fontWeight: 500, fontSize: "0.7rem" }}>
            {getTendenciaLabel()}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 0.5, flex: 1 }}>
        <Typography variant="h5" component="span" sx={{ fontWeight: 700, color: "var(--fg-strong)" }}>
          {valor}
        </Typography>
        {unidad && (
          <Typography variant="body2" component="span" sx={{ color: "var(--fg-muted)", ml: 0.5 }}>
            {unidad}
          </Typography>
        )}
      </Box>

      <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--fg-strong)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {titulo}
      </Typography>
      {descripcion && (
        <Typography variant="caption" sx={{ color: "var(--fg-subtle)", fontSize: "0.65rem", mt: 0.25 }}>
          {descripcion}
        </Typography>
      )}

      {objetivo && (
        <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px solid var(--border)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "var(--fg-subtle)" }}>
              Objetivo:
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: valor <= objetivo ? COLORS.success : COLORS.error,
              }}
            >
              {objetivo} {unidad}
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
        Sin datos disponibles
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
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
          {total.toFixed(0)}%
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
              {(item.valor || 0).toFixed(1)}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// Bar Chart component
function SimpleBarChart({ data = [], height = 160 }) {
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map(d => Math.max(d.alertas || 0, d.resueltas || 0)), 1);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Typography color="text.secondary" textAlign="center" py={4}>
        Sin datos disponibles
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.5, justifyContent: "space-between", height }}>
      {data.map((item, idx) => (
        <Box key={idx} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-end", height: "100%" }}>
            <Tooltip title={`Alertas: ${item.alertas || 0}`}>
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
            <Tooltip title={`Resueltas: ${item.resueltas || 0}`}>
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

// Gauge Chart using Chart.js
function GaugeChartMUI({ value, label }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <SPMGauge
        value={value}
        max={100}
        thresholds={{ warning: 50, danger: 80 }}
        height={140}
        label={label}
        unit="%"
      />
    </Box>
  );
}

// Estados posibles para filtro
const ESTADOS_OPTIONS = [
  { id: "critico", label: "Crítico" },
  { id: "bajo_stock", label: "Bajo Stock" },
  { id: "sobrestock", label: "Sobrestock" },
  { id: "normal", label: "Normal" },
];

export default function MRPKPIs() {
  const { t } = useI18n();
  const navigate = useNavigate();
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
      } catch (err) {
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
        setError(res.data?.error?.message || "Error al cargar KPIs");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [filtros, rangoFechas]);

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
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "var(--fg-muted)" }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t("mrp_kpis_titulo", "KPI'S MRP")}
        </Typography>
      </Box>

      {/* Temp Data Banner */}
      <TempDataBanner />

      {/* Filtros - estilo Dashboard */}
      <Paper elevation={0} sx={{ mb: 3, border: "1px solid var(--border)", overflow: "hidden" }}>
        <Box sx={{ py: 1.5, px: 3, height: "73px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, height: "100%" }}>
          {/* Slider de fechas */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0, minWidth: "320px" }}>
            <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mt: 1 }}>
              Desde <Box component="span" sx={{ color: "var(--primary)", fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[0])}</Box> hasta <Box component="span" sx={{ color: "var(--primary)", fontWeight: 600 }}>{sliderAFecha(rangoFechasLocal[1])}</Box>
            </Typography>
            <Slider
              size="small"
              value={rangoFechasLocal}
              onChange={(_, value) => setRangoFechasLocal(value)}
              min={0}
              max={365}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => sliderAFecha(value)}
              getAriaLabel={() => "Rango de fechas"}
              sx={{ color: "var(--primary)", "& .MuiSlider-thumb": { width: 14, height: 14 }, "& .MuiSlider-valueLabel": { fontSize: 10 } }}
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--fg-subtle)", mt: -0.5 }}>
              <Typography variant="caption" sx={{ fontSize: "10px", color: "inherit" }}>Hace 1 año</Typography>
              <Typography variant="caption" sx={{ fontSize: "10px", color: "inherit" }}>Hoy</Typography>
            </Box>
          </Box>

          {/* Separador */}
          <Box sx={{ height: 64, width: "1px", backgroundColor: "var(--border)" }} />

          {/* Centro */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="centro-label" sx={{ fontSize: "0.75rem" }}>Centro</InputLabel>
            <Select
              labelId="centro-label"
              multiple
              value={filtros.centros}
              onChange={handleFiltroChange("centros", catalogos.centros)}
              input={<OutlinedInput label="Centro" />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.centros.length === catalogos.centros.length && catalogos.centros.length > 0} size="small" />
                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="almacen-label" sx={{ fontSize: "0.75rem" }}>Almacén</InputLabel>
            <Select
              labelId="almacen-label"
              multiple
              value={filtros.almacenes}
              onChange={handleFiltroChange("almacenes", catalogos.almacenes)}
              input={<OutlinedInput label="Almacén" />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.almacenes.length === catalogos.almacenes.length && catalogos.almacenes.length > 0} size="small" />
                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="sector-label" sx={{ fontSize: "0.75rem" }}>Sector</InputLabel>
            <Select
              labelId="sector-label"
              multiple
              value={filtros.sectores}
              onChange={handleFiltroChange("sectores", catalogos.sectores)}
              input={<OutlinedInput label="Sector" />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.sectores.length === catalogos.sectores.length && catalogos.sectores.length > 0} size="small" />
                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
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
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="estado-label" sx={{ fontSize: "0.75rem" }}>Estado</InputLabel>
            <Select
              labelId="estado-label"
              multiple
              value={filtros.estados}
              onChange={handleFiltroChange("estados", ESTADOS_OPTIONS)}
              input={<OutlinedInput label="Estado" />}
              renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected.join(", ")}
              MenuProps={MenuProps}
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="__todos__">
                <Checkbox checked={filtros.estados.length === ESTADOS_OPTIONS.length} size="small" />
                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
              </MenuItem>
              {ESTADOS_OPTIONS.map((estado) => (
                <MenuItem key={estado.id} value={estado.id}>
                  <Checkbox checked={filtros.estados.includes(estado.id)} size="small" />
                  <ListItemText primary={estado.label} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

            {/* Limpiar Filtros */}
            <Box
              component="button"
              type="button"
              onClick={handleLimpiarFiltros}
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "var(--fg-muted)",
                border: "1px solid var(--border)",
                backgroundColor: "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
                "&:hover": {
                  color: "var(--primary)",
                  borderColor: "var(--primary)",
                },
              }}
            >
              Limpiar Filtros
            </Box>
          </Box>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : kpisData ? (
        <>
          {/* KPI Cards Grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
              mb: 3,
            }}
          >
            {Object.entries(kpisData.kpis || {}).map(([key, kpi]) => (
              <KPICard
                key={key}
                titulo={key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                valor={kpi.valor}
                unidad={kpi.unidad}
                tendencia={kpi.tendencia}
                objetivo={kpi.objetivo}
                descripcion={kpi.descripcion}
                icon={kpiIcons[key] || BarChartIcon}
                color={kpiColors[key] || COLORS.primary}
              />
            ))}
          </Box>

          {/* Charts Row */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 2,
              mb: 3,
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
                <GaugeChartMUI
                  value={kpisData.kpis?.cumplimiento_mrp?.valor || 0}
                  label={t("mrp_nivel_cumplimiento", "Nivel de Cumplimiento")}
                />
              </Box>
            </Paper>
          </Box>

          {/* Evolution Chart */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden", mb: 3 }}>
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
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden", mb: 3 }}>
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
                    No hay materiales en riesgo
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
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace", color: COLORS.primary }}>
                            {mat.codigo}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "var(--fg-muted)" }}>
                            {mat.descripcion}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: COLORS.error }}>
                          {mat.dias_sin_stock} {t("mrp_dias", "días")}
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
            <Box sx={{ display: "flex", gap: 4 }}>
              <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                <strong>{t("mrp_periodo", "Período:")}</strong> {kpisData.fecha_inicio} a {kpisData.fecha_fin}
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
                <strong>{t("mrp_total_materiales", "Total materiales:")}</strong> {kpisData.total_materiales}
              </Typography>
            </Box>
          </Paper>
        </>
      ) : null}
    </Box>
    </Box>
  );
}
