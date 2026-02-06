/**
 * ForecastIndividual - Página de forecast de material individual
 *
 * Permite analizar y predecir demanda para un material específico
 */

import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
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
import api from '../services/api';

// MUI Components
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import ScienceIcon from '@mui/icons-material/Science';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';

const ForecastIndividual = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
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

  // Simular progreso durante el análisis
  useEffect(() => {
    if (loading) {
      setLoadingProgress(0);
      setLoadingMessage('Iniciando análisis...');

      const messages = [
        { progress: 15, message: 'Cargando datos históricos...' },
        { progress: 35, message: 'Procesando series temporales...' },
        { progress: 55, message: 'Entrenando modelo ML...' },
        { progress: 75, message: 'Generando predicciones...' },
        { progress: 90, message: 'Calculando métricas...' },
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
        setLoadingMessage('¡Análisis completado!');
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
    { label: t('forecast_tab_forecast', 'Forecast'), icon: <TrendingUpIcon fontSize="small" /> },
    { label: t('forecast_tab_metricas', 'Métricas'), icon: <BarChartIcon fontSize="small" /> },
    { label: t('forecast_tab_tabla', 'Tabla'), icon: <TableChartIcon fontSize="small" /> },
    { label: t('forecast_tab_patrones', 'Patrones'), icon: <AutoGraphIcon fontSize="small" /> }
  ];

  // Detectar si los parámetros actuales difieren del último análisis
  const parametrosModificados = forecastData && (
    forecastData.dias !== diasPrediccion ||
    forecastData.modelo !== modeloSeleccionado ||
    (forecastData.meses_historico === "todo" ? 0 : forecastData.meses_historico) !== mesesHistorico
  );

  return (
    <Container maxWidth={false} sx={{ py: 2, px: "75px" }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "var(--fg-muted)" }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t('forecast_titulo', 'FORECAST DE DEMANDA')}
        </Typography>
      </Box>

      {/* Banner de Modo Temporal */}
      <TempDataBanner />

      {/* Filtros - estilo Dashboard */}
      <Paper elevation={0} sx={{ mb: 3, border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <form onSubmit={handleSearch}>
          <Box sx={{ py: 1.5, px: 3, height: "73px" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3, height: "100%" }}>
            {/* Búsqueda de material */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 280 }}>
              <Typography component="label" sx={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)", mb: 0.5 }}>
                {t('forecast_buscar_material', 'Buscar Material')}
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

            {/* Separador */}
            <Box sx={{ height: 48, width: 1, bgcolor: "var(--border)" }} />

            {/* Centro - Multiselect */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Centro</InputLabel>
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
                input={<OutlinedInput label="Centro" />}
                renderValue={(selected) => selected.length > 1 ? `${selected.length} selec.` : selected.join(", ")}
                MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                sx={{ fontSize: "0.75rem" }}
              >
                <MenuItem value="__todos__">
                  <Checkbox checked={Array.isArray(centro) && centro.length === centrosDisponibles.length && centrosDisponibles.length > 0} size="small" />
                  <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
                </MenuItem>
                {centrosDisponibles.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <Checkbox checked={Array.isArray(centro) && centro.includes(c.id)} size="small" />
                    <ListItemText primary={c.nombre ? `${c.id} - ${c.nombre}` : c.id} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Almacén - Multiselect */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Almacén</InputLabel>
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
                input={<OutlinedInput label="Almacén" />}
                renderValue={(selected) => selected.length > 1 ? `${selected.length} selec.` : selected.join(", ")}
                MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                sx={{ fontSize: "0.75rem" }}
              >
                <MenuItem value="__todos__">
                  <Checkbox checked={Array.isArray(almacen) && almacen.length === almacenesDisponibles.length && almacenesDisponibles.length > 0} size="small" />
                  <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: "0.75rem", fontWeight: 600 }} />
                </MenuItem>
                {almacenesDisponibles.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Checkbox checked={Array.isArray(almacen) && almacen.includes(a.id)} size="small" />
                    <ListItemText primary={a.nombre ? `${a.id} - ${a.nombre}` : a.id} primaryTypographyProps={{ fontSize: "0.75rem" }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Histórico a usar */}
            <Tooltip
              title="Cantidad de meses de consumo histórico que se usará para entrenar el modelo. Más datos puede mejorar la precisión pero también incluir patrones obsoletos."
              placement="top"
              arrow
              slotProps={{ tooltip: { sx: { fontSize: "0.7rem", maxWidth: 280 } } }}
            >
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel sx={{ fontSize: "0.75rem" }}>Histórico</InputLabel>
                <Select
                  value={mesesHistorico}
                  onChange={(e) => setMesesHistorico(Number(e.target.value))}
                  label="Histórico"
                  sx={{ fontSize: "0.75rem" }}
                >
                  <MenuItem value={0}>Todo</MenuItem>
                  <MenuItem value={1}>1 mes</MenuItem>
                  <MenuItem value={3}>3 meses</MenuItem>
                  <MenuItem value={6}>6 meses</MenuItem>
                  <MenuItem value={12}>12 meses</MenuItem>
                  <MenuItem value={18}>18 meses</MenuItem>
                  <MenuItem value={24}>24 meses</MenuItem>
                </Select>
              </FormControl>
            </Tooltip>

            {/* Horizonte */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Horizonte</InputLabel>
              <Select
                value={diasPrediccion}
                onChange={(e) => setDiasPrediccion(Number(e.target.value))}
                label="Horizonte"
                sx={{ fontSize: "0.75rem" }}
              >
                <MenuItem value={30}>1 mes</MenuItem>
                <MenuItem value={90}>3 meses</MenuItem>
                <MenuItem value={180}>6 meses</MenuItem>
                <MenuItem value={240}>8 meses</MenuItem>
                <MenuItem value={300}>10 meses</MenuItem>
                <MenuItem value={365}>12 meses</MenuItem>
              </Select>
            </FormControl>

            {/* Modelo */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Modelo</InputLabel>
              <Select
                value={modelosDisponibles.length > 0 ? modeloSeleccionado : ''}
                onChange={(e) => setModeloSeleccionado(e.target.value)}
                disabled={loading || loadingCatalogos || modelosDisponibles.length === 0}
                label="Modelo"
                sx={{ fontSize: "0.75rem" }}
              >
                {modelosDisponibles.map((modelo) => (
                  <Tooltip
                    key={modelo.id}
                    title={MODELO_TOOLTIPS[modelo.id] || "Modelo de predicción de demanda"}
                    placement="right"
                    arrow
                    slotProps={{
                      tooltip: { sx: { fontSize: "0.7rem", maxWidth: 280 } }
                    }}
                  >
                    <MenuItem value={modelo.id}>{modelo.nombre}</MenuItem>
                  </Tooltip>
                ))}
              </Select>
            </FormControl>

            {/* Botón de búsqueda */}
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !materialCodigo.trim()}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              sx={{ height: 40, minWidth: 120 }}
            >
              {loading ? 'Analizando...' : 'Analizar'}
            </Button>

            {/* Limpiar */}
            <Button
              type="button"
              onClick={limpiar}
              variant="outlined"
              size="small"
              sx={{
                px: 1.5,
                py: 0.75,
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "var(--fg-muted)",
                borderColor: "var(--border)",
                "&:hover": {
                  color: "var(--primary)",
                  borderColor: "var(--primary)"
                }
              }}
            >
              Limpiar
            </Button>
          </Box>
        </Box>
        </form>
      </Paper>

      {/* Detectar Cold Start - mostrar panel de simulación cuando no hay datos históricos */}
      {(() => {
        // Detectar si es un caso de cold start (sin datos históricos)
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
            <Suspense fallback={<Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2, mb: 2 }} />}>
              <Box sx={{ mb: 3 }}>
                <ForecastSimulationPanel
                  onSimulate={generateSyntheticData}
                  materialCodigo={materialCodigo}
                  disabled={loading}
                />
              </Box>
            </Suspense>
          );
        }

        // Mostrar error normal si no es cold start
        if (error) {
          return (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          );
        }

        return null;
      })()}

      {/* ForecastPlaceholder - Mostrar cuando el forecast funciono pero con historico insuficiente (< 3 registros) */}
      {!loading && !error && forecastData && !simulationMode && historicoParaGrafico && historicoParaGrafico.length < 3 && materialCodigo && (
        <Suspense fallback={<Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2, mb: 2 }} />}>
          <Box sx={{ mb: 3 }}>
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
          {/* Info del material */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, border: "1px solid var(--border)", borderRadius: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box>
                <Typography variant="h6" fontWeight={600} color="var(--fg-strong)">
                  {forecastData.material?.codigo || selectedMaterial?.codigo || materialCodigo}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {forecastData.material?.descripcion || selectedMaterial?.descripcion || t('forecast_material', 'Material')}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  label={simulationMode
                    ? t('forecast_modo_simulacion', 'Simulación')
                    : (forecastData?.nombre_modelo || getNombreModelo(modeloSeleccionado))
                  }
                  size="small"
                  color={simulationMode ? "warning" : "primary"}
                  variant="outlined"
                />
                <Chip label={`${forecastData?.dias || diasPrediccion} días`} size="small" variant="outlined" />
              </Box>
            </Box>
          </Paper>

          {/* Tabs */}
          <Box sx={{ mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              sx={{
                minHeight: 44,
                bgcolor: "var(--surface)",
                borderRadius: "8px 8px 0 0",
                borderBottom: "2px solid var(--border)",
                "& .MuiTab-root": {
                  minHeight: 44,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "var(--fg-muted)",
                  "&.Mui-selected": { color: "var(--primary)" },
                  "&:hover": { color: "var(--primary)", bgcolor: "rgba(25, 118, 210, 0.04)" },
                },
                "& .MuiTabs-indicator": { bgcolor: "var(--primary)", height: 3 },
              }}
            >
              {tabItems.map((tab, idx) => (
                <Tab key={idx} label={tab.label} icon={tab.icon} iconPosition="start" disableRipple />
              ))}
            </Tabs>
          </Box>

          {/* Contenido de tabs */}
          <Box>
            {activeTab === 0 && (
              <>
                {/* KPIs */}
                <Suspense fallback={<Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2, mb: 2 }} />}>
                  <ForecastKPIs metricas={metricas} />
                </Suspense>

                {/* Gráfico principal */}
                <Suspense fallback={<Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mb: 2 }} />}>
                  <Paper elevation={0} sx={{ p: 2, mb: 2, border: "1px solid var(--border)", borderRadius: 2 }}>
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

                {/* Acciones avanzadas */}
                <Box sx={{ display: "flex", gap: 2 }}>
                  {/* Backtesting y Comparar solo disponibles con datos reales, no en simulación */}
                  {!simulationMode && (
                    <>
                      <Button
                        onClick={handleBacktest}
                        disabled={loadingBacktest}
                        variant="outlined"
                        color="secondary"
                        startIcon={loadingBacktest ? <CircularProgress size={16} /> : <ScienceIcon />}
                        size="small"
                      >
                        {loadingBacktest ? 'Ejecutando...' : 'Backtesting'}
                      </Button>
                      <Button
                        onClick={handleCompararModelos}
                        disabled={loadingComparacion}
                        variant="outlined"
                        color="success"
                        startIcon={loadingComparacion ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
                        size="small"
                      >
                        {loadingComparacion ? 'Comparando...' : 'Comparar Modelos'}
                      </Button>
                    </>
                  )}
                  {/* En simulación, mostrar botón para volver a intentar con datos reales */}
                  {simulationMode && (
                    <Button
                      onClick={exitSimulationMode}
                      variant="outlined"
                      color="warning"
                      size="small"
                    >
                      {t('forecast_salir_simulacion', 'Salir de Simulación')}
                    </Button>
                  )}
                  <Button
                    onClick={limpiar}
                    variant="outlined"
                    color="inherit"
                    startIcon={<DeleteOutlineIcon />}
                    size="small"
                  >
                    Limpiar
                  </Button>
                </Box>
              </>
            )}

            {activeTab === 1 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Suspense fallback={<Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />}>
                  <ForecastKPIs metricas={metricas} />
                </Suspense>

                <Paper elevation={0} sx={{ p: 3, border: "1px solid var(--border)", borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)" gutterBottom>
                    {t('forecast_detalles_modelo', 'Detalles del Modelo')}
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 3, mt: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Modelo:</Typography>
                      <Typography variant="body2" fontWeight={500}>{forecastData?.nombre_modelo || getNombreModelo(modeloSeleccionado)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Datos históricos:</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {historicoInfo ? `${historicoInfo.total_registros} registros` : `${historicoParaGrafico.length} días`}
                      </Typography>
                      {historicoInfo?.fecha_inicio && (
                        <Typography variant="caption" color="text.secondary">
                          {historicoInfo.fecha_inicio} a {historicoInfo.fecha_fin}
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Predicciones:</Typography>
                      <Typography variant="body2" fontWeight={500}>{prediccionesParaGrafico.length} días</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Generado:</Typography>
                      <Typography variant="body2" fontWeight={500}>{new Date().toLocaleString()}</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            )}

            {activeTab === 2 && (
              <PredictionsTable
                predicciones={prediccionesParaGrafico}
                showIntervalos={true}
              />
            )}

            {activeTab === 3 && (
              <Suspense fallback={<Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />}>
                <PatternCharts
                  patronSemanal={forecastData.patrones?.semanal}
                  patronMensual={forecastData.patrones?.mensual}
                />
              </Suspense>
            )}
          </Box>

          {/* Panel de Backtesting */}
          {showBacktest && (
            <Suspense fallback={<Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mt: 3 }} />}>
              <Box sx={{ mt: 3 }}>
                <BacktestResults data={backtestData} loading={loadingBacktest} />
              </Box>
            </Suspense>
          )}

          {/* Panel de Comparación */}
          {showComparacion && (
            <Suspense fallback={<Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mt: 3 }} />}>
              <Box sx={{ mt: 3 }}>
                <ModelComparison data={comparacionData} loading={loadingComparacion} onSelectModel={handleSelectModelFromComparison} />
              </Box>
            </Suspense>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!forecastData && !loading && (
        <Paper elevation={0} sx={{ p: 8, border: "1px solid var(--border)", borderRadius: 2, textAlign: "center" }}>
          <BarChartIcon sx={{ fontSize: 64, color: "var(--border)", mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="var(--fg-strong)" gutterBottom>
            {t('forecast_empty_titulo', 'Analiza la demanda de un material')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: "auto" }}>
            {t('forecast_empty_descripcion', 'Ingresa el código de un material para obtener predicciones de demanda basadas en histórico de consumo.')}
          </Typography>
        </Paper>
      )}

      {/* Modal de Loading con Progreso */}
      <Modal
        open={loading}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)' }
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
              width: 360,
              bgcolor: 'background.paper',
              borderRadius: 3,
              boxShadow: 24,
              p: 4,
              outline: 'none'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AutoGraphIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600} color="var(--fg-strong)">
                  Analizando
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {materialCodigo || 'Material'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {loadingMessage}
                </Typography>
                <Typography variant="body2" fontWeight={600} color="primary.main">
                  {loadingProgress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={loadingProgress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'var(--bg-soft)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, var(--primary) 0%, var(--info) 100%)'
                  }
                }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
              Modelo: {getNombreModelo(modeloSeleccionado)} • {diasPrediccion} días
            </Typography>
          </Box>
        </Fade>
      </Modal>
    </Container>
  );
};

export default ForecastIndividual;
