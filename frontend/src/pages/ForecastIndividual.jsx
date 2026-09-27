/**
 * ForecastIndividual - Página de forecast de material individual
 *
 * Permite analizar y predecir demanda para un material específico
 */

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useI18n } from '../context/i18n';
import { useForecast } from '../hooks/useForecast';

// Lazy load heavy chart components (use default exports)
const ForecastChart = lazy(() => import('../components/forecast/ForecastChart'));
const ForecastKPIs = lazy(() => import('../components/forecast/ForecastKPIs'));
const BacktestResults = lazy(() => import('../components/forecast/BacktestResults'));
const ModelComparison = lazy(() => import('../components/forecast/ModelComparison'));
const PatternCharts = lazy(() => import('../components/forecast/PatternCharts'));
const ForecastSimulationPanel = lazy(() => import('../components/forecast/ForecastSimulationPanel'));
const ForecastPlaceholder = lazy(() => import('../components/forecast/ForecastPlaceholder'));

// Light components
import {
  PredictionsTable,
  MaterialSearchInput
} from '../components/forecast';
import { TempDataBanner } from '../components/ui/TempDataBanner';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import { formatDate, formatDateTime, formatNumber } from '../utils/formatters';
import api from '../services/api';
import { FONT_SIZES } from '../components/ui/SPMChartJS';

// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Modal from '@mui/material/Modal';
import LinearProgress from '@mui/material/LinearProgress';
import Backdrop from '@mui/material/Backdrop';
import Fade from '@mui/material/Fade';
import Divider from '@mui/material/Divider';

// Descripciones de modelos para tooltips
const MODELO_TOOLTIPS = {
  random_forest: "Modelo de ensamble que combina múltiples árboles de decisión. Robusto y preciso para patrones complejos. Buena opción por defecto.",
  gradient_boosting: "Modelo de boosting que mejora iterativamente. Excelente precisión pero más lento. Ideal para datos con tendencias claras.",
  linear: "Regresión lineal simple. Rápido y interpretable. Mejor para demanda con tendencia constante sin estacionalidad.",
  ridge: "Regresión lineal con regularización. Evita sobreajuste. Útil cuando hay muchas variables correlacionadas.",
  xgboost: "Implementación optimizada de gradient boosting. Muy preciso y eficiente. Ideal para grandes volúmenes de datos.",
  prophet: "Modelo de Facebook para series temporales. Maneja bien estacionalidad y días festivos. Ideal para demanda con patrones estacionales fuertes.",
  arima: "Modelo estadístico clásico para series temporales. Captura tendencia y autocorrelación. Bueno para datos con patrones regulares."
};

// MUI Icons
import SearchIcon from '@mui/icons-material/Search';
import ScienceIcon from '@mui/icons-material/Science';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';

// Shared select styles
const selectSx = { fontSize: FONT_SIZES.md, '& .MuiSelect-select': { py: '8px' } };
const labelSx = { fontSize: FONT_SIZES.md };
const menuProps = { PaperProps: { style: { maxHeight: 300 } } };

// Fechas "YYYY-MM-DD" se interpretan en hora local para no correrse un día
const fmtFecha = (v) => formatDate(typeof v === 'string' && v.length === 10 ? `${v}T00:00:00` : v);

const ForecastIndividual = () => {
  const { t } = useI18n();
  const {
    materialCodigo,
    setMaterialCodigo,
    modeloSeleccionado,
    setModeloSeleccionado,
    diasPrediccion,
    setDiasPrediccion,
    mesesHistorico,
    setMesesHistorico,
    centro,
    setCentro,
    almacen,
    setAlmacen,
    modelosDisponibles,
    centrosDisponibles,
    almacenesDisponibles,
    forecastData,
    backtestData,
    comparacionData,
    metricas,
    prediccionesParaGrafico,
    historicoParaGrafico,
    historicoInfo,
    loading,
    loadingBacktest,
    loadingComparacion,
    loadingCatalogos,
    error,
    // Simulación (Cold Start)
    simulationMode,
    generateSyntheticData,
    exitSimulationMode,
    // Acciones
    ejecutarForecast,
    ejecutarBacktest,
    compararModelos,
    limpiar,
    getNombreModelo
  } = useForecast();

  // Estado local
  const [activeTab, setActiveTab] = useState(0);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showComparacion, setShowComparacion] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const progressIntervalRef = useRef(null);
  const tRef = useRef(t);
  tRef.current = t;

  // Simular progreso durante el análisis
  useEffect(() => {
    if (loading) {
      setLoadingProgress(0);
      setLoadingMessage(tRef.current('forecast_prog_inicio', 'Iniciando análisis...'));

      const messages = [
        { progress: 15, message: tRef.current('forecast_prog_15', 'Cargando datos históricos...') },
        { progress: 35, message: tRef.current('forecast_prog_35', 'Procesando series temporales...') },
        { progress: 55, message: tRef.current('forecast_prog_55', 'Entrenando modelo de ML...') },
        { progress: 75, message: tRef.current('forecast_prog_75', 'Generando predicciones...') },
        { progress: 90, message: tRef.current('forecast_prog_90', 'Calculando métricas...') },
      ];

      let currentStep = 0;
      progressIntervalRef.current = setInterval(() => {
        if (currentStep < messages.length) {
          setLoadingProgress(messages[currentStep].progress);
          setLoadingMessage(messages[currentStep].message);
          currentStep++;
        }
      }, 600);

      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    } else {
      // Completar al 100% brevemente antes de cerrar
      if (loadingProgress > 0) {
        setLoadingProgress(100);
        setLoadingMessage(tRef.current('forecast_prog_fin', '¡Análisis completado!'));
        setTimeout(() => {
          setLoadingProgress(0);
          setLoadingMessage('');
        }, 300);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  }, [loading]);

  // Search materials from consumo_historico (sap_data.db) instead of catalogo
  const searchConsumoMaterials = useCallback(async (query) => {
    try {
      const response = await api.get('/ai/materiales/buscar-consumo', { params: { q: query, limit: 20 } });
      return response.data?.data || [];
    } catch {
      return [];
    }
  }, []);

  const handleMaterialSelect = useCallback((material) => {
    setSelectedMaterial(material);
    if (material) {
      setMaterialCodigo(material.codigo);
    }
  }, [setMaterialCodigo]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (materialCodigo.trim()) {
      ejecutarForecast();
    }
  }, [materialCodigo, ejecutarForecast]);

  const handleBacktest = useCallback(async () => {
    setShowBacktest(true);
    await ejecutarBacktest();
  }, [ejecutarBacktest]);

  const handleCompararModelos = useCallback(async () => {
    setShowComparacion(true);
    await compararModelos();
  }, [compararModelos]);

  const handleSelectModelFromComparison = useCallback((modelo) => {
    setModeloSeleccionado(modelo);
    ejecutarForecast();
  }, [setModeloSeleccionado, ejecutarForecast]);

  // Handler para predicciones manuales del ForecastPlaceholder (Cold Start < 3 registros)
  const handleManualForecast = useCallback((predictions, metadata) => {
    generateSyntheticData({
      consumoMensual: metadata?.avgMonthlyConsumption || predictions[0]?.prediccion || 0,
      volatilidad: metadata?.uncertaintyBuffer || 0.3,
      leadTime: metadata?.leadTime || 14,
      // Pasar predicciones ya calculadas con la formula de SS
      customPredictions: predictions,
    });
  }, [generateSyntheticData]);

  const tabItems = [
    { label: t('forecast_tab_forecast', 'Forecast'), icon: <TrendingUpIcon sx={{ fontSize: 18 }} /> },
    { label: t('forecast_tab_metricas', 'Métricas'), icon: <BarChartIcon sx={{ fontSize: 18 }} /> },
    { label: t('forecast_tab_tabla', 'Tabla'), icon: <TableChartIcon sx={{ fontSize: 18 }} /> },
    { label: t('forecast_tab_patrones', 'Patrones'), icon: <AutoGraphIcon sx={{ fontSize: 18 }} /> }
  ];

  // Detectar si los parámetros actuales difieren del último análisis
  const parametrosModificados = forecastData && (
    forecastData.dias !== diasPrediccion ||
    forecastData.modelo !== modeloSeleccionado ||
    (forecastData.meses_historico === "todo" ? 0 : forecastData.meses_historico) !== mesesHistorico
  );

  return (
    <PageLayout
      title={t('forecast_titulo', 'Forecast de demanda')}
      subtitle={t('forecast_subtitulo', 'Predicción de consumo basada en modelos de ML')}
      actions={forecastData ? (
        <Button
          onClick={limpiar}
          variant="outlined"
          size="small"
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
          sx={{
            fontWeight: 500,
            textTransform: 'none',
            color: "var(--fg-muted)",
            borderColor: "var(--border)",
            px: 2,
            "&:hover": { color: "var(--danger)", borderColor: "var(--danger)", bgcolor: 'var(--danger-bg)' },
          }}
        >
          {t('common_limpiar', 'Limpiar')}
        </Button>
      ) : null}
    >
      {/* Banner de Modo Temporal */}
      <TempDataBanner />

      {/* Panel de control - Filtros */}
      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: 'divider',
          overflow: "hidden",
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': { boxShadow: 'var(--shadow-md)' },
        }}
      >
        <form onSubmit={handleSearch}>
          {/* Fila 1: Búsqueda + Ubicación */}
          <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1.5 }}>
            <Stack direction="row" alignItems="flex-end" gap={2.5} flexWrap="wrap">
              {/* Búsqueda de material */}
              <Box sx={{ flex: '1 1 320px', minWidth: { xs: '100%', sm: 280 }, maxWidth: 420 }}>
                <Typography
                  component="label"
                  sx={{
                    fontSize: FONT_SIZES.sm,
                    fontWeight: 600,
                    color: "var(--fg-muted)",
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                    mb: 0.75,
                  }}
                >
                  {t('forecast_buscar_material', 'Material')}
                </Typography>
                <MaterialSearchInput
                  value={materialCodigo}
                  onChange={setMaterialCodigo}
                  onSelect={handleMaterialSelect}
                  selectedMaterial={selectedMaterial}
                  placeholder={t('forecast_placeholder_buscar', 'Código o descripción...')}
                  disabled={loading}
                  showSelectedInfo={false}
                  searchFn={searchConsumoMaterials}
                />
              </Box>

              {/* Centro */}
              <FormControl size="small" sx={{ minWidth: 150, flex: '0 1 170px' }}>
                <InputLabel sx={labelSx}>{t('common_centro', 'Centro')}</InputLabel>
                <Select
                  multiple
                  value={Array.isArray(centro) ? centro : (centro ? [centro] : [])}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.includes("__todos__")) {
                      const allIds = centrosDisponibles.map(c => c.id);
                      const current = Array.isArray(centro) ? centro : [];
                      setCentro(current.length === allIds.length ? [] : allIds);
                    } else {
                      setCentro(typeof value === "string" ? value.split(",") : value);
                    }
                  }}
                  disabled={loading || loadingCatalogos}
                  input={<OutlinedInput label={t('common_centro', 'Centro')} />}
                  renderValue={(selected) => selected.length > 1 ? `${selected.length} ${t('forecast_selec', 'selec.')}` : selected.join(", ")}
                  MenuProps={menuProps}
                  sx={selectSx}
                >
                  <MenuItem value="__todos__">
                    <Checkbox checked={Array.isArray(centro) && centro.length === centrosDisponibles.length && centrosDisponibles.length > 0} size="small" />
                    <ListItemText primary={t('common_seleccionar_todos', 'Seleccionar todos')} primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                  </MenuItem>
                  {centrosDisponibles.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      <Checkbox checked={Array.isArray(centro) && centro.includes(c.id)} size="small" />
                      <ListItemText primary={c.nombre ? `${c.id} - ${c.nombre}` : c.id} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Almacén */}
              <FormControl size="small" sx={{ minWidth: 150, flex: '0 1 170px' }}>
                <InputLabel sx={labelSx}>{t('common_almacen', 'Almacén')}</InputLabel>
                <Select
                  multiple
                  value={Array.isArray(almacen) ? almacen : (almacen ? [almacen] : [])}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.includes("__todos__")) {
                      const allIds = almacenesDisponibles.map(a => a.id);
                      const current = Array.isArray(almacen) ? almacen : [];
                      setAlmacen(current.length === allIds.length ? [] : allIds);
                    } else {
                      setAlmacen(typeof value === "string" ? value.split(",") : value);
                    }
                  }}
                  disabled={loading || loadingCatalogos}
                  input={<OutlinedInput label={t('common_almacen', 'Almacén')} />}
                  renderValue={(selected) => selected.length > 1 ? `${selected.length} ${t('forecast_selec', 'selec.')}` : selected.join(", ")}
                  MenuProps={menuProps}
                  sx={selectSx}
                >
                  <MenuItem value="__todos__">
                    <Checkbox checked={Array.isArray(almacen) && almacen.length === almacenesDisponibles.length && almacenesDisponibles.length > 0} size="small" />
                    <ListItemText primary={t('common_seleccionar_todos', 'Seleccionar todos')} primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                  </MenuItem>
                  {almacenesDisponibles.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      <Checkbox checked={Array.isArray(almacen) && almacen.includes(a.id)} size="small" />
                      <ListItemText primary={a.nombre ? `${a.id} - ${a.nombre}` : a.id} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Botón de acción */}
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !materialCodigo.trim()}
                startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon sx={{ fontSize: 18 }} />}
                sx={{
                  height: 40,
                  minWidth: 130,
                  fontWeight: 600,
                  fontSize: FONT_SIZES.md,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'var(--shadow-md)' },
                }}
              >
                {loading ? t('forecast_analizando', 'Analizando...') : t('forecast_analizar', 'Analizar')}
              </Button>
            </Stack>
          </Box>

          {/* Divider */}
          <Divider sx={{ mx: { xs: 2, md: 3 } }} />

          {/* Fila 2: Parámetros del modelo */}
          <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25 }}>
            <Stack direction="row" alignItems="center" gap={2.5} flexWrap="wrap">
              <Typography
                variant="caption"
                sx={{
                  fontSize: FONT_SIZES.sm,
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  mr: 0.5,
                }}
              >
                {t('forecast_modelo', 'Modelo')}
              </Typography>

              {/* Histórico */}
              <Tooltip
                title={t('forecast_tip_historico', 'Meses de consumo histórico para entrenar el modelo. Más datos pueden mejorar la precisión, pero también incluir patrones obsoletos.')}
                placement="top"
                arrow
                slotProps={{ tooltip: { sx: { fontSize: FONT_SIZES.sm, maxWidth: 280 } } }}
              >
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel sx={labelSx}>{t('forecast_historico', 'Histórico')}</InputLabel>
                  <Select
                    value={mesesHistorico}
                    onChange={(e) => setMesesHistorico(Number(e.target.value))}
                    label={t('forecast_historico', 'Histórico')}
                    sx={selectSx}
                  >
                    <MenuItem value={0}>{t('forecast_todo', 'Todo')}</MenuItem>
                    <MenuItem value={1}>{t('forecast_m_1', '1 mes')}</MenuItem>
                    <MenuItem value={3}>{t('forecast_m_3', '3 meses')}</MenuItem>
                    <MenuItem value={6}>{t('forecast_m_6', '6 meses')}</MenuItem>
                    <MenuItem value={12}>{t('forecast_m_12', '12 meses')}</MenuItem>
                    <MenuItem value={18}>{t('forecast_m_18', '18 meses')}</MenuItem>
                    <MenuItem value={24}>{t('forecast_m_24', '24 meses')}</MenuItem>
                  </Select>
                </FormControl>
              </Tooltip>

              {/* Horizonte */}
              <FormControl size="small" sx={{ minWidth: 115 }}>
                <InputLabel sx={labelSx}>{t('forecast_horizonte', 'Horizonte')}</InputLabel>
                <Select
                  value={diasPrediccion}
                  onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                  label={t('forecast_horizonte', 'Horizonte')}
                  sx={selectSx}
                >
                  <MenuItem value={30}>{t('forecast_d_30', '1 mes')}</MenuItem>
                  <MenuItem value={90}>{t('forecast_d_90', '3 meses')}</MenuItem>
                  <MenuItem value={180}>{t('forecast_d_180', '6 meses')}</MenuItem>
                  <MenuItem value={240}>{t('forecast_d_240', '8 meses')}</MenuItem>
                  <MenuItem value={300}>{t('forecast_d_300', '10 meses')}</MenuItem>
                  <MenuItem value={365}>{t('forecast_d_365', '12 meses')}</MenuItem>
                </Select>
              </FormControl>

              {/* Modelo ML */}
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel sx={labelSx}>{t('forecast_algoritmo', 'Algoritmo')}</InputLabel>
                {/* El Tooltip va dentro del MenuItem: si lo envuelve, Select no encuentra el valor y queda vacío */}
                <Select
                  value={modelosDisponibles.some((m) => m.id === modeloSeleccionado) ? modeloSeleccionado : ''}
                  onChange={(e) => setModeloSeleccionado(e.target.value)}
                  disabled={loading || loadingCatalogos || modelosDisponibles.length === 0}
                  label={t('forecast_algoritmo', 'Algoritmo')}
                  sx={selectSx}
                >
                  {modelosDisponibles.map((modelo) => (
                    <MenuItem key={modelo.id} value={modelo.id}>
                      <Tooltip
                        title={MODELO_TOOLTIPS[modelo.id] || t('forecast_tip_modelo', 'Modelo de predicción de demanda')}
                        placement="right"
                        arrow
                        slotProps={{ tooltip: { sx: { fontSize: FONT_SIZES.sm, maxWidth: 280 } } }}
                      >
                        <Box component="span" sx={{ width: '100%' }}>{modelo.nombre}</Box>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Indicador de parámetros modificados */}
              {parametrosModificados && (
                <Chip
                  label={t('forecast_param_modificados', 'Parámetros modificados')}
                  size="small"
                  sx={{
                    fontSize: FONT_SIZES.xs,
                    height: 24,
                    bgcolor: 'var(--warning-bg-light)',
                    color: 'var(--warning, #d97706)',
                    border: '1px solid var(--warning-border)',
                    fontWeight: 600,
                  }}
                />
              )}
            </Stack>
          </Box>
        </form>
      </Paper>

      {/* Detectar Cold Start - mostrar panel de simulación cuando no hay datos históricos */}
      {(() => {
        const isColdStart = !loading && !forecastData && error && (
          error.toLowerCase().includes('sin datos') ||
          error.toLowerCase().includes('no hay datos') ||
          error.toLowerCase().includes('sin histórico') ||
          error.toLowerCase().includes('no hay histórico') ||
          error.toLowerCase().includes('insufficient data') ||
          error.toLowerCase().includes('no data') ||
          error.toLowerCase().includes('not enough')
        );

        if (isColdStart && materialCodigo) {
          return (
            <Suspense fallback={<Skeleton variant="rectangular" height={300} />}>
              <Box>
                <ForecastSimulationPanel
                  onSimulate={generateSyntheticData}
                  materialCodigo={materialCodigo}
                  disabled={loading}
                />
              </Box>
            </Suspense>
          );
        }

        if (error) {
          return (
            <Alert
              severity="error"
              sx={{
                border: '1px solid',
                borderColor: 'error.light',
                '& .MuiAlert-message': { fontSize: FONT_SIZES.md },
              }}
            >
              {error}
            </Alert>
          );
        }

        return null;
      })()}

      {/* ForecastPlaceholder */}
      {!loading && !error && forecastData && !simulationMode && historicoParaGrafico && historicoParaGrafico.length < 3 && materialCodigo && (
        <Suspense fallback={<Skeleton variant="rectangular" height={300} />}>
          <Box>
            <ForecastPlaceholder
              historicalData={historicoParaGrafico}
              onGenerateForecast={handleManualForecast}
              materialCodigo={materialCodigo}
              disabled={loading}
            />
          </Box>
        </Suspense>
      )}

      {/* Resultados */}
      {forecastData && (
        <>
          {/* Info del material + Tabs + Acciones */}
          <Paper
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: 'divider',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s ease-in-out',
              '&:hover': { boxShadow: 'var(--shadow-md)' },
            }}
          >
            {/* Material header */}
            <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
                <Stack direction="row" alignItems="center" gap={2}>
                  {/* Material icon badge */}
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: simulationMode ? 'var(--warning-bg-light)' : 'var(--primary-bg-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AutoGraphIcon sx={{ fontSize: 22, color: simulationMode ? 'var(--warning, #d97706)' : 'var(--primary)' }} />
                  </Box>
                  <Box>
                    <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap">
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: 'var(--fg-strong)',
                          fontSize: FONT_SIZES.h5,
                          fontFamily: 'var(--font-mono, monospace)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {forecastData.material?.codigo || selectedMaterial?.codigo || materialCodigo}
                      </Typography>
                      <Typography
                        sx={{
                          color: 'var(--fg-muted)',
                          fontSize: FONT_SIZES.md,
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {forecastData.material?.descripcion || selectedMaterial?.descripcion || ''}
                      </Typography>
                    </Stack>
                    <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
                      <Chip
                        label={simulationMode
                          ? t('forecast_modo_simulacion', 'Simulación')
                          : (forecastData?.nombre_modelo || getNombreModelo(modeloSeleccionado))
                        }
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: FONT_SIZES.xs,
                          fontWeight: 600,
                          bgcolor: simulationMode ? 'var(--warning-bg-light)' : 'var(--primary-bg-light)',
                          color: simulationMode ? 'var(--warning, #d97706)' : 'var(--primary)',
                          border: '1px solid',
                          borderColor: simulationMode ? 'var(--warning-border)' : 'var(--info-border)',
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                      <Chip
                        label={`${t('forecast_horizonte', 'Horizonte')}: ${forecastData?.dias || diasPrediccion} ${t('common_dias', 'días')}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: FONT_SIZES.xs,
                          fontWeight: 500,
                          bgcolor: 'var(--bg-soft)',
                          color: 'var(--fg-muted)',
                          border: '1px solid var(--border)',
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                      {historicoInfo?.total_registros && (
                        <Chip
                          label={`${formatNumber(historicoInfo.total_registros)} ${t('forecast_registros', 'registros')}`}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: FONT_SIZES.xs,
                            fontWeight: 500,
                            bgcolor: 'var(--bg-soft)',
                            color: 'var(--fg-muted)',
                            border: '1px solid var(--border)',
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>

                {/* Action buttons */}
                <Stack direction="row" gap={1} sx={{ flexShrink: 0 }}>
                  {!simulationMode && (
                    <>
                      <Tooltip title={t('forecast_tip_backtest', 'Validación temporal del modelo con datos históricos')} placement="top" arrow>
                        <span>
                          <Button
                            onClick={handleBacktest}
                            disabled={loadingBacktest}
                            size="small"
                            startIcon={loadingBacktest ? <CircularProgress size={14} /> : <ScienceIcon sx={{ fontSize: 16 }} />}
                            sx={{
                              fontSize: FONT_SIZES.md,
                              fontWeight: 500,
                              color: 'var(--fg-muted)',
                              textTransform: 'none',
                              px: 1.5,
                              '&:hover': { bgcolor: 'var(--bg-soft)' },
                            }}
                          >
                            {loadingBacktest ? t('forecast_ejecutando', 'Ejecutando...') : t('forecast_backtesting', 'Backtesting')}
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={t('forecast_tip_comparar', 'Comparar el rendimiento entre modelos de ML')} placement="top" arrow>
                        <span>
                          <Button
                            onClick={handleCompararModelos}
                            disabled={loadingComparacion}
                            size="small"
                            startIcon={loadingComparacion ? <CircularProgress size={14} /> : <CompareArrowsIcon sx={{ fontSize: 16 }} />}
                            sx={{
                              fontSize: FONT_SIZES.md,
                              fontWeight: 500,
                              color: 'var(--fg-muted)',
                              textTransform: 'none',
                              px: 1.5,
                              '&:hover': { bgcolor: 'var(--bg-soft)' },
                            }}
                          >
                            {loadingComparacion ? t('forecast_comparando', 'Comparando...') : t('forecast_comparar', 'Comparar')}
                          </Button>
                        </span>
                      </Tooltip>
                    </>
                  )}
                  {simulationMode && (
                    <Button
                      onClick={exitSimulationMode}
                      size="small"
                      sx={{
                        fontSize: FONT_SIZES.md,
                        fontWeight: 500,
                        color: 'var(--warning, #d97706)',
                        textTransform: 'none',
                        px: 1.5,
                        '&:hover': { bgcolor: 'var(--warning-bg)' },
                      }}
                    >
                      {t('forecast_salir_simulacion', 'Salir de simulación')}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Box>

            {/* Tabs - inline en el mismo Paper */}
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 40,
                px: { xs: 1, md: 3 },
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'var(--bg-soft)',
                "& .MuiTab-root": {
                  minHeight: 40,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: FONT_SIZES.md,
                  color: "var(--fg-muted)",
                  px: 2,
                  gap: 0.75,
                  "&.Mui-selected": { color: "var(--primary)" },
                  "&:hover": { color: "var(--primary)" },
                },
                "& .MuiTabs-indicator": { bgcolor: "var(--primary)", height: 2, borderRadius: '2px 2px 0 0' },
              }}
            >
              {tabItems.map((tab, idx) => (
                <Tab key={idx} label={tab.label} icon={tab.icon} iconPosition="start" disableRipple />
              ))}
            </Tabs>
          </Paper>

          {/* Contenido de tabs */}
          <Box>
            {activeTab === 0 && (
              <Stack gap={2}>
                {/* KPIs */}
                <Suspense fallback={<Skeleton variant="rectangular" height={80} />}>
                  <ForecastKPIs metricas={metricas} />
                </Suspense>

                {/* Gráfico principal */}
                <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
                  <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: 'divider' }}>
                    <ForecastChart
                      historico={historicoParaGrafico}
                      predicciones={prediccionesParaGrafico}
                      titulo={simulationMode
                        ? `${t('forecast_simulacion', 'Simulación')}: ${materialCodigo}`
                        : `Forecast: ${materialCodigo} (${forecastData?.nombre_modelo || getNombreModelo(modeloSeleccionado)})`
                      }
                      height={450}
                      simulationMode={simulationMode}
                      safetyStock={forecastData?.safetyStock}
                    />
                  </Paper>
                </Suspense>
              </Stack>
            )}

            {activeTab === 1 && (
              <Stack gap={2}>
                <Suspense fallback={<Skeleton variant="rectangular" height={80} />}>
                  <ForecastKPIs metricas={metricas} />
                </Suspense>

                <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: 'divider' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: 'var(--fg-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: FONT_SIZES.sm,
                      display: 'block',
                      mb: 2,
                    }}
                  >
                    {t('forecast_detalles_modelo', 'Detalles del modelo')}
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 2.5 }}>
                    {[
                      {
                        key: 'modelo',
                        label: t('forecast_modelo', 'Modelo'),
                        value: forecastData?.nombre_modelo || getNombreModelo(modeloSeleccionado),
                      },
                      {
                        key: 'historico',
                        label: t('forecast_datos_historicos', 'Datos históricos'),
                        value: historicoInfo
                          ? `${formatNumber(historicoInfo.total_registros)} ${t('forecast_registros', 'registros')}`
                          : `${formatNumber(historicoParaGrafico.length)} ${t('common_dias', 'días')}`,
                        sub: historicoInfo?.fecha_inicio ? `${fmtFecha(historicoInfo.fecha_inicio)} → ${fmtFecha(historicoInfo.fecha_fin)}` : null,
                      },
                      {
                        key: 'predicciones',
                        label: t('forecast_predicciones', 'Predicciones'),
                        value: `${formatNumber(prediccionesParaGrafico.length)} ${t('common_dias', 'días')}`,
                      },
                      {
                        key: 'generado',
                        label: t('forecast_generado', 'Generado'),
                        value: formatDateTime(new Date()),
                      },
                    ].map((item) => (
                      <Box key={item.key}>
                        <Typography variant="caption" sx={{ color: 'var(--fg-muted)', fontSize: FONT_SIZES.sm, display: 'block', mb: 0.25 }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ fontWeight: 600, fontSize: FONT_SIZES.lg, color: 'var(--fg-strong)' }}>
                          {item.value}
                        </Typography>
                        {item.sub && (
                          <Typography variant="caption" sx={{ color: 'var(--fg-muted)', fontSize: FONT_SIZES.xs }}>
                            {item.sub}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Stack>
            )}

            {activeTab === 2 && (
              <PredictionsTable
                predicciones={prediccionesParaGrafico}
                showIntervalos={true}
              />
            )}

            {activeTab === 3 && (
              <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
                <PatternCharts
                  patronSemanal={forecastData.patrones?.semanal}
                  patronMensual={forecastData.patrones?.mensual}
                />
              </Suspense>
            )}
          </Box>

          {/* Panel de Backtesting */}
          {showBacktest && (
            <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
              <Box>
                <BacktestResults data={backtestData} loading={loadingBacktest} />
              </Box>
            </Suspense>
          )}

          {/* Panel de Comparación */}
          {showComparacion && (
            <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
              <Box>
                <ModelComparison data={comparacionData} loading={loadingComparacion} onSelectModel={handleSelectModelFromComparison} />
              </Box>
            </Suspense>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!forecastData && !loading && !error && (
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: 'divider', py: { xs: 2, md: 4 } }}>
          <EmptyState
            icon={<TrendingUpIcon sx={{ fontSize: 32, color: 'var(--primary)' }} />}
            title={t('forecast_empty_titulo', 'Analiza la demanda de un material')}
            description={t('forecast_empty_descripcion', 'Ingresa el código de un material para obtener predicciones de demanda basadas en el histórico de consumo.')}
            className="py-6"
          />
          <Stack direction="row" justifyContent="center" gap={3} flexWrap="wrap" sx={{ opacity: 0.6, px: 2 }}>
            {[
              { key: 'series', icon: <BarChartIcon sx={{ fontSize: 20 }} />, text: t('forecast_feat_series', 'Series temporales') },
              { key: 'backtest', icon: <ScienceIcon sx={{ fontSize: 20 }} />, text: t('forecast_backtesting', 'Backtesting') },
              { key: 'comparacion', icon: <CompareArrowsIcon sx={{ fontSize: 20 }} />, text: t('forecast_feat_comparacion', 'Comparación') },
            ].map((feat) => (
              <Stack key={feat.key} direction="row" alignItems="center" gap={0.75} sx={{ color: 'var(--fg-muted)' }}>
                {feat.icon}
                <Typography sx={{ fontSize: FONT_SIZES.sm, fontWeight: 500 }}>{feat.text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Modal de Loading con Progreso */}
      <Modal
        open={loading}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(248, 250, 252, 0.8)',
              backdropFilter: 'blur(8px)',
            }
          }
        }}
      >
        <Fade in={loading}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: { xs: 'calc(100% - 32px)', sm: 380 },
              bgcolor: 'var(--surface)',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 'var(--shadow-xl)',
              p: 4,
              outline: 'none',
            }}
          >
            {/* Header */}
            <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: 'var(--primary-bg-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <AutoGraphIcon sx={{ color: 'var(--primary)', fontSize: 24 }} />
                {/* Pulse indicator */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'var(--primary)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.5, transform: 'scale(0.8)' },
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, color: 'var(--fg-strong)', fontSize: FONT_SIZES.h5 }}>
                  {t('forecast_analizando_titulo', 'Analizando')}
                </Typography>
                <Typography
                  sx={{
                    color: 'var(--fg-muted)',
                    fontSize: FONT_SIZES.md,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {materialCodigo || t('forecast_buscar_material', 'Material')}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: 'var(--primary)',
                  fontSize: FONT_SIZES.h4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {loadingProgress}%
              </Typography>
            </Stack>

            {/* Progress */}
            <Box sx={{ mb: 2.5 }}>
              <LinearProgress
                variant="determinate"
                value={loadingProgress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'var(--bg-soft)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    bgcolor: 'var(--primary)',
                    transition: 'transform 0.4s ease',
                  },
                }}
              />
              <Typography
                sx={{
                  mt: 1,
                  fontSize: FONT_SIZES.sm,
                  color: 'var(--fg-muted)',
                  fontWeight: 500,
                }}
              >
                {loadingMessage}
              </Typography>
            </Box>

            {/* Footer info */}
            <Stack
              direction="row"
              justifyContent="center"
              gap={1}
              sx={{
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Chip
                label={getNombreModelo(modeloSeleccionado)}
                size="small"
                sx={{
                  height: 22,
                  fontSize: FONT_SIZES.xs,
                  fontWeight: 500,
                  bgcolor: 'var(--bg-soft)',
                  color: 'var(--fg-muted)',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
              <Chip
                label={`${diasPrediccion} ${t('common_dias', 'días')}`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: FONT_SIZES.xs,
                  fontWeight: 500,
                  bgcolor: 'var(--bg-soft)',
                  color: 'var(--fg-muted)',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Stack>
          </Box>
        </Fade>
      </Modal>
    </PageLayout>
  );
};

export default ForecastIndividual;
