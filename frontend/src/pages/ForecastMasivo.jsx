/**
 * ForecastMasivo - Página de forecast masivo de materiales
 * ✨ Migrado a SPMAgGrid para mejor rendimiento
 *
 * Permite analizar múltiples materiales simultáneamente
 * usando plantilla CSV para importación
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import forecastService from '../services/forecast';
import { TempDataBanner } from '../components/ui/TempDataBanner';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

// MUI Components
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Modelos disponibles
const MODELOS_INFO = {
  random_forest: { nombre: 'Random Forest', icono: '🌲' },
  gradient_boosting: { nombre: 'Gradient Boosting', icono: '🚀' },
  linear: { nombre: 'Regresión Lineal', icono: '📈' },
  xgboost: { nombre: 'XGBoost', icono: '⚡' },
  arima: { nombre: 'ARIMA', icono: '📊' },
  prophet: { nombre: 'Prophet', icono: '🔮' }
};

/**
 * Tabla de resultados migrada a SPMAgGrid
 */
function ResultadosTable({ data }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, idx) => ({ ...item, id: idx }));
  }, [data]);

  const columnDefs = useMemo(() => [
    {
      field: 'codigo',
      headerName: t('common_code', 'Código'),
      flex: 0.4,
      minWidth: 100,
      valueFormatter: (params) => params.value || '-',
    },
    {
      field: 'descripcion',
      headerName: t('common_description', 'Descripción'),
      flex: 0.8,
      minWidth: 150,
      valueFormatter: (params) => params.data?.descripcion || (params.data?.error ? params.data.error : '-'),
    },
    {
      field: 'exito',
      headerName: t('common_status', 'Estado'),
      flex: 0.35,
      minWidth: 100,
      cellRenderer: (params) => (
        <Chip
          label={params.data.exito ? 'OK' : 'Error'}
          size="small"
          sx={{
            bgcolor: params.data.exito ? 'var(--success-soft)' : 'var(--danger-soft)',
            color: params.data.exito ? 'var(--success)' : 'var(--danger)',
            fontWeight: 600,
            fontSize: '0.7rem',
          }}
        />
      ),
    },
    {
      field: 'mae',
      headerName: 'MAE',
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.metricas?.mae?.toFixed(2) || '-',
    },
    {
      field: 'rmse',
      headerName: 'RMSE',
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.metricas?.rmse?.toFixed(2) || '-',
    },
    {
      field: 'r2',
      headerName: 'R²',
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.metricas?.r2?.toFixed(4) || '-',
    },
    {
      field: 'prediccionTotal',
      headerName: t('common_prediction', 'Predicción'),
      flex: 0.3,
      minWidth: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.prediccionTotal?.toFixed(0) || '-',
    },
  ], [t]);

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={400}
      pagination={true}
      paginationPageSize={10}
      enableQuickFilter={true}
      exportFileName="forecast_resultados_masivos"
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  );
}

const ForecastMasivo = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Estado
  const [materialesImportados, setMaterialesImportados] = useState([]);
  const [modeloSeleccionado, setModeloSeleccionado] = useState('random_forest');
  const [diasPrediccion, setDiasPrediccion] = useState(30);
  const [modelosDisponibles, setModelosDisponibles] = useState(['random_forest', 'gradient_boosting', 'linear']);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [error, setError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Cargar modelos disponibles
  useEffect(() => {
    const loadModelos = async () => {
      try {
        const response = await forecastService.getModelsDisponibles();
        if (response.modelos) {
          setModelosDisponibles(response.modelos);
        }
      } catch (err) {
        console.error('Error cargando modelos:', err);
      }
    };
    loadModelos();
  }, []);

  // Descargar plantilla CSV
  const descargarPlantilla = useCallback(() => {
    const headers = ['codigo_material'];
    const ejemplos = [
      ['# Ingrese un código de material por fila'],
      ['# Ejemplo:'],
      ['MAT001'],
      ['MAT002'],
      ['MAT003']
    ];

    const csv = [headers.join(','), ...ejemplos.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_forecast_masivo.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Importar archivo CSV
  const importarArchivo = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;

        const lines = text.split(/\r?\n/);
        const materiales = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Ignorar líneas vacías y comentarios
          if (!line || line.startsWith('#') || line.toLowerCase() === 'codigo_material') continue;

          // Tomar el primer valor (en caso de CSV con múltiples columnas)
          const codigo = line.split(',')[0].trim().toUpperCase();
          if (codigo && !materiales.some(m => m.codigo === codigo)) {
            materiales.push({ codigo, id: `${codigo}-${i}` });
          }
        }

        if (materiales.length === 0) {
          setError(t('forecast_masivo_archivo_vacio', 'El archivo no contiene códigos de materiales válidos'));
          return;
        }

        setMaterialesImportados(materiales);
        setImportSuccess(true);
        setError(null);
        setResultados([]);

        // Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setError(t('forecast_masivo_error_importar', 'Error al procesar el archivo'));
      }
    };

    reader.readAsText(file);
    // Limpiar el input para permitir reimportar el mismo archivo
    event.target.value = '';
  }, [t]);

  // Eliminar material de la lista
  const eliminarMaterial = useCallback((id) => {
    setMaterialesImportados(prev => prev.filter(m => m.id !== id));
  }, []);

  // Ejecutar forecast masivo
  const ejecutarForecastMasivo = useCallback(async () => {
    if (materialesImportados.length === 0) {
      setError(t('forecast_masivo_sin_materiales', 'Importe una plantilla con códigos de materiales'));
      return;
    }

    setLoading(true);
    setError(null);
    setResultados([]);
    setProgreso({ actual: 0, total: materialesImportados.length });

    const resultadosTemp = [];

    for (let i = 0; i < materialesImportados.length; i++) {
      const { codigo } = materialesImportados[i];
      setProgreso({ actual: i + 1, total: materialesImportados.length });

      try {
        const resultado = await forecastService.getForecast(codigo, {
          dias: diasPrediccion,
          modelo: modeloSeleccionado
        });

        resultadosTemp.push({
          codigo,
          exito: true,
          metricas: resultado.metricas,
          prediccionTotal: resultado.predicciones?.reduce((sum, p) => sum + (p.prediccion || p.cantidad_predicha || 0), 0) || 0,
          descripcion: resultado.material?.descripcion || '',
          modelo: modeloSeleccionado
        });
      } catch (err) {
        resultadosTemp.push({
          codigo,
          exito: false,
          error: err.response?.data?.error || 'Error desconocido'
        });
      }

      setResultados([...resultadosTemp]);
    }

    setLoading(false);
  }, [materialesImportados, diasPrediccion, modeloSeleccionado, t]);

  // Exportar resultados a CSV
  const exportarCSV = useCallback(() => {
    if (resultados.length === 0) return;

    const headers = ['Código', 'Descripción', 'Estado', 'MAE', 'RMSE', 'R²', 'Predicción Total', 'Modelo'];
    const rows = resultados.map(r => [
      r.codigo,
      `"${(r.descripcion || '').replace(/"/g, '""')}"`,
      r.exito ? 'OK' : 'Error',
      r.metricas?.mae?.toFixed(2) || '',
      r.metricas?.rmse?.toFixed(2) || '',
      r.metricas?.r2?.toFixed(4) || '',
      r.prediccionTotal?.toFixed(0) || '',
      r.modelo || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast_masivo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [resultados]);

  // Estadísticas de resultados
  const stats = useMemo(() => {
    if (resultados.length === 0) return null;

    const exitosos = resultados.filter(r => r.exito);
    const fallidos = resultados.filter(r => !r.exito);

    return {
      total: resultados.length,
      exitosos: exitosos.length,
      fallidos: fallidos.length,
      maePromedio: exitosos.length > 0
        ? exitosos.reduce((sum, r) => sum + (r.metricas?.mae || 0), 0) / exitosos.length
        : 0,
      r2Promedio: exitosos.length > 0
        ? exitosos.reduce((sum, r) => sum + (r.metricas?.r2 || 0), 0) / exitosos.length
        : 0,
      prediccionTotal: exitosos.reduce((sum, r) => sum + (r.prediccionTotal || 0), 0)
    };
  }, [resultados]);

  const limpiar = useCallback(() => {
    setMaterialesImportados([]);
    setResultados([]);
    setError(null);
    setProgreso({ actual: 0, total: 0 });
    setImportSuccess(false);
  }, []);

  return (
    <Container maxWidth={false} sx={{ py: 2, px: "75px" }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "var(--fg-muted)" }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t('forecast_masivo_titulo', 'FORECAST MASIVO')}
        </Typography>
      </Box>

      {/* Banner de Modo Temporal */}
      <TempDataBanner />

      {/* Input file oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={importarArchivo}
        accept=".csv,.txt"
        style={{ display: 'none' }}
      />

      {/* Filtros - estilo Dashboard */}
      <Paper elevation={0} sx={{ mb: 3, border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ py: 1.5, px: 3, minHeight: "73px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, height: "100%" }}>
            {/* Plantilla */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mb: 0.5 }}>
                {t('forecast_masivo_plantilla', 'Plantilla')}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Tooltip title="Descargar plantilla CSV">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={descargarPlantilla}
                    startIcon={<FileDownloadIcon />}
                    sx={{
                      height: 36,
                      textTransform: "none",
                      fontSize: "0.75rem",
                      borderColor: "var(--border)",
                      color: "var(--fg-muted)",
                      "&:hover": { borderColor: "var(--primary)", color: "var(--primary)" }
                    }}
                  >
                    Descargar
                  </Button>
                </Tooltip>
                <Tooltip title="Importar archivo CSV con códigos">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    startIcon={<FileUploadIcon />}
                    sx={{
                      height: 36,
                      textTransform: "none",
                      fontSize: "0.75rem",
                      borderColor: materialesImportados.length > 0 ? "var(--success)" : "var(--border)",
                      color: materialesImportados.length > 0 ? "var(--success)" : "var(--fg-muted)",
                      bgcolor: materialesImportados.length > 0 ? "var(--success-soft)" : "transparent",
                      "&:hover": { borderColor: "var(--success)", color: "var(--success)", bgcolor: "var(--success-soft)" }
                    }}
                  >
                    Importar
                  </Button>
                </Tooltip>
              </Box>
            </Box>

            {/* Materiales importados */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 140 }}>
              <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mb: 0.5 }}>
                {t('forecast_masivo_materiales', 'Materiales')}
              </Typography>
              <Chip
                icon={materialesImportados.length > 0 ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : undefined}
                label={`${materialesImportados.length} importados`}
                size="small"
                sx={{
                  height: 36,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  bgcolor: materialesImportados.length > 0 ? "var(--success-soft)" : "var(--bg-soft)",
                  color: materialesImportados.length > 0 ? "var(--success)" : "var(--fg-muted)",
                  "& .MuiChip-icon": { color: "var(--success)" }
                }}
              />
            </Box>

            {/* Separador */}
            <Box sx={{ height: 40, width: 1, bgcolor: "var(--border)" }} />

            {/* Modelo */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Modelo</InputLabel>
              <Select
                value={modeloSeleccionado}
                onChange={(e) => setModeloSeleccionado(e.target.value)}
                disabled={loading}
                label="Modelo"
                sx={{ fontSize: "0.75rem" }}
              >
                {modelosDisponibles.map((modelo) => (
                  <MenuItem key={modelo} value={modelo} sx={{ fontSize: "0.75rem" }}>
                    {MODELOS_INFO[modelo]?.icono} {MODELOS_INFO[modelo]?.nombre || modelo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Horizonte */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Horizonte</InputLabel>
              <Select
                value={diasPrediccion}
                onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                disabled={loading}
                label="Horizonte"
                sx={{ fontSize: "0.75rem" }}
              >
                <MenuItem value={7}>7 días</MenuItem>
                <MenuItem value={14}>14 días</MenuItem>
                <MenuItem value={30}>1 mes</MenuItem>
                <MenuItem value={60}>2 meses</MenuItem>
                <MenuItem value={90}>3 meses</MenuItem>
              </Select>
            </FormControl>

            {/* Separador */}
            <Box sx={{ height: 40, width: 1, bgcolor: "var(--border)" }} />

            {/* Botón Ejecutar */}
            <Button
              variant="contained"
              onClick={ejecutarForecastMasivo}
              disabled={loading || materialesImportados.length === 0}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
              sx={{ height: 40, minWidth: 140, textTransform: "none", fontWeight: 600 }}
            >
              {loading ? `${progreso.actual}/${progreso.total}` : 'Ejecutar'}
            </Button>

            {/* Limpiar */}
            <Tooltip title="Limpiar todo">
              <IconButton
                onClick={limpiar}
                disabled={loading}
                size="small"
                sx={{ color: "var(--fg-muted)", "&:hover": { color: "var(--danger)" } }}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Mensaje de éxito de importación */}
      {importSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          {t('forecast_masivo_import_success', `Se importaron ${materialesImportados.length} materiales correctamente`)}
        </Alert>
      )}

      {/* Lista de materiales importados (preview) */}
      {materialesImportados.length > 0 && resultados.length === 0 && !loading && (
        <Paper elevation={0} sx={{ mb: 3, border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle2" fontWeight={600} color="var(--fg-strong)">
              {t('forecast_masivo_preview', 'Materiales a procesar')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {materialesImportados.length} materiales
            </Typography>
          </Box>
          <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 150, overflow: "auto" }}>
            {materialesImportados.map((m) => (
              <Chip
                key={m.id}
                label={m.codigo}
                size="small"
                onDelete={() => eliminarMaterial(m.id)}
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  bgcolor: "var(--bg-soft)",
                  "&:hover": { bgcolor: "var(--bg-soft)" }
                }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Progreso */}
      {loading && (
        <Paper elevation={0} sx={{ mb: 3, p: 2, border: "1px solid var(--border)", borderRadius: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>Procesando materiales...</Typography>
            <Typography variant="caption" color="text.secondary">{progreso.actual} de {progreso.total}</Typography>
          </Box>
          <LinearProgress variant="determinate" value={(progreso.actual / progreso.total) * 100} sx={{ height: 8, borderRadius: 4 }} />
        </Paper>
      )}

      {/* Estadísticas */}
      {stats && (
        <Paper elevation={0} sx={{ mb: 3, border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "stretch" }}>
            {[
              { label: "Total", value: stats.total, color: "var(--fg-strong)", bg: "var(--card)" },
              { label: "Exitosos", value: stats.exitosos, color: "var(--success)", bg: "var(--success-soft)" },
              { label: "Fallidos", value: stats.fallidos, color: "var(--danger)", bg: "var(--danger-soft)" },
              { label: "MAE Prom.", value: stats.maePromedio.toFixed(2), color: "var(--primary)", bg: "var(--primary-soft)" },
              { label: "R² Prom.", value: stats.r2Promedio.toFixed(4), color: "var(--purple)", bg: "var(--purple-soft)" },
              { label: "Demanda Total", value: Math.round(stats.prediccionTotal).toLocaleString(), color: "var(--warning)", bg: "var(--warning-soft)" },
            ].map((item, idx, arr) => (
              <Box
                key={item.label}
                sx={{
                  flex: 1,
                  p: 2,
                  textAlign: "center",
                  bgcolor: item.bg,
                  borderRight: idx < arr.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: item.color }}>
                  {item.value}
                </Typography>
                <Typography variant="caption" sx={{ color: "var(--fg-muted)", textTransform: "uppercase", fontWeight: 600, fontSize: "0.65rem" }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Tabla de resultados */}
      {resultados.length > 0 && (
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
              {t('forecast_masivo_resultados', 'Resultados')}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={exportarCSV}
              sx={{ textTransform: "none", color: "var(--success)", borderColor: "var(--success)", "&:hover": { bgcolor: "var(--success-soft)", borderColor: "var(--success)" } }}
            >
              Exportar CSV
            </Button>
          </Box>

          <ResultadosTable data={resultados} />
        </Paper>
      )}

      {/* Estado vacío */}
      {materialesImportados.length === 0 && resultados.length === 0 && !loading && (
        <Paper elevation={0} sx={{ p: 8, border: "1px solid var(--border)", borderRadius: 2, textAlign: "center" }}>
          <PlaylistAddIcon sx={{ fontSize: 64, color: "var(--border)", mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="var(--fg-strong)" gutterBottom>
            {t('forecast_masivo_empty_titulo', 'Analiza múltiples materiales')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: "auto", mb: 3 }}>
            {t('forecast_masivo_empty_descripcion', 'Descarga la plantilla CSV, complétala con los códigos de materiales e impórtala para ejecutar el forecast masivo.')}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={descargarPlantilla}
              sx={{ textTransform: "none" }}
            >
              1. Descargar plantilla
            </Button>
            <Button
              variant="contained"
              startIcon={<FileUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: "none" }}
            >
              2. Importar plantilla
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default ForecastMasivo;
