/**
 * MRPTableroAlertas - Tablero de Alertas MRP
 * SAP/Enterprise UI - Migrated to MUI components
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "../context/i18n";
import useToast from "../hooks/useToast";
import api from "../services/api";
import { formatNumber } from "../utils/formatters";
import PageLayout from "../components/ui/PageLayout";
import EmptyState from "../components/ui/EmptyState";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Slider from "@mui/material/Slider";
import Menu from "@mui/material/Menu";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";

// MUI Icons
import DownloadIcon from "@mui/icons-material/Download";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";


/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const ESTADOS_OPTIONS = [
  { value: "quiebre", label: "Quiebre de stock" },
  { value: "bajo punto", label: "Bajo punto de pedido" },
  { value: "bajo stock", label: "Bajo stock de seguridad" },
  { value: "exceso", label: "Exceso / sobrestock" },
  { value: "normal", label: "Normal" },
];

const numFormatter = (params) => formatNumber(Math.round(params.value || 0));

/** "SOBRESTOCK CRÍTICO" -> "Sobrestock crítico" */
function toSentenceCase(value) {
  if (!value || typeof value !== "string") return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const estadoColors = {
  danger: { color: "var(--danger)" },
  warning: { color: "var(--warning)" },
  success: { color: "var(--success)" },
  info: { color: "var(--info)" },
};

/* ─────────────────────────────────────────────────────────────
   Multi-Select Dropdown Component
───────────────────────────────────────────────────────────── */
function MultiSelect({ label, options, selected, onChange, keyField = "codigo", labelField = "nombre" }) {
  const { t } = useI18n();
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
      ? t("mrp_ninguno", "Ninguno")
      : selected.length === 1
      ? selected[0]
      : `${selected.length} ${t("mrp_seleccionados", "seleccionados")}`;

  return (
    <Box sx={{ minWidth: { xs: "100%", sm: 150 } }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 600,
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
          fontSize: "var(--text-sm)",
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
            primary={t("common_seleccionar_todos", "Seleccionar todos")}
            primaryTypographyProps={{
              fontSize: "var(--text-sm)",
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
                  fontSize: "var(--text-sm)",
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
function SummaryCard({ titulo, valor, color, pct, showChart }) {
  const { t } = useI18n();
  return (
    <Box
      sx={{
        flex: { xs: "1 1 45%", sm: "1 1 30%", md: 1 },
        minWidth: 0,
        py: 2,
        px: 2,
        borderRight: { md: 1 },
        borderBottom: { xs: 1, md: 0 },
        borderColor: "divider",
        "&:last-child": {
          borderRight: 0,
        },
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, color }}>
        {formatNumber(valor)}
      </Typography>
      {showChart ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, pct))}
            aria-label={titulo}
            sx={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: "var(--bg-soft)",
              "& .MuiLinearProgress-bar": { backgroundColor: color, borderRadius: 3 },
            }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, minWidth: 36, textAlign: "right" }}>
            {formatNumber(pct)}%
          </Typography>
        </Box>
      ) : (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("mrp_alertas_materiales_analizados", "Materiales analizados")}
        </Typography>
      )}
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────────────────── */
export default function MRPTableroAlertas() {
  const { t } = useI18n();
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
      } catch {
        // Sin catálogos: los filtros quedan vacíos
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
        setError(t("mrp_alertas_error_carga", "No se pudieron cargar las alertas MRP. Intenta nuevamente."));
      }
    } catch (err) {
      setError(t("mrp_alertas_error_carga", "No se pudieron cargar las alertas MRP. Intenta nuevamente."));
    } finally {
      setLoading(false);
    }
  }, [filtros, catalogos, t]);

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

  // Exportar a PDF
  const handleExportPDF = useCallback(() => {
    if (filteredAlertas.length === 0) return;
    setExporting(true);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.warning(t("mrp_alertas_permitir_popups", "Permite las ventanas emergentes para exportar a PDF"));
      setExporting(false);
      return;
    }

    // PDF colors (must be hardcoded since CSS variables don't work in separate document)
    const pdfColors = {
      primaryDark: getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim() || '#1565c0',
      danger: getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#ef4444',
      info: getComputedStyle(document.documentElement).getPropertyValue('--info').trim() || '#0ea5e9',
      warning: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#f59e0b',
      warningLight: getComputedStyle(document.documentElement).getPropertyValue('--warning-light').trim() || '#f59e0b',
      success: getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#22c55e',
      border: getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e2e8f0',
      fgMuted: getComputedStyle(document.documentElement).getPropertyValue('--fg-muted').trim() || '#64748b',
      fgStrong: getComputedStyle(document.documentElement).getPropertyValue('--fg-strong').trim() || '#1e293b',
      bgSoft: getComputedStyle(document.documentElement).getPropertyValue('--bg-soft').trim() || '#f8fafc',
    };

    const cardsData = [
      { titulo: "Total", valor: resumen.total || 0, color: pdfColors.primaryDark },
      { titulo: "Quiebre de stock", valor: resumen.quiebre_stock || 0, color: pdfColors.danger },
      { titulo: "Bajo stock de seguridad", valor: resumen.bajo_stock_seguridad || 0, color: pdfColors.info },
      { titulo: "Bajo punto de pedido", valor: resumen.bajo_punto_pedido || 0, color: pdfColors.warning },
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
      "Descripción",
      "Demanda",
      "Cons. prom.",
      "SS",
      "PP",
      "SM",
      "Stock",
      "Ped. curso",
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
        <title>Tablero de alertas MRP</title>
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
        <h1>Tablero de alertas MRP</h1>
        <div class="fecha">Fecha de exportación: ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
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
  }, [filteredAlertas, resumen, toast, t]);

  // Columnas del DataGrid - AG Grid format
  const columnDefs = useMemo(
    () => [
      {
        field: "codigo",
        headerName: t("mrp_col_material", "Material"),
        flex: 0.7,
        minWidth: 120,
      },
      {
        field: "descripcion",
        headerName: t("mrp_col_descripcion", "Descripción"),
        flex: 1.5,
        minWidth: 220,
        tooltipField: "descripcion",
      },
      {
        field: "demanda_estimada_anual",
        headerName: t("mrp_col_demanda", "Demanda"),
        headerTooltip: t("mrp_col_demanda_tooltip", "Demanda estimada anual"),
        flex: 0.5,
        minWidth: 110,
        type: "rightAligned",
        valueFormatter: numFormatter,
      },
      {
        field: "consumo_promedio_anual",
        headerName: t("mrp_col_consumo", "Consumo"),
        headerTooltip: t("mrp_col_consumo_tooltip", "Consumo promedio anual"),
        flex: 0.5,
        minWidth: 110,
        type: "rightAligned",
        valueFormatter: numFormatter,
      },
      {
        field: "stock_seguridad",
        headerName: t("mrp_col_ss", "SS"),
        headerTooltip: t("mrp_col_ss_tooltip", "Stock de seguridad"),
        flex: 0.4,
        minWidth: 80,
        type: "rightAligned",
        valueFormatter: numFormatter,
      },
      {
        field: "punto_pedido",
        headerName: t("mrp_col_pp", "PP"),
        headerTooltip: t("mrp_col_pp_tooltip", "Punto de pedido"),
        flex: 0.4,
        minWidth: 80,
        type: "rightAligned",
        valueFormatter: numFormatter,
      },
      {
        field: "stock_maximo",
        headerName: t("mrp_col_sm", "SM"),
        headerTooltip: t("mrp_col_sm_tooltip", "Stock máximo"),
        flex: 0.4,
        minWidth: 80,
        type: "rightAligned",
        valueFormatter: numFormatter,
      },
      {
        field: "stock_actual",
        headerName: t("mrp_col_stock", "Stock"),
        headerTooltip: t("mrp_col_stock_tooltip", "Stock actual"),
        flex: 0.4,
        minWidth: 90,
        type: "rightAligned",
        cellRenderer: (params) => {
          const stock = params.value || 0;
          const pp = params.data.punto_pedido || 0;
          let color = "success.main";
          if (stock <= 0) color = "error.main";
          else if (stock < pp) color = "warning.main";
          return (
            <Typography component="span" sx={{ fontWeight: 600, color, fontSize: "inherit" }}>
              {formatNumber(stock)}
            </Typography>
          );
        },
      },
      {
        field: "pedidos_en_curso",
        headerName: t("mrp_col_pedidos", "En curso"),
        headerTooltip: t("mrp_col_pedidos_tooltip", "Pedidos en curso"),
        flex: 0.5,
        minWidth: 100,
        type: "rightAligned",
        valueFormatter: numFormatter,
      },
      {
        field: "rotacion_pct",
        headerName: t("mrp_col_rotacion", "Rotación"),
        headerTooltip: t("mrp_col_rotacion_tooltip", "Rotación anual (%)"),
        flex: 0.5,
        minWidth: 110,
        type: "rightAligned",
        cellRenderer: (params) => {
          const rot = Math.round(params.value || 0);
          let color = "error.main";
          if (rot > 300) color = "success.main";
          else if (rot > 100) color = "warning.main";
          return (
            <Typography component="span" sx={{ fontWeight: 600, color, fontSize: "inherit" }}>
              {formatNumber(rot)}%
            </Typography>
          );
        },
      },
      {
        field: "estado",
        headerName: t("mrp_col_estado", "Estado"),
        flex: 0.8,
        minWidth: 180,
        valueFormatter: (params) => toSentenceCase(params.value) || "-",
        cellRenderer: (params) => {
          const clase = params.data.estado_clase || "info";
          const colors = estadoColors[clase] || estadoColors.info;
          return (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: colors.color, flexShrink: 0 }} />
              <Typography component="span" sx={{ fontSize: "var(--text-xs)", fontWeight: 600, color: colors.color }}>
                {toSentenceCase(params.value) || "-"}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: "sugerencia",
        headerName: t("mrp_col_sugerencia", "Sugerencia"),
        flex: 1.5,
        minWidth: 250,
        wrapText: true,
        autoHeight: true,
        tooltipField: "sugerencia",
        cellStyle: { whiteSpace: "normal", lineHeight: "1.4", paddingTop: 4, paddingBottom: 4 },
      },
    ],
    [t]
  );

  // Summary cards data
  const summaryCards = [
    { titulo: t("mrp_alertas_card_total", "Total"), valor: resumen.total || 0, color: "var(--primary)", showChart: false },
    { titulo: t("mrp_alertas_card_quiebre", "Quiebre de stock"), valor: resumen.quiebre_stock || 0, color: "var(--danger)", showChart: true },
    { titulo: t("mrp_alertas_card_bajo_ss", "Bajo stock de seguridad"), valor: resumen.bajo_stock_seguridad || 0, color: "var(--info)", showChart: true },
    { titulo: t("mrp_alertas_card_bajo_pp", "Bajo punto de pedido"), valor: resumen.bajo_punto_pedido || 0, color: "var(--warning)", showChart: true },
    { titulo: t("mrp_alertas_card_sobrestock", "Sobrestock"), valor: resumen.sobrestock || 0, color: "var(--warning)", showChart: true },
    { titulo: t("mrp_alertas_card_normal", "Normal"), valor: resumen.normal || 0, color: "var(--success)", showChart: true },
  ];

  const total = resumen.total || 1;

  return (
    <PageLayout
      title={t("mrp_alertas_titulo", "Tablero de alertas MRP")}
      actions={
        <Button
          size="small"
          variant="outlined"
          onClick={handleExportPDF}
          disabled={loading || exporting || filteredAlertas.length === 0}
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: "none" }}
        >
          {t("mrp_alertas_exportar_pdf", "Exportar PDF")}
        </Button>
      }
    >

        {/* Summary Cards */}
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            flexWrap: { xs: "wrap", md: "nowrap" },
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
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
            />
          ))}
        </Paper>

        {/* Filters */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Stack
            direction="row"
            flexWrap="wrap"
            alignItems="flex-end"
            gap={2}
          >
            {/* Date Range Slider */}
            <Box sx={{ width: { xs: "100%", sm: 300 } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("mrp_rango_desde", "Desde")}{" "}
                <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                  {sliderAFecha(rangoFechasLocal[0])}
                </Box>{" "}
                {t("mrp_rango_hasta", "hasta")}{" "}
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
                <Typography sx={{ fontSize: "var(--text-2xs)", color: "text.disabled" }}>
                  {t("mrp_hace_un_anio", "Hace 1 año")}
                </Typography>
                <Typography sx={{ fontSize: "var(--text-2xs)", color: "text.disabled" }}>
                  {t("mrp_hoy", "Hoy")}
                </Typography>
              </Stack>
            </Box>

            {/* Separator */}
            <Divider orientation="vertical" flexItem sx={{ height: 48, my: "auto", display: { xs: "none", md: "block" } }} />

            {/* Centro */}
            <MultiSelect
              label={t("mrp_filtro_centro", "Centro")}
              options={catalogos.centros || []}
              selected={filtros.centros}
              onChange={(val) => setFiltros((prev) => ({ ...prev, centros: val }))}
              keyField="codigo"
              labelField="nombre"
            />

            {/* Almacen */}
            <MultiSelect
              label={t("mrp_filtro_almacen", "Almacén")}
              options={catalogos.almacenes || []}
              selected={filtros.almacenes}
              onChange={(val) => setFiltros((prev) => ({ ...prev, almacenes: val }))}
              keyField="codigo"
              labelField="nombre"
            />

            {/* Sector */}
            <MultiSelect
              label={t("mrp_filtro_sector", "Sector")}
              options={catalogos.sectores || []}
              selected={filtros.sectores}
              onChange={(val) => setFiltros((prev) => ({ ...prev, sectores: val }))}
              keyField="nombre"
              labelField="nombre"
            />

            {/* Estado */}
            <MultiSelect
              label={t("mrp_filtro_estado", "Estado")}
              options={ESTADOS_OPTIONS}
              selected={filtros.estados}
              onChange={(val) => setFiltros((prev) => ({ ...prev, estados: val }))}
              keyField="value"
              labelField="label"
            />

            {/* Search */}
            <Box sx={{ minWidth: { xs: "100%", sm: 180 } }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  fontWeight: 600,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {t("mrp_buscar", "Buscar")}
              </Typography>
              <TextField
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("mrp_alertas_buscar_placeholder", "Código o descripción...")}
                fullWidth
                sx={{
                  "& .MuiInputBase-root": {
                    fontSize: "var(--text-sm)",
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
                textTransform: "none",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: "text.secondary",
                borderColor: "divider",
                "&:hover": {
                  color: "primary.main",
                  borderColor: "primary.light",
                },
              }}
            >
              {t("mrp_limpiar_filtros", "Limpiar filtros")}
            </Button>
          </Stack>
        </Paper>

        {/* Tabla (o un unico mensaje de error si la carga falla) */}
        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
          }}
        >
          {error && !loading ? (
            <EmptyState
              title={t("mrp_alertas_error_titulo", "No se pudieron cargar las alertas")}
              description={error}
              action={t("mrp_reintentar", "Reintentar")}
              onAction={fetchAlertas}
            />
          ) : (
            <SPMAgGrid
              rowData={filteredAlertas}
              columnDefs={columnDefs}
              loading={loading}
              height={600}
              paginationPageSize={25}
              enableQuickFilter={true}
              exportFileName="alertas_mrp"
              emptyMessage={t("mrp_alertas_vacio", "No hay alertas para mostrar")}
              getRowId={(params) => params.data.codigo}
            />
          )}
        </Paper>
    </PageLayout>
  );
}
