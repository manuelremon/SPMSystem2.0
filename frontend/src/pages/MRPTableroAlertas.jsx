/**
 * MRPTableroAlertas - Tablero de Alertas MRP
 * SAP/Enterprise UI - Migrated to MUI components
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";
import useToast from "../hooks/useToast";
import api from "../services/api";
import { exportToExcel } from "../utils/formatters";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { SPMGauge } from "../components/ui/SPMChartJS";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Slider from "@mui/material/Slider";
import Menu from "@mui/material/Menu";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";


/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const ESTADOS_OPTIONS = [
  { value: "quiebre", label: "Quiebre de Stock" },
  { value: "bajo punto", label: "Bajo Punto de Pedido" },
  { value: "bajo stock", label: "Bajo Stock de Seguridad" },
  { value: "exceso", label: "Exceso/Sobrestock" },
  { value: "normal", label: "Normal" },
];

const estadoColors = {
  danger: { color: "error.dark", bg: "error.lighter" },
  warning: { color: "warning.dark", bg: "warning.lighter" },
  success: { color: "success.dark", bg: "success.lighter" },
  info: { color: "info.dark", bg: "info.lighter" },
};

/* ─────────────────────────────────────────────────────────────
   Multi-Select Dropdown Component
───────────────────────────────────────────────────────────── */
function MultiSelect({ label, options, selected, onChange, keyField = "codigo", labelField = "nombre" }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const allSelected = selected.length === options.length && options.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o[keyField] || o.value || o));
    }
  };

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText =
    selected.length === 0
      ? "Ninguno"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} seleccionados`;

  return (
    <Box sx={{ minWidth: 150 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "text.secondary",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{
          width: "100%",
          justifyContent: "space-between",
          textTransform: "none",
          fontSize: "12px",
          py: 0.75,
          px: 1.5,
          color: selected.length === 0 ? "text.disabled" : "text.primary",
          borderColor: "divider",
          bgcolor: "background.paper",
          "&:hover": {
            bgcolor: "grey.50",
            borderColor: "divider",
          },
        }}
      >
        {displayText}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            maxHeight: 208,
            minWidth: anchorEl?.offsetWidth || 150,
          },
        }}
      >
        {/* Select All */}
        <MenuItem
          onClick={toggleAll}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            py: 1,
          }}
        >
          <Checkbox
            checked={allSelected}
            size="small"
            sx={{ p: 0, mr: 1 }}
          />
          <ListItemText
            primary="Seleccionar todos"
            primaryTypographyProps={{
              fontSize: "12px",
              fontWeight: 600,
            }}
          />
        </MenuItem>
        {/* Options */}
        {options.map((opt) => {
          const value = opt[keyField] || opt.value || opt;
          const optLabel = opt[labelField] || opt.label || (opt[keyField] ? `${opt[keyField]} - ${opt[labelField] || opt.nombre}` : opt);
          const isSelected = selected.includes(value);
          return (
            <MenuItem
              key={value}
              onClick={() => toggleOption(value)}
              sx={{ py: 1 }}
            >
              <Checkbox
                checked={isSelected}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              <ListItemText
                primary={optLabel}
                primaryTypographyProps={{
                  fontSize: "12px",
                  noWrap: true,
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Summary Card Component
───────────────────────────────────────────────────────────── */
function SummaryCard({ titulo, valor, color, pct, showChart, total }) {
  const colorMap = {
    "var(--primary-dark)": "primary.main",
    "var(--danger)": "error.dark",
    "var(--info)": "secondary.main",
    "var(--warning)": "warning.dark",
    "var(--warning-light)": "warning.main",
    "var(--success)": "success.dark",
  };

  const muiColor = colorMap[color] || "text.primary";

  return (
    <Box
      sx={{
        flex: 1,
        textAlign: "center",
        py: 1.5,
        px: 1,
        borderRight: 1,
        borderColor: "divider",
        "&:last-child": {
          borderRight: 0,
        },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: "1.875rem",
          fontWeight: 700,
          color: muiColor,
        }}
      >
        {valor}
      </Typography>
      <Typography
        sx={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          color: "text.secondary",
          letterSpacing: "0.05em",
          mb: 0.5,
        }}
      >
        {titulo}
      </Typography>
      {showChart && (
        <Box sx={{ width: 60, height: 40, mt: 0.5 }}>
          <SPMGauge
            value={pct}
            max={100}
            height={40}
            width={60}
            color={color}
            unit="%"
            showText={true}
          />
        </Box>
      )}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function MRPTableroAlertas() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [resumen, setResumen] = useState({});
  const [exporting, setExporting] = useState(false);

  // Filtros multiselect
  const [filtros, setFiltros] = useState({
    centros: [],
    almacenes: [],
    sectores: [],
    estados: [],
  });
  const [catalogos, setCatalogos] = useState({ centros: [], almacenes: [], sectores: [] });

  // Busqueda local
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para slider de fechas (0 = hace 1 ano, 365 = hoy)
  const [rangoFechasLocal, setRangoFechasLocal] = useState([0, 365]);
  const rangoFechas = useDebouncedValue(rangoFechasLocal, 300);

  // Funcion para convertir valor del slider a fecha (formato DD/MM/AA)
  const sliderAFecha = (valor) => {
    const diasHaciaAtras = 365 - valor;
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasHaciaAtras);
    const dd = String(fecha.getDate()).padStart(2, "0");
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const yy = String(fecha.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  // Cargar catalogos y seleccionar todos por defecto
  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const res = await api.get("/mrp/catalogos");
        if (res.data?.ok) {
          setCatalogos(res.data);
          setFiltros({
            centros: (res.data.centros || []).map((c) => c.codigo),
            almacenes: (res.data.almacenes || []).map((a) => a.codigo),
            sectores: (res.data.sectores || []).map((s) => s.nombre),
            estados: ESTADOS_OPTIONS.map((e) => e.value),
          });
        }
      } catch (err) {
      }
    };
    fetchCatalogos();
  }, []);

  const handleLimpiarFiltros = () => {
    setFiltros({
      centros: (catalogos.centros || []).map((c) => c.codigo),
      almacenes: (catalogos.almacenes || []).map((a) => a.codigo),
      sectores: (catalogos.sectores || []).map((s) => s.nombre),
      estados: ESTADOS_OPTIONS.map((e) => e.value),
    });
    setSearchTerm("");
    setRangoFechasLocal([0, 365]);
  };

  // Cargar alertas
  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      const allCentros = catalogos.centros || [];
      const allAlmacenes = catalogos.almacenes || [];
      const allSectores = catalogos.sectores || [];

      if (filtros.centros.length > 0 && filtros.centros.length < allCentros.length) {
        filtros.centros.forEach((c) => params.append("centro", c));
      }
      if (filtros.almacenes.length > 0 && filtros.almacenes.length < allAlmacenes.length) {
        filtros.almacenes.forEach((a) => params.append("almacen", a));
      }
      if (filtros.sectores.length > 0 && filtros.sectores.length < allSectores.length) {
        filtros.sectores.forEach((s) => params.append("sector", s));
      }
      if (filtros.estados.length > 0 && filtros.estados.length < ESTADOS_OPTIONS.length) {
        filtros.estados.forEach((e) => params.append("estado", e));
      }
      params.append("limit", "500");

      const res = await api.get(`/mrp/alertas?${params.toString()}`);
      if (res.data?.ok) {
        setAlertas(res.data.data || []);
        setResumen(res.data.resumen || {});
      } else {
        setError(res.data?.error?.message || "Error al cargar alertas");
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Error de conexion");
    } finally {
      setLoading(false);
    }
  }, [filtros, catalogos]);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  // Filtrar por busqueda local
  const filteredAlertas = useMemo(() => {
    if (!searchTerm) return alertas;
    const term = searchTerm.toLowerCase();
    return alertas.filter(
      (alerta) =>
        alerta.codigo?.toLowerCase().includes(term) ||
        alerta.descripcion?.toLowerCase().includes(term)
    );
  }, [alertas, searchTerm]);

  // Exportar a XLSX
  const handleExportXLSX = useCallback(() => {
    if (filteredAlertas.length === 0) return;
    setExporting(true);

    const dataToExport = filteredAlertas.map((row) => ({
      Material: row.codigo || "",
      Descripcion: row.descripcion || "",
      "Demanda Est. Anual": Math.round(row.demanda_estimada_anual || 0),
      "Cons. Prom. Anual": Math.round(row.consumo_promedio_anual || 0),
      "Stock Seguridad": row.stock_seguridad || 0,
      "Punto Pedido": row.punto_pedido || 0,
      "Stock Maximo": row.stock_maximo || 0,
      "Stock Actual": row.stock_actual || 0,
      "Pedidos en Curso": row.pedidos_en_curso || 0,
      "Rotacion %": Math.round(row.rotacion_pct || 0),
      Estado: row.estado || "",
      Sugerencia: row.sugerencia || "",
    }));

    try {
      exportToExcel(dataToExport, `alertas_mrp_${new Date().toISOString().split("T")[0]}.xls`);
    } finally {
      setExporting(false);
    }
  }, [filteredAlertas]);

  // Exportar a PDF
  const handleExportPDF = useCallback(() => {
    if (filteredAlertas.length === 0) return;
    setExporting(true);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.warning("Por favor permite ventanas emergentes para exportar a PDF");
      setExporting(false);
      return;
    }

    // PDF colors (must be hardcoded since CSS variables don't work in separate document)
    const pdfColors = {
      primaryDark: getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() || '#1565c0',
      danger: getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#ef4444',
      info: getComputedStyle(document.documentElement).getPropertyValue('--info').trim() || '#0ea5e9',
      warning: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#f59e0b',
      warningLight: '#ff3d00',
      success: getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#22c55e',
      border: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e2e8f0',
      fgMuted: getComputedStyle(document.documentElement).getPropertyValue('--fg-muted').trim() || '#64748b',
      fgStrong: getComputedStyle(document.documentElement).getPropertyValue('--fg-strong').trim() || '#1e293b',
      bgSoft: getComputedStyle(document.documentElement).getPropertyValue('--bg-soft').trim() || '#f8fafc',
    };

    const cardsData = [
      { titulo: "Total", valor: resumen.total || 0, color: pdfColors.primaryDark },
      { titulo: "Quiebre de Stock", valor: resumen.quiebre_stock || 0, color: pdfColors.danger },
      { titulo: "Bajo Stock Seg.", valor: resumen.bajo_stock_seguridad || 0, color: pdfColors.info },
      { titulo: "Bajo Punto Pedido", valor: resumen.bajo_punto_pedido || 0, color: pdfColors.warning },
      { titulo: "Sobrestock", valor: resumen.sobrestock || 0, color: pdfColors.warningLight },
      { titulo: "Normal", valor: resumen.normal || 0, color: pdfColors.success },
    ];

    const cardsHtml = cardsData
      .map(
        (card) => `
      <div style="flex: 1; text-align: center; padding: 8px; border-right: 1px solid ${pdfColors.border};">
        <div style="font-size: 24px; font-weight: 700; color: ${card.color};">${card.valor}</div>
        <div style="font-size: 10px; text-transform: uppercase; color: ${pdfColors.fgMuted}; font-weight: 600;">${card.titulo}</div>
      </div>
    `
      )
      .join("");

    const headers = [
      "Material",
      "Descripcion",
      "Demanda",
      "Cons. Prom.",
      "SS",
      "PP",
      "SM",
      "Stock",
      "Ped. Curso",
      "Rot. %",
      "Estado",
      "Sugerencia",
    ];
    const headerCells = headers
      .map(
        (h) =>
          `<th style="border: 1px solid ${pdfColors.border}; padding: 6px 4px; background: ${pdfColors.bgSoft}; color: ${pdfColors.fgStrong}; font-size: 9px; text-align: center; font-weight: 600;">${h}</th>`
      )
      .join("");

    const tableRows = filteredAlertas
      .map((row) => {
        const stockColor =
          (row.stock_actual || 0) <= 0
            ? pdfColors.danger
            : (row.stock_actual || 0) < (row.punto_pedido || 0)
            ? pdfColors.warning
            : pdfColors.success;
        const rotColor =
          (row.rotacion_pct || 0) > 300
            ? pdfColors.success
            : (row.rotacion_pct || 0) > 100
            ? pdfColors.warning
            : pdfColors.danger;

        return `<tr>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${row.codigo || ""}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px;">${row.descripcion || ""}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${Math.round(row.demanda_estimada_anual || 0)}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${Math.round(row.consumo_promedio_anual || 0)}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${row.stock_seguridad || 0}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${row.punto_pedido || 0}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${row.stock_maximo || 0}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center; color: ${stockColor}; font-weight: 600;">${row.stock_actual || 0}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center;">${row.pedidos_en_curso || 0}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center; color: ${rotColor}; font-weight: 600;">${Math.round(row.rotacion_pct || 0)}%</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px; text-align: center; text-transform: uppercase;">${row.estado || ""}</td>
        <td style="border: 1px solid ${pdfColors.border}; padding: 4px; font-size: 9px;">${row.sugerencia || ""}</td>
      </tr>`;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tablero de Alertas MRP</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          @media print {
            thead { display: table-header-group; }
          }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          h1 { margin: 0 0 15px 0; font-size: 20px; color: ${pdfColors.fgStrong}; }
          .cards-container { display: flex; border: 1px solid ${pdfColors.border}; border-radius: 8px; margin-bottom: 15px; }
          .cards-container > div:last-child { border-right: none; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          .fecha { font-size: 11px; color: ${pdfColors.fgMuted}; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>Tablero de Alertas MRP</h1>
        <div class="fecha">Fecha de exportacion: ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        <div class="cards-container">${cardsHtml}</div>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setExporting(false);
  }, [filteredAlertas, resumen]);

  // Columnas del DataGrid - AG Grid format
  const columnDefs = useMemo(
    () => [
      {
        field: "codigo",
        headerName: "Material",
        flex: 0.7,
        minWidth: 100,
      },
      {
        field: "descripcion",
        headerName: "Descripcion",
        flex: 1.5,
        minWidth: 200,
      },
      {
        field: "demanda_estimada_anual",
        headerName: "Demanda",
        flex: 0.5,
        minWidth: 70,
        headerTooltip: "Demanda Estimada Anual",
        valueFormatter: (params) => Math.round(params.value || 0).toLocaleString("es-AR"),
      },
      {
        field: "consumo_promedio_anual",
        headerName: "Cons. Prom.",
        flex: 0.6,
        minWidth: 80,
        valueFormatter: (params) => Math.round(params.value || 0).toLocaleString("es-AR"),
      },
      {
        field: "stock_seguridad",
        headerName: "SS",
        flex: 0.4,
        minWidth: 50,
        headerTooltip: "Stock de Seguridad",
      },
      {
        field: "punto_pedido",
        headerName: "PP",
        flex: 0.4,
        minWidth: 50,
        headerTooltip: "Punto de Pedido",
      },
      {
        field: "stock_maximo",
        headerName: "SM",
        flex: 0.4,
        minWidth: 50,
        headerTooltip: "Stock Maximo",
      },
      {
        field: "stock_actual",
        headerName: "Stock",
        flex: 0.4,
        minWidth: 60,
        headerTooltip: "Stock HOY",
        cellRenderer: (params) => {
          const stock = params.value || 0;
          const pp = params.data.punto_pedido || 0;
          let color = "success.main";
          if (stock <= 0) color = "error.main";
          else if (stock < pp) color = "warning.main";
          return (
            <Typography sx={{ fontWeight: 600, color }}>
              {stock}
            </Typography>
          );
        },
      },
      {
        field: "pedidos_en_curso",
        headerName: "Ped. Curso",
        flex: 0.5,
        minWidth: 70,
      },
      {
        field: "rotacion_pct",
        headerName: "Rotacion",
        flex: 0.5,
        minWidth: 70,
        cellRenderer: (params) => {
          const rot = Math.round(params.value || 0);
          let color = "error.main";
          if (rot > 300) color = "success.main";
          else if (rot > 100) color = "warning.main";
          return (
            <Typography sx={{ fontWeight: 600, color }}>
              {rot}%
            </Typography>
          );
        },
      },
      {
        field: "estado",
        headerName: "Estado",
        flex: 0.6,
        minWidth: 120,
        cellRenderer: (params) => {
          const clase = params.data.estado_clase || "info";
          const colors = estadoColors[clase] || estadoColors.info;
          return (
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                color: colors.color,
              }}
            >
              {params.value || "-"}
            </Typography>
          );
        },
      },
      {
        field: "sugerencia",
        headerName: "Sugerencia",
        flex: 1.5,
        minWidth: 250,
        wrapText: true,
        autoHeight: true,
        tooltipField: "sugerencia",
        cellStyle: { whiteSpace: "normal", lineHeight: "1.4", paddingTop: 4, paddingBottom: 4 },
      },
    ],
    []
  );

  // Summary cards data
  const summaryCards = [
    { titulo: "Total", valor: resumen.total || 0, color: "var(--primary-dark)", showChart: false },
    { titulo: "Quiebre de Stock", valor: resumen.quiebre_stock || 0, color: "var(--danger)", showChart: true },
    { titulo: "Bajo Stock Seg.", valor: resumen.bajo_stock_seguridad || 0, color: "var(--info)", showChart: true },
    { titulo: "Bajo Punto Pedido", valor: resumen.bajo_punto_pedido || 0, color: "var(--warning)", showChart: true },
    { titulo: "Sobrestock", valor: resumen.sobrestock || 0, color: "var(--warning-light)", showChart: true },
    { titulo: "Normal", valor: resumen.normal || 0, color: "var(--success)", showChart: true },
  ];

  const total = resumen.total || 1;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton
              onClick={() => navigate(-1)}
              sx={{
                color: "text.secondary",
                border: 1,
                borderColor: "transparent",
                "&:hover": {
                  color: "text.primary",
                  bgcolor: "background.paper",
                  borderColor: "divider",
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t("mrp_alertas_titulo", "Tablero de Alertas MRP")}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleExportXLSX}
              disabled={loading || exporting || filteredAlertas.length === 0}
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontSize: "12px",
                fontWeight: 500,
                color: "success.dark",
                borderColor: "success.light",
                "&:hover": {
                  bgcolor: "success.lighter",
                  borderColor: "success.light",
                },
                "&:disabled": {
                  opacity: 0.5,
                },
              }}
            >
              XLSX
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleExportPDF}
              disabled={loading || exporting || filteredAlertas.length === 0}
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontSize: "12px",
                fontWeight: 500,
                color: "error.dark",
                borderColor: "error.light",
                "&:hover": {
                  bgcolor: "error.lighter",
                  borderColor: "error.light",
                },
                "&:disabled": {
                  opacity: 0.5,
                },
              }}
            >
              PDF
            </Button>
          </Stack>
        </Stack>

        {/* Summary Cards */}
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            mb: 3,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.titulo}
              titulo={card.titulo}
              valor={card.valor}
              color={card.color}
              showChart={card.showChart}
              pct={card.showChart ? Math.round((card.valor / total) * 100) : 0}
              total={total}
            />
          ))}
        </Paper>

        {/* Filters */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Stack
            direction="row"
            flexWrap="wrap"
            alignItems="flex-end"
            spacing={2}
          >
            {/* Date Range Slider */}
            <Box sx={{ minWidth: 300 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                Desde{" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {sliderAFecha(rangoFechasLocal[0])}
                </Box>{" "}
                hasta{" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {sliderAFecha(rangoFechasLocal[1])}
                </Box>
              </Typography>
              <Slider
                value={rangoFechasLocal}
                onChange={(_, newValue) => setRangoFechasLocal(newValue)}
                min={0}
                max={365}
                size="small"
                sx={{
                  "& .MuiSlider-thumb": {
                    width: 14,
                    height: 14,
                  },
                }}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: "10px", color: "text.disabled" }}>
                  Hace 1 ano
                </Typography>
                <Typography sx={{ fontSize: "10px", color: "text.disabled" }}>
                  Hoy
                </Typography>
              </Stack>
            </Box>

            {/* Separator */}
            <Divider orientation="vertical" flexItem sx={{ height: 48, my: "auto" }} />

            {/* Centro */}
            <MultiSelect
              label="Centro"
              options={catalogos.centros || []}
              selected={filtros.centros}
              onChange={(val) => setFiltros((prev) => ({ ...prev, centros: val }))}
              keyField="codigo"
              labelField="nombre"
            />

            {/* Almacen */}
            <MultiSelect
              label="Almacen"
              options={catalogos.almacenes || []}
              selected={filtros.almacenes}
              onChange={(val) => setFiltros((prev) => ({ ...prev, almacenes: val }))}
              keyField="codigo"
              labelField="nombre"
            />

            {/* Sector */}
            <MultiSelect
              label="Sector"
              options={catalogos.sectores || []}
              selected={filtros.sectores}
              onChange={(val) => setFiltros((prev) => ({ ...prev, sectores: val }))}
              keyField="nombre"
              labelField="nombre"
            />

            {/* Estado */}
            <MultiSelect
              label="Estado"
              options={ESTADOS_OPTIONS}
              selected={filtros.estados}
              onChange={(val) => setFiltros((prev) => ({ ...prev, estados: val }))}
              keyField="value"
              labelField="label"
            />

            {/* Search */}
            <Box sx={{ minWidth: 140 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                Buscar
              </Typography>
              <TextField
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Codigo..."
                sx={{
                  "& .MuiInputBase-root": {
                    fontSize: "12px",
                  },
                  "& .MuiInputBase-input": {
                    py: 0.75,
                    px: 1.5,
                  },
                }}
              />
            </Box>

            {/* Clear Filters */}
            <Button
              size="small"
              variant="outlined"
              onClick={handleLimpiarFiltros}
              startIcon={<FilterListOffIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontSize: "12px",
                fontWeight: 500,
                color: "text.secondary",
                borderColor: "divider",
                "&:hover": {
                  color: "primary.main",
                  borderColor: "primary.light",
                },
              }}
            >
              Limpiar Filtros
            </Button>
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {/* AG Grid */}
        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <SPMAgGrid
            rowData={filteredAlertas}
            columnDefs={columnDefs}
            loading={loading}
            height={600}
            paginationPageSize={50}
            paginationPageSizeSelector={[20, 50, 100]}
            enableQuickFilter={true}
            exportFileName="alertas_mrp"
            emptyMessage="No hay alertas para mostrar"
            getRowId={(params) => params.data.codigo}
          />
        </Paper>
      </Box>
    </Box>
  );
}
