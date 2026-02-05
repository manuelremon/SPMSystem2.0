/**
 * MRPParametrizar - Configuración avanzada de parámetros MRP
 * ✨ Importación Excel + Cálculo automático + Revisión + Guardado
 *
 * Wizard 3 pasos:
 * 1. Importar Excel con códigos de material y demanda estimada
 * 2. Calcular parámetros MRP (SS, ROP, EOQ, Stock Máximo)
 * 3. Revisar y guardar en BD
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import * as XLSX from "xlsx";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CalculateIcon from "@mui/icons-material/Calculate";
import SaveIcon from "@mui/icons-material/Save";
import DownloadIcon from "@mui/icons-material/Download";

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS = ["Importar Excel", "Calcular Parámetros", "Revisar y Guardar"];

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
          setError("El archivo Excel está vacío");
          return;
        }

        // Validar columnas requeridas
        const firstRow = json[0];
        const missingCols = EXCEL_COLUMNS_REQUIRED.filter(col => !(col in firstRow));

        if (missingCols.length > 0) {
          setError(`Faltan columnas requeridas: ${missingCols.join(", ")}`);
          return;
        }

        setMateriales(json);
        setError(null);
        setSuccess(`${json.length} materiales importados correctamente`);
      } catch (err) {
        setError(`Error leyendo archivo: ${err.message}`);
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
      setError("No hay materiales para calcular");
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
          setError(`${response.data.total_errores} materiales con error`);
        } else {
          setSuccess(`${response.data.total_exitosos} parámetros calculados correctamente`);
          setActiveStep(2); // Avanzar a revisión
        }
      }
    } catch (err) {
      setError(`Error calculando parámetros: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // STEP 3: GUARDAR PARÁMETROS
  // ============================================================================

  const guardarParametros = async () => {
    if (parametrosCalculados.length === 0) {
      setError("No hay parámetros para guardar");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/mrp/parametros/guardar", {
        parametros: parametrosCalculados
      });

      if (response.data.ok) {
        setSuccess(`${response.data.guardados} materiales guardados correctamente`);
        // Navegar a portfolio MRP después de 2 segundos
        setTimeout(() => navigate("/mrp/portfolio"), 2000);
      }
    } catch (err) {
      setError(`Error guardando parámetros: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // AG GRID COLUMNS
  // ============================================================================

  const columnDefsImportados = useMemo(() => [
    { field: "codigo_material", headerName: "Código", flex: 0.3, minWidth: 100 },
    { field: "centro", headerName: "Centro", flex: 0.2, minWidth: 80 },
    { field: "almacen", headerName: "Almacén", flex: 0.2, minWidth: 80 },
    {
      field: "demanda_anual",
      headerName: "Demanda Anual",
      flex: 0.3,
      minWidth: 120,
      type: "numericColumn"
    },
    {
      field: "lead_time_dias",
      headerName: "Lead Time (días)",
      flex: 0.25,
      minWidth: 100,
      type: "numericColumn"
    },
    {
      field: "nivel_servicio",
      headerName: "Nivel Servicio",
      flex: 0.25,
      minWidth: 120,
      valueFormatter: (params) => params.value ? `${(params.value * 100).toFixed(1)}%` : "-"
    },
  ], []);

  const columnDefsCalculados = useMemo(() => [
    { field: "material_codigo", headerName: "Código", flex: 0.25, minWidth: 100, pinned: "left" },
    { field: "centro", headerName: "Centro", flex: 0.15, minWidth: 70 },
    { field: "almacen", headerName: "Almacén", flex: 0.15, minWidth: 70 },
    { field: "demanda_anual", headerName: "Demanda Anual", flex: 0.2, minWidth: 100, type: "numericColumn" },
    {
      field: "demanda_diaria",
      headerName: "Demanda Diaria",
      flex: 0.2,
      minWidth: 100,
      type: "numericColumn",
      valueFormatter: (params) => params.value ? params.value.toFixed(2) : "-"
    },
    {
      field: "stock_seguridad",
      headerName: "Stock Seguridad (SS)",
      flex: 0.2,
      minWidth: 120,
      type: "numericColumn",
      cellStyle: { fontWeight: 600, color: "#2563eb" }
    },
    {
      field: "punto_pedido",
      headerName: "Punto Pedido (ROP)",
      flex: 0.2,
      minWidth: 120,
      type: "numericColumn",
      cellStyle: { fontWeight: 600, color: "#059669" }
    },
    {
      field: "cantidad_pedido_eoq",
      headerName: "EOQ",
      flex: 0.2,
      minWidth: 100,
      type: "numericColumn",
      cellStyle: { fontWeight: 600, color: "#7c3aed" }
    },
    {
      field: "stock_maximo",
      headerName: "Stock Máximo",
      flex: 0.2,
      minWidth: 120,
      type: "numericColumn",
      cellStyle: { fontWeight: 600, color: "#dc2626" }
    },
    {
      field: "cobertura_ss_dias",
      headerName: "Cobertura SS (días)",
      flex: 0.25,
      minWidth: 130,
      type: "numericColumn",
      valueFormatter: (params) => params.value ? params.value.toFixed(1) : "-"
    },
    {
      field: "cobertura_eoq_dias",
      headerName: "Cobertura EOQ (días)",
      flex: 0.25,
      minWidth: 130,
      type: "numericColumn",
      valueFormatter: (params) => params.value ? params.value.toFixed(1) : "-"
    },
    {
      field: "pedidos_anuales",
      headerName: "Pedidos/Año",
      flex: 0.2,
      minWidth: 100,
      type: "numericColumn",
      valueFormatter: (params) => params.value ? params.value.toFixed(2) : "-"
    },
    {
      field: "nivel_servicio",
      headerName: "Nivel Servicio",
      flex: 0.2,
      minWidth: 120,
      valueFormatter: (params) => params.value ? `${(params.value * 100).toFixed(1)}%` : "-"
    },
    {
      field: "factor_z",
      headerName: "Factor Z",
      flex: 0.15,
      minWidth: 80,
      type: "numericColumn",
      valueFormatter: (params) => params.value ? params.value.toFixed(2) : "-"
    },
  ], []);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate("/mrp/portfolio")}>
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 700,
              color: "text.primary",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            {t("nav_mrp_parametrizar", "Parametrizar MRP")}
          </Typography>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Stepper */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* STEP 1: IMPORTAR */}
      {activeStep === 0 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Paso 1: Importar Materiales desde Excel
          </Typography>

          <Stack spacing={2} sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={descargarPlantillaExcel}
              sx={{ alignSelf: "flex-start" }}
            >
              Descargar Plantilla Excel
            </Button>

            <Button
              variant="contained"
              component="label"
              startIcon={<UploadFileIcon />}
              sx={{ alignSelf: "flex-start" }}
            >
              Subir Archivo Excel
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
                {materiales.length} materiales importados. Revisa los datos y presiona "Siguiente" para calcular parámetros.
              </Alert>

              <SPMAgGrid
                rowData={materiales}
                columnDefs={columnDefsImportados}
                height={400}
                pagination={true}
                paginationPageSize={10}
                enableQuickFilter={true}
                exportFileName="materiales_importados"
              />

              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(1)}
                >
                  Siguiente: Calcular Parámetros
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}

      {/* STEP 2: CALCULAR */}
      {activeStep === 1 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Paso 2: Calcular Parámetros MRP
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            Se calcularán automáticamente: Stock Seguridad, Punto Pedido, EOQ, Stock Máximo, Coberturas y Costos.
          </Alert>

          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveStep(0)}
            >
              Volver
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
              onClick={calcularParametros}
              disabled={loading || materiales.length === 0}
            >
              {loading ? "Calculando..." : "Calcular Parámetros"}
            </Button>
          </Stack>

          {parametrosCalculados.length > 0 && (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Parámetros calculados correctamente. Revisa los resultados y presiona "Siguiente" para guardar.
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
                >
                  Siguiente: Revisar y Guardar
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}

      {/* STEP 3: GUARDAR */}
      {activeStep === 2 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Paso 3: Revisar y Guardar Parámetros
          </Typography>

          <Alert severity="warning" sx={{ mb: 3 }}>
            Los parámetros se guardarán en la base de datos y sobrescribirán los valores actuales.
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

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveStep(1)}
            >
              Volver
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={guardarParametros}
              disabled={loading}
              color="success"
            >
              {loading ? "Guardando..." : "Guardar Parámetros"}
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
