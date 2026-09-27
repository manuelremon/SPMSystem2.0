/**
 * MRPParametrizar - Configuración avanzada de parámetros MRP
 * ✨ Importación Excel + Cálculo automático + Revisión + Guardado
 *
 * Wizard 3 pasos:
 * 1. Importar Excel con códigos de material y demanda estimada
 * 2. Calcular parámetros MRP (SS, ROP, EOQ, Stock Máximo)
 * 3. Revisar y guardar en BD
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import PageLayout from "../components/ui/PageLayout";
import { formatNumber } from "../utils/formatters";
import * as XLSX from "xlsx";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CalculateIcon from "@mui/icons-material/Calculate";
import SaveIcon from "@mui/icons-material/Save";
import DownloadIcon from "@mui/icons-material/Download";

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS = [
  ["mrp_param_paso_importar", "Importar Excel"],
  ["mrp_param_paso_calcular", "Calcular parámetros"],
  ["mrp_param_paso_revisar", "Revisar y guardar"],
];

/** Numero con coma decimal (redondeado a `dec` decimales) o "-" */
const fmtDec = (value, dec = 2) => {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "-";
  const f = 10 ** dec;
  return formatNumber(Math.round(Number(value) * f) / f);
};
const fmtPct = (value) => (value ? `${fmtDec(value * 100, 1)}%` : "-");

const EXCEL_COLUMNS_REQUIRED = [
  "codigo_material",
  "centro",
  "almacen",
  "demanda_anual"
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MRPParametrizar() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [materiales, setMateriales] = useState([]);
  const [parametrosCalculados, setParametrosCalculados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // ============================================================================
  // STEP 1: IMPORTAR EXCEL
  // ============================================================================

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        // Validar que no esté vacío
        if (json.length === 0) {
          setError(t("mrp_param_excel_vacio", "El archivo Excel está vacío"));
          return;
        }

        // Validar columnas requeridas
        const firstRow = json[0];
        const missingCols = EXCEL_COLUMNS_REQUIRED.filter(col => !(col in firstRow));

        if (missingCols.length > 0) {
          setError(`${t("mrp_param_faltan_columnas", "Faltan columnas requeridas")}: ${missingCols.join(", ")}`);
          return;
        }

        setMateriales(json);
        setError(null);
        setSuccess(`${formatNumber(json.length)} ${t("mrp_param_importados_ok", "materiales importados correctamente")}`);
      } catch (err) {
        setError(t("mrp_param_error_leer", "No se pudo leer el archivo. Verifica que sea un Excel válido."));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const descargarPlantillaExcel = () => {
    const plantilla = [
      {
        codigo_material: "10000123",
        centro: "1000",
        almacen: "0001",
        demanda_anual: 1200,
        lead_time_dias: 30,
        desv_std_demanda_diaria: 1.5,
        desv_std_lead_time: 5,
        costo_unitario: 500,
        costo_por_pedido: 150,
        tasa_mantenimiento: 0.20,
        nivel_servicio: 0.95,
        cantidad_minima_pedido: 10,
        multiplo_pedido: 1,
        categoria_abc: "A",
        critico: false
      }
    ];

    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parametros MRP");
    XLSX.writeFile(wb, "plantilla_parametros_mrp.xlsx");
  };

  // ============================================================================
  // STEP 2: CALCULAR PARÁMETROS
  // ============================================================================

  const calcularParametros = async () => {
    if (materiales.length === 0) {
      setError(t("mrp_param_sin_materiales", "No hay materiales para calcular"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/mrp/parametros/calcular", {
        materiales: materiales,
        configuracion_global: {}
      });

      if (response.data.ok) {
        setParametrosCalculados(response.data.resultados);
        if (response.data.total_errores > 0) {
          setError(`${formatNumber(response.data.total_errores)} ${t("mrp_param_materiales_con_error", "materiales con error")}`);
        } else {
          setSuccess(`${formatNumber(response.data.total_exitosos)} ${t("mrp_param_calculados_ok", "parámetros calculados correctamente")}`);
          setActiveStep(2); // Avanzar a revisión
        }
      }
    } catch (err) {
      setError(t("mrp_param_error_calcular", "No se pudieron calcular los parámetros. Intenta nuevamente."));
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // STEP 3: GUARDAR PARÁMETROS
  // ============================================================================

  const guardarParametros = async () => {
    if (parametrosCalculados.length === 0) {
      setError(t("mrp_param_sin_parametros", "No hay parámetros para guardar"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/mrp/parametros/guardar", {
        parametros: parametrosCalculados
      });

      if (response.data.ok) {
        setSuccess(`${formatNumber(response.data.guardados)} ${t("mrp_param_guardados_ok", "materiales guardados correctamente")}`);
        // Navegar a portfolio MRP después de 2 segundos
        setTimeout(() => navigate("/mrp/portfolio"), 2000);
      }
    } catch (err) {
      setError(t("mrp_param_error_guardar", "No se pudieron guardar los parámetros. Intenta nuevamente."));
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // AG GRID COLUMNS
  // ============================================================================

  const columnDefsImportados = useMemo(() => [
    { field: "codigo_material", headerName: t("mrp_param_col_codigo", "Código"), flex: 0.3, minWidth: 110 },
    { field: "centro", headerName: t("mrp_param_col_centro", "Centro"), flex: 0.2, minWidth: 90 },
    { field: "almacen", headerName: t("mrp_param_col_almacen", "Almacén"), flex: 0.2, minWidth: 100 },
    {
      field: "demanda_anual",
      headerName: t("mrp_param_col_demanda_anual", "Demanda anual"),
      flex: 0.3,
      minWidth: 130,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 2),
    },
    {
      field: "lead_time_dias",
      headerName: t("mrp_param_col_lead_time", "Lead time (días)"),
      flex: 0.25,
      minWidth: 140,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 1),
    },
    {
      field: "nivel_servicio",
      headerName: t("mrp_param_col_nivel_servicio", "Nivel de servicio"),
      flex: 0.25,
      minWidth: 140,
      type: "rightAligned",
      valueFormatter: (params) => fmtPct(params.value),
    },
  ], [t]);

  const columnDefsCalculados = useMemo(() => [
    { field: "material_codigo", headerName: t("mrp_param_col_codigo", "Código"), flex: 0.25, minWidth: 110, pinned: "left" },
    { field: "centro", headerName: t("mrp_param_col_centro", "Centro"), flex: 0.15, minWidth: 90 },
    { field: "almacen", headerName: t("mrp_param_col_almacen", "Almacén"), flex: 0.15, minWidth: 100 },
    {
      field: "demanda_anual",
      headerName: t("mrp_param_col_demanda_anual", "Demanda anual"),
      flex: 0.2,
      minWidth: 130,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 2),
    },
    {
      field: "demanda_diaria",
      headerName: t("mrp_param_col_demanda_diaria", "Demanda diaria"),
      flex: 0.2,
      minWidth: 130,
      type: "rightAligned",
      valueFormatter: (params) => (params.value ? fmtDec(params.value, 2) : "-"),
    },
    {
      field: "stock_seguridad",
      headerName: t("mrp_param_col_ss", "Stock de seguridad"),
      headerTooltip: t("mrp_param_col_ss_tooltip", "Stock de seguridad (SS)"),
      flex: 0.2,
      minWidth: 150,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 2),
      cellStyle: { fontWeight: 600, color: "var(--info)" },
    },
    {
      field: "punto_pedido",
      headerName: t("mrp_param_col_rop", "Punto de pedido"),
      headerTooltip: t("mrp_param_col_rop_tooltip", "Punto de pedido (ROP)"),
      flex: 0.2,
      minWidth: 140,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 2),
      cellStyle: { fontWeight: 600, color: "var(--success)" },
    },
    {
      field: "cantidad_pedido_eoq",
      headerName: t("mrp_param_col_eoq", "EOQ"),
      headerTooltip: t("mrp_param_col_eoq_tooltip", "Cantidad económica de pedido"),
      flex: 0.2,
      minWidth: 100,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 2),
      cellStyle: { fontWeight: 600, color: "var(--purple-dark)" },
    },
    {
      field: "stock_maximo",
      headerName: t("mrp_param_col_stock_max", "Stock máximo"),
      flex: 0.2,
      minWidth: 130,
      type: "rightAligned",
      valueFormatter: (params) => fmtDec(params.value, 2),
      cellStyle: { fontWeight: 600, color: "var(--danger)" },
    },
    {
      field: "cobertura_ss_dias",
      headerName: t("mrp_param_col_cob_ss", "Cobertura SS (días)"),
      flex: 0.25,
      minWidth: 160,
      type: "rightAligned",
      valueFormatter: (params) => (params.value ? fmtDec(params.value, 1) : "-"),
    },
    {
      field: "cobertura_eoq_dias",
      headerName: t("mrp_param_col_cob_eoq", "Cobertura EOQ (días)"),
      flex: 0.25,
      minWidth: 170,
      type: "rightAligned",
      valueFormatter: (params) => (params.value ? fmtDec(params.value, 1) : "-"),
    },
    {
      field: "pedidos_anuales",
      headerName: t("mrp_param_col_pedidos_anio", "Pedidos por año"),
      flex: 0.2,
      minWidth: 140,
      type: "rightAligned",
      valueFormatter: (params) => (params.value ? fmtDec(params.value, 2) : "-"),
    },
    {
      field: "nivel_servicio",
      headerName: t("mrp_param_col_nivel_servicio", "Nivel de servicio"),
      flex: 0.2,
      minWidth: 140,
      type: "rightAligned",
      valueFormatter: (params) => fmtPct(params.value),
    },
    {
      field: "factor_z",
      headerName: t("mrp_param_col_factor_z", "Factor Z"),
      flex: 0.15,
      minWidth: 100,
      type: "rightAligned",
      valueFormatter: (params) => (params.value ? fmtDec(params.value, 2) : "-"),
    },
  ], [t]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PageLayout title={t("mrp_param_titulo", "Parametrizar MRP")} backTo="/mrp/portfolio">
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Stepper */}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map(([key, label]) => (
            <Step key={key}>
              <StepLabel>{t(key, label)}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* STEP 1: IMPORTAR */}
      {activeStep === 0 && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("mrp_param_paso1_titulo", "Paso 1: importar materiales desde Excel")}
          </Typography>

          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={descargarPlantillaExcel}
              sx={{ textTransform: "none" }}
            >
              {t("mrp_param_descargar_plantilla_btn", "Descargar plantilla Excel")}
            </Button>

            <Button
              variant="contained"
              component="label"
              startIcon={<UploadFileIcon />}
              sx={{ textTransform: "none" }}
            >
              {t("mrp_param_subir_archivo_btn", "Subir archivo Excel")}
              <input
                type="file"
                hidden
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
              />
            </Button>
          </Stack>

          {materiales.length > 0 && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {formatNumber(materiales.length)} {t("mrp_param_info_importados", "materiales importados. Revisa los datos y presiona «Siguiente» para calcular los parámetros.")}
              </Alert>

              <SPMAgGrid
                rowData={materiales}
                columnDefs={columnDefsImportados}
                height={400}
                pagination={true}
                paginationPageSize={25}
                enableQuickFilter={true}
                exportFileName="materiales_importados"
              />

              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(1)}
                  sx={{ textTransform: "none" }}
                >
                  {t("mrp_param_siguiente_calcular", "Siguiente: calcular parámetros")}
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}

      {/* STEP 2: CALCULAR */}
      {activeStep === 1 && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("mrp_param_paso2_titulo", "Paso 2: calcular parámetros MRP")}
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            {t("mrp_param_info_calculo", "Se calcularán automáticamente: stock de seguridad, punto de pedido, EOQ, stock máximo, coberturas y costos.")}
          </Alert>

          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveStep(0)}
              sx={{ textTransform: "none" }}
            >
              {t("mrp_param_volver", "Volver")}
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
              onClick={calcularParametros}
              disabled={loading || materiales.length === 0}
              sx={{ textTransform: "none" }}
            >
              {loading ? t("mrp_param_calculando", "Calculando...") : t("mrp_param_calcular_btn", "Calcular parámetros")}
            </Button>
          </Stack>

          {parametrosCalculados.length > 0 && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                {t("mrp_param_info_calculados", "Parámetros calculados correctamente. Revisa los resultados y presiona «Siguiente» para guardar.")}
              </Alert>

              <SPMAgGrid
                rowData={parametrosCalculados}
                columnDefs={columnDefsCalculados}
                height={500}
                pagination={true}
                paginationPageSize={25}
                enableQuickFilter={true}
                exportFileName="parametros_calculados"
              />

              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(2)}
                  sx={{ textTransform: "none" }}
                >
                  {t("mrp_param_siguiente_revisar", "Siguiente: revisar y guardar")}
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}

      {/* STEP 3: GUARDAR */}
      {activeStep === 2 && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("mrp_param_paso3_titulo", "Paso 3: revisar y guardar parámetros")}
          </Typography>

          <Alert severity="warning" sx={{ mb: 3 }}>
            {t("mrp_param_alerta_guardado", "Los parámetros se guardarán en la base de datos y sobrescribirán los valores actuales.")}
          </Alert>

          <SPMAgGrid
            rowData={parametrosCalculados}
            columnDefs={columnDefsCalculados}
            height={500}
            pagination={true}
            paginationPageSize={25}
            enableQuickFilter={true}
            exportFileName="parametros_finales"
          />

          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveStep(1)}
              sx={{ textTransform: "none" }}
            >
              {t("mrp_param_volver", "Volver")}
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={guardarParametros}
              disabled={loading}
              color="success"
              sx={{ textTransform: "none" }}
            >
              {loading ? t("mrp_param_guardando", "Guardando...") : t("mrp_param_guardar_btn", "Guardar parámetros")}
            </Button>
          </Stack>
        </Paper>
      )}
    </PageLayout>
  );
}
