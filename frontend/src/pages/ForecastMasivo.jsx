/**
 * ForecastMasivo - Página de forecast masivo de materiales
 * ✨ Migrado a SPMAgGrid para mejor rendimiento
 *
 * Permite analizar múltiples materiales simultáneamente
 * usando plantilla CSV para importación
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../context/i18n';
import forecastService from '../services/forecast';
import { TempDataBanner } from '../components/ui/TempDataBanner';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import { formatNumber } from '../utils/formatters';

// MUI Components
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
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DownloadIcon from '@mui/icons-material/Download';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Modelos disponibles
const MODELOS_INFO = {
  random_forest: { nombre: 'Random Forest' },
  gradient_boosting: { nombre: 'Gradient Boosting' },
  linear: { nombre: 'Regresión lineal' },
  xgboost: { nombre: 'XGBoost' },
  arima: { nombre: 'ARIMA' },
  prophet: { nombre: 'Prophet' }
};

// Formatea con coma decimal (es-ES) y cantidad fija de decimales
const fmtDec = (v, dec) => formatNumber(Number(v).toFixed(dec));

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
          label={params.data.exito ? t('forecast_masivo_ok', 'Correcto') : t('common_error', 'Error')}
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
      valueFormatter: (params) => params.data?.metricas?.mae != null ? fmtDec(params.data.metricas.mae, 2) : '-',
    },
    {
      field: 'rmse',
      headerName: 'RMSE',
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.metricas?.rmse != null ? fmtDec(params.data.metricas.rmse, 2) : '-',
    },
    {
      field: 'r2',
      headerName: 'R²',
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.metricas?.r2 != null ? fmtDec(params.data.metricas.r2, 4) : '-',
    },
    {
      field: 'prediccionTotal',
      headerName: t('common_prediction', 'Predicción'),
      flex: 0.3,
      minWidth: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.data?.prediccionTotal != null ? formatNumber(Math.round(params.data.prediccionTotal)) : '-',
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
      } catch {
        // Se mantienen los modelos por defecto
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
      setError(t('forecast_masivo_sin_materiales', 'Importa una plantilla con códigos de materiales'));
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
          error: err.response?.data?.error || t('forecast_masivo_error_desconocido', 'Error desconocido')
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
      r.metricas?.mae != null ? Number(r.metricas.mae).toFixed(2) : '',
      r.metricas?.rmse != null ? Number(r.metricas.rmse).toFixed(2) : '',
      r.metricas?.r2 != null ? Number(r.metricas.r2).toFixed(4) : '',
      r.prediccionTotal != null ? Number(r.prediccionTotal).toFixed(0) : '',
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
    <PageLayout title={t('forecast_masivo_titulo', 'Forecast masivo')}>
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

      {/* Barra de parámetros */}
      <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
        <Box sx={{ py: 1.5, px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
            {/* Plantilla */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mb: 0.5 }}>
                {t('forecast_masivo_plantilla', 'Plantilla')}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Tooltip title={t('forecast_masivo_tip_descargar', 'Descargar plantilla CSV')}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={descargarPlantilla}
                    startIcon={<FileDownloadIcon />}
                    sx={{
                      height: 40,
                      textTransform: "none",
                      borderColor: "var(--border)",
                      color: "var(--fg-muted)",
                      "&:hover": { borderColor: "var(--primary)", color: "var(--primary)" }
                    }}
                  >
                    {t('common_descargar', 'Descargar')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('forecast_masivo_tip_importar', 'Importar archivo CSV con códigos')}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    startIcon={<FileUploadIcon />}
                    sx={{
                      height: 40,
                      textTransform: "none",
                      borderColor: materialesImportados.length > 0 ? "var(--success)" : "var(--border)",
                      color: materialesImportados.length > 0 ? "var(--success)" : "var(--fg-muted)",
                      bgcolor: materialesImportados.length > 0 ? "var(--success-soft)" : "transparent",
                      "&:hover": { borderColor: "var(--success)", color: "var(--success)", bgcolor: "var(--success-soft)" }
                    }}
                  >
                    {t('common_importar', 'Importar')}
                  </Button>
                </Tooltip>
              </Box>
            </Box>

            {/* Materiales importados */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mb: 0.5 }}>
                {t('forecast_masivo_materiales', 'Materiales')}
              </Typography>
              <Chip
                icon={materialesImportados.length > 0 ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : undefined}
                label={`${formatNumber(materialesImportados.length)} ${t('forecast_masivo_importados', 'importados')}`}
                size="small"
                sx={{
                  height: 40,
                  fontWeight: 600,
                  bgcolor: materialesImportados.length > 0 ? "var(--success-soft)" : "var(--bg-soft)",
                  color: materialesImportados.length > 0 ? "var(--success)" : "var(--fg-muted)",
                  "& .MuiChip-icon": { color: "var(--success)" }
                }}
              />
            </Box>

            {/* Separador */}
            <Box sx={{ height: 40, width: "1px", bgcolor: "var(--border)", display: { xs: "none", md: "block" } }} />

            {/* Modelo */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="fm-modelo-label">{t('forecast_masivo_modelo', 'Modelo')}</InputLabel>
              <Select
                labelId="fm-modelo-label"
                value={modeloSeleccionado}
                onChange={(e) => setModeloSeleccionado(e.target.value)}
                disabled={loading}
                label={t('forecast_masivo_modelo', 'Modelo')}
              >
                {modelosDisponibles.map((modelo) => (
                  <MenuItem key={modelo} value={modelo}>
                    {MODELOS_INFO[modelo]?.nombre || modelo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Horizonte */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="fm-horizonte-label">{t('forecast_masivo_horizonte', 'Horizonte')}</InputLabel>
              <Select
                labelId="fm-horizonte-label"
                value={diasPrediccion}
                onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                disabled={loading}
                label={t('forecast_masivo_horizonte', 'Horizonte')}
              >
                <MenuItem value={7}>{t('forecast_h_7', '7 días')}</MenuItem>
                <MenuItem value={14}>{t('forecast_h_14', '14 días')}</MenuItem>
                <MenuItem value={30}>{t('forecast_h_30', '1 mes')}</MenuItem>
                <MenuItem value={60}>{t('forecast_h_60', '2 meses')}</MenuItem>
                <MenuItem value={90}>{t('forecast_h_90', '3 meses')}</MenuItem>
              </Select>
            </FormControl>

            {/* Separador */}
            <Box sx={{ height: 40, width: "1px", bgcolor: "var(--border)", display: { xs: "none", md: "block" } }} />

            {/* Botón Ejecutar */}
            <Button
              variant="contained"
              onClick={ejecutarForecastMasivo}
              disabled={loading || materialesImportados.length === 0}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
              sx={{ height: 40, minWidth: 130, textTransform: "none", fontWeight: 600 }}
            >
              {loading ? `${progreso.actual}/${progreso.total}` : t('forecast_masivo_ejecutar', 'Ejecutar')}
            </Button>

            {/* Limpiar */}
            <Tooltip title={t('forecast_masivo_limpiar', 'Limpiar todo')}>
              <span>
                <IconButton
                  onClick={limpiar}
                  disabled={loading}
                  aria-label={t('forecast_masivo_limpiar', 'Limpiar todo')}
                  sx={{ color: "var(--fg-muted)", "&:hover": { color: "var(--danger)" } }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Mensaje de éxito de importación */}
      {importSuccess && (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          {t('forecast_masivo_import_success', 'Se importaron {n} materiales correctamente').replace('{n}', formatNumber(materialesImportados.length))}
        </Alert>
      )}

      {/* Lista de materiales importados (preview) */}
      {materialesImportados.length > 0 && resultados.length === 0 && !loading && (
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
          <Box sx={{ p: 2, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle2" fontWeight={600} color="var(--fg-strong)">
              {t('forecast_masivo_preview', 'Materiales a procesar')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatNumber(materialesImportados.length)} {t('forecast_masivo_materiales_lc', 'materiales')}
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
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Progreso */}
      {loading && (
        <Paper elevation={0} sx={{ p: 2, border: "1px solid var(--border)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>{t('forecast_masivo_procesando', 'Procesando materiales...')}</Typography>
            <Typography variant="caption" color="text.secondary">{progreso.actual} {t('common_de', 'de')} {progreso.total}</Typography>
          </Box>
          <LinearProgress variant="determinate" value={(progreso.actual / progreso.total) * 100} sx={{ height: 8, borderRadius: 4 }} />
        </Paper>
      )}

      {/* Estadísticas */}
      {stats && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }, gap: 2 }}>
          {[
            { key: 'total', label: t('forecast_masivo_stat_total', 'Total'), value: formatNumber(stats.total), color: "var(--fg-strong)" },
            { key: 'ok', label: t('forecast_masivo_stat_exitosos', 'Exitosos'), value: formatNumber(stats.exitosos), color: "var(--success)" },
            { key: 'ko', label: t('forecast_masivo_stat_fallidos', 'Fallidos'), value: formatNumber(stats.fallidos), color: stats.fallidos > 0 ? "var(--danger)" : "var(--fg-strong)" },
            { key: 'mae', label: t('forecast_masivo_stat_mae', 'MAE prom.'), value: fmtDec(stats.maePromedio, 2), color: "var(--fg-strong)" },
            { key: 'r2', label: t('forecast_masivo_stat_r2', 'R² prom.'), value: fmtDec(stats.r2Promedio, 4), color: "var(--fg-strong)" },
            { key: 'dem', label: t('forecast_masivo_stat_demanda', 'Demanda total'), value: formatNumber(Math.round(stats.prediccionTotal)), color: "var(--fg-strong)" },
          ].map((item) => (
            <Paper
              key={item.key}
              elevation={0}
              sx={{ p: 2, border: "1px solid var(--border)", minHeight: 88, display: "flex", flexDirection: "column", justifyContent: "center" }}
            >
              <Typography variant="caption" sx={{ color: "var(--fg-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: item.color, fontVariantNumeric: "tabular-nums" }}>
                {item.value}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* Tabla de resultados */}
      {resultados.length > 0 && (
        <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
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
              {t('forecast_masivo_exportar_csv', 'Exportar CSV')}
            </Button>
          </Box>

          <ResultadosTable data={resultados} />
        </Paper>
      )}

      {/* Estado vacío */}
      {materialesImportados.length === 0 && resultados.length === 0 && !loading && (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, border: "1px solid var(--border)", textAlign: "center" }}>
          <EmptyState
            icon={<PlaylistAddIcon sx={{ fontSize: 32, color: "var(--fg-muted)" }} />}
            title={t('forecast_masivo_empty_titulo', 'Analiza múltiples materiales')}
            description={t('forecast_masivo_empty_descripcion', 'Descarga la plantilla CSV, complétala con los códigos de materiales e impórtala para ejecutar el forecast masivo.')}
            className="py-4"
          />
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={descargarPlantilla}
              sx={{ textTransform: "none" }}
            >
              {t('forecast_masivo_paso1', '1. Descargar plantilla')}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<FileUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: "none" }}
            >
              {t('forecast_masivo_paso2', '2. Importar plantilla')}
            </Button>
          </Box>
        </Paper>
      )}
    </PageLayout>
  );
};

export default ForecastMasivo;
