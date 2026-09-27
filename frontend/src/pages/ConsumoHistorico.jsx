/**
 * Consumo historico - filtros, grafico mensual y tabla (detalle / por material)
 * de la tabla consumo_historico, valorizado en USD contra catalogo_materiales.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useI18n } from "../context/i18n";
import { consumoHistorico } from "../services/spm";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import PageLayout from "../components/ui/PageLayout";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { SPMBar } from "../components/ui/SPMChartJS";
import { formatCurrency as fmtCurrency, formatNumber as fmtNumber, formatDateFull, toDate } from "../utils/formatters";

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
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

function formatCurrency(value) {
  if (value == null || isNaN(value)) return "-";
  return fmtCurrency(value, 0);
}

function formatNumber(value) {
  if (value == null || isNaN(value)) return "-";
  return fmtNumber(Math.round(Number(value) * 100) / 100);
}

/** SummaryCard: tarjeta simple de resumen (mismo estilo que Stock.jsx) */
function SummaryCard({ label, value, variant = "default" }) {
  const variantStyles = {
    default: { bgcolor: "background.paper" },
    primary: { bgcolor: "primary.50", borderColor: "primary.200" },
  };
  return (
    <Paper variant="outlined" sx={{ p: 2, ...variantStyles[variant] }}>
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
      <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
        {value}
      </Typography>
    </Paper>
  );
}

function restarMeses(fechaISO, meses) {
  const d = toDate(fechaISO);
  d.setMonth(d.getMonth() - meses);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ConsumoHistorico() {
  const { t } = useI18n();

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [centro, setCentro] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [materialInput, setMaterialInput] = useState("");
  const material = useDebouncedValue(materialInput, 400);
  const [agrupar, setAgrupar] = useState("detalle");

  // Datos
  const [data, setData] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [mensual, setMensual] = useState([]);
  const [rangoDatos, setRangoDatos] = useState(null);
  const [filtrosCatalogo, setFiltrosCatalogo] = useState({ centros: [], almacenes: [] });
  const [truncado, setTruncado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const initialized = useRef(false);
  const [initReady, setInitReady] = useState(false);

  const cargar = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const res = await consumoHistorico.listar(params);
      if (res.data?.ok) {
        setData(res.data.data || []);
        setResumen(res.data.resumen || null);
        setMensual(res.data.mensual || []);
        setRangoDatos(res.data.rango_datos || null);
        setFiltrosCatalogo(res.data.filtros || { centros: [], almacenes: [] });
        setTruncado(!!res.data.truncado);
        return res.data;
      }
      setError(t("consumo_error_carga", "No se pudo cargar el consumo histórico. Inténtalo de nuevo."));
    } catch {
      setError(t("consumo_error_conexion", "No se pudo conectar con el servidor. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
    return null;
  }, [t]);

  // Carga inicial: descubre el rango de datos disponible y fija "últimos 12 meses" por defecto
  useEffect(() => {
    let cancelado = false;
    cargar({ agrupar: "detalle" }).then((resultado) => {
      if (cancelado) return;
      const max = resultado?.rango_datos?.max;
      if (max) {
        setHasta(max);
        setDesde(restarMeses(max, 12));
      }
      initialized.current = true;
      setInitReady(true);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarga cuando cambian los filtros (una vez terminada la carga inicial)
  useEffect(() => {
    if (!initReady) return;
    const params = { agrupar };
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (centro) params.centro = centro;
    if (almacen) params.almacen = almacen;
    if (material) params.material = material;
    cargar(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initReady, desde, hasta, centro, almacen, material, agrupar]);

  const limpiarFiltros = () => {
    setCentro("");
    setAlmacen("");
    setMaterialInput("");
    if (rangoDatos?.max) {
      setHasta(rangoDatos.max);
      setDesde(restarMeses(rangoDatos.max, 12));
    }
  };

  const handleRowClick = useCallback((row) => {
    if (agrupar === "material" && row?.material) {
      setMaterialInput(row.material);
      setAgrupar("detalle");
    }
  }, [agrupar]);

  // Columnas AG-Grid
  const columnasDetalle = useMemo(() => [
    { headerName: t("common_fecha", "Fecha"), field: "fecha", width: 110, sort: "desc",
      valueFormatter: ({ value }) => formatDateFull(value) },
    { headerName: t("common_centro", "Centro"), field: "centro", width: 100 },
    { headerName: t("common_almacen", "Almacén"), field: "almacen", width: 110 },
    { headerName: t("common_material", "Material"), field: "material", width: 120,
      cellStyle: { fontFamily: "monospace", fontWeight: 500 } },
    { headerName: t("common_descripcion", "Descripción"), field: "descripcion", flex: 2, minWidth: 200,
      tooltipField: "descripcion" },
    { headerName: t("consumo_col_cantidad", "Cantidad"), field: "cantidad", width: 130, type: "rightAligned",
      valueFormatter: ({ value, data: row }) => {
        const num = formatNumber(value);
        return row?.unidad ? `${num} ${row.unidad}` : num;
      } },
    { headerName: t("consumo_col_precio", "Precio USD"), field: "precio_usd", width: 130, type: "rightAligned",
      valueFormatter: ({ value }) => (value == null ? t("consumo_sin_precio", "Sin precio") : formatCurrency(value)) },
    { headerName: t("consumo_col_valor", "Valor USD"), field: "valor_usd", width: 140, type: "rightAligned",
      valueFormatter: ({ value }) => (value == null ? t("consumo_sin_precio", "Sin precio") : formatCurrency(value)) },
  ], [t]);

  const columnasPorMaterial = useMemo(() => [
    { headerName: t("common_material", "Material"), field: "material", width: 120, pinned: "left",
      cellStyle: { fontFamily: "monospace", fontWeight: 500 } },
    { headerName: t("common_descripcion", "Descripción"), field: "descripcion", flex: 2, minWidth: 200,
      tooltipField: "descripcion" },
    { headerName: t("consumo_col_movimientos", "Movimientos"), field: "movimientos", width: 130, type: "rightAligned",
      valueFormatter: ({ value }) => formatNumber(value) },
    { headerName: t("consumo_col_cantidad_total", "Cantidad total"), field: "cantidad_total", width: 150, type: "rightAligned",
      valueFormatter: ({ value, data: row }) => {
        const num = formatNumber(value);
        return row?.unidad ? `${num} ${row.unidad}` : num;
      } },
    { headerName: t("consumo_col_primer_consumo", "Primer consumo"), field: "primer_consumo", width: 130,
      valueFormatter: ({ value }) => formatDateFull(value) },
    { headerName: t("consumo_col_ultimo_consumo", "Último consumo"), field: "ultimo_consumo", width: 130,
      valueFormatter: ({ value }) => formatDateFull(value) },
    { headerName: t("consumo_col_precio", "Precio USD"), field: "precio_usd", width: 130, type: "rightAligned",
      valueFormatter: ({ value }) => (value == null ? t("consumo_sin_precio", "Sin precio") : formatCurrency(value)) },
    { headerName: t("consumo_col_valor", "Valor USD"), field: "valor_usd", width: 140, type: "rightAligned",
      valueFormatter: ({ value }) => (value == null ? t("consumo_sin_precio", "Sin precio") : formatCurrency(value)) },
  ], [t]);

  // Grafico mensual
  const mesesMap = useMemo(() => {
    const m = new Map();
    mensual.forEach((f) => m.set(f.mes, f));
    return m;
  }, [mensual]);

  const chartOptions = useMemo(() => ({
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const mes = context.label;
            const fila = mesesMap.get(mes);
            const partes = [`${t("consumo_grafico_valor", "Valor")}: ${formatCurrency(context.parsed.y)}`];
            if (fila) {
              partes.push(`${t("consumo_col_movimientos", "Movimientos")}: ${formatNumber(fila.movimientos)}`);
              partes.push(`${t("consumo_col_cantidad", "Cantidad")}: ${formatNumber(fila.cantidad)}`);
            }
            return partes;
          },
        },
      },
    },
  }), [mesesMap, t]);

  const subtitulo = rangoDatos?.min && rangoDatos?.max
    ? t("consumo_subtitulo", "Datos disponibles: {desde} - {hasta}")
        .replace("{desde}", formatDateFull(rangoDatos.min))
        .replace("{hasta}", formatDateFull(rangoDatos.max))
    : null;

  const haySeleccion = !!(centro || almacen || materialInput);

  return (
    <PageLayout title={t("consumo_titulo", "Consumo histórico")} subtitle={subtitulo}>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Tarjetas resumen */}
      {resumen && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            gap: 2,
          }}
        >
          <SummaryCard label={t("consumo_kpi_movimientos", "Movimientos")} value={formatNumber(resumen.movimientos)} />
          <SummaryCard label={t("consumo_kpi_cantidad", "Cantidad total")} value={formatNumber(resumen.cantidad_total)} />
          <SummaryCard label={t("consumo_kpi_materiales", "Materiales distintos")} value={formatNumber(resumen.materiales)} />
          <SummaryCard label={t("consumo_kpi_valor", "Valor estimado")} value={formatCurrency(resumen.valor_usd)} variant="primary" />
        </Box>
      )}

      {/* Filtros */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" flexWrap="wrap" alignItems="center" spacing={2} useFlexGap>
          <TextField
            size="small"
            type="date"
            label={t("common_desde", "Desde")}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", sm: 160 } }}
          />
          <TextField
            size="small"
            type="date"
            label={t("common_hasta", "Hasta")}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", sm: 160 } }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 } }}>
            <InputLabel>{t("common_centro", "Centro")}</InputLabel>
            <Select name="centro" value={centro} onChange={(e) => setCentro(e.target.value)} label={t("common_centro", "Centro")}>
              <MenuItem value="">{t("consumo_todos_centros", "Todos los centros")}</MenuItem>
              {filtrosCatalogo.centros.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 150 } }}>
            <InputLabel>{t("common_almacen", "Almacén")}</InputLabel>
            <Select name="almacen" value={almacen} onChange={(e) => setAlmacen(e.target.value)} label={t("common_almacen", "Almacén")}>
              <MenuItem value="">{t("consumo_todos_almacenes", "Todos los almacenes")}</MenuItem>
              {filtrosCatalogo.almacenes.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            value={materialInput}
            onChange={(e) => setMaterialInput(e.target.value)}
            placeholder={t("consumo_material_placeholder", "Código o descripción del material...")}
            sx={{ flex: 1, minWidth: { xs: "100%", sm: 220 } }}
          />

          <Button
            variant="outlined"
            size="small"
            onClick={limpiarFiltros}
            disabled={!haySeleccion}
            sx={{ textTransform: "none" }}
          >
            {t("common_limpiar_filtros", "Limpiar filtros")}
          </Button>
        </Stack>
      </Paper>

      {/* Grafico mensual */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          {t("consumo_grafico_titulo", "Consumo valorizado por mes")}
        </Typography>
        <SPMBar
          labels={mensual.map((f) => f.mes)}
          datasets={[{ label: t("consumo_grafico_valor", "Valor USD"), data: mensual.map((f) => f.valor_usd) }]}
          options={chartOptions}
          height={280}
          loading={loading && mensual.length === 0}
        />
      </Paper>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={agrupar}
            onChange={(_e, valor) => valor && setAgrupar(valor)}
          >
            <ToggleButton value="detalle" sx={{ textTransform: "none" }}>
              {t("consumo_vista_detalle", "Detalle")}
            </ToggleButton>
            <ToggleButton value="material" sx={{ textTransform: "none" }}>
              {t("consumo_vista_material", "Por material")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {truncado && (
          <Alert severity="warning" sx={{ borderRadius: 0 }}>
            {t("consumo_truncado", "Se muestran los primeros 25.000 registros. Ajusta los filtros para ver menos datos.")}
          </Alert>
        )}

        <SPMAgGrid
          rowData={data}
          columnDefs={agrupar === "material" ? columnasPorMaterial : columnasDetalle}
          loading={loading}
          height={560}
          exportFileName="consumo_historico"
          emptyMessage={t("consumo_empty", "No se encontraron registros de consumo")}
          onRowClick={handleRowClick}
          defaultColDef={{ sortable: true, filter: false, resizable: true }}
        />
      </Paper>
    </PageLayout>
  );
}
