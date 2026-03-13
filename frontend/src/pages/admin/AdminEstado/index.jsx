/**
 * Admin Estado - Dashboard de estado del sistema
 *
 * Reorganizado por importancia:
 * - TIER 1: Alertas, Salud del Sistema, Metricas de Negocio
 * - TIER 2: Metricas de Requests, Estado de BD
 * - TIER 3: Metricas Tecnicas (colapsables), Graficos Historicos
 * - TIER 4: Panel de Control
 */

import { useNavigate } from "react-router-dom";
import { useI18n } from "../../../context/i18n";

// MUI Components
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

// Custom hook
import { useAdminEstado } from "../../../hooks/useAdminEstado";

// Componentes existentes
import { AlertsPanel } from "../../../components/admin/AlertsPanel";
import { BusinessMetricsPanel } from "../../../components/admin/BusinessMetricsPanel";
import { CpuMemoryChart, LatencyErrorChart, SingleMetricChart } from "../../../components/admin/MetricsChart";

// Componentes nuevos
import { HealthStatus } from "./HealthStatus";
import { RequestMetrics } from "./RequestMetrics";
import { DatabaseStatus } from "./DatabaseStatus";
import { TechnicalMetrics } from "./TechnicalMetrics";
import { ControlPanel } from "./ControlPanel";

/**
 * Panel de Graficos Historicos
 */
function HistoricalCharts({ historyData, selectedHours, onChangeHours }) {
  const { t } = useI18n();

  return (
    <Paper elevation={0} sx={{ border: "1px solid var(--border)", overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TrendingUpIcon sx={{ color: "var(--indigo)", fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--fg-strong)" }}>
            {t("trends", "Tendencias")} ({selectedHours}h)
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {[6, 12, 24].map((hours) => (
            <Button
              key={hours}
              variant={selectedHours === hours ? "contained" : "outlined"}
              size="small"
              onClick={() => onChangeHours(hours)}
              sx={{
                minWidth: 40,
                fontSize: "0.75rem",
                ...(selectedHours === hours
                  ? { bgcolor: "primary.main" }
                  : { color: "var(--fg-muted)", borderColor: "var(--border)" }),
              }}
            >
              {hours}h
            </Button>
          ))}
        </Box>
      </Box>
      <Box sx={{ p: 2 }}>
        {historyData && Object.keys(historyData).length > 0 ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
            <CpuMemoryChart data={historyData} height={200} />
            <LatencyErrorChart data={historyData} height={200} />
            <SingleMetricChart data={historyData} metricType="cache_hit" title="Cache Hit Rate" height={150} />
          </Box>
        ) : (
          <Box sx={{ textAlign: "center", py: 6, color: "var(--fg-subtle)" }}>
            <TrendingUpIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1.5 }} />
            <Typography variant="body2">{t("no_history_data", "Sin datos históricos")}</Typography>
            <Typography variant="caption" sx={{ mt: 0.5, display: "block" }}>
              {t("history_hint", "Los datos se recolectan automáticamente cada 5 minutos")}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

/**
 * Estado de carga
 */
function LoadingState({ t, navigate }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "var(--fg-muted)" }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t("admin_estado", "ESTADO DEL SISTEMA")}
          </Typography>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
          <Skeleton variant="rounded" height={256} />
          <Skeleton variant="rounded" height={256} />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Componente principal
 */
export default function AdminEstado() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const {
    // Datos
    health,
    metrics,
    cacheMetrics,
    dbMetrics,
    dbStats,
    systemMetrics,
    businessMetrics,
    infrastructure,
    historyData,
    activeAlerts,

    // Valores calculados
    errorRate,
    overallCacheHit,

    // Estado UI
    selectedHours,
    setSelectedHours,
    error,
    loading,
    autoRefresh,
    lastUpdate,
    resetting,
    acknowledging,

    // Handlers
    fetchData,
    handleResetMetrics,
    handleExport,
    handleAcknowledgeAlert,
    handleAcknowledgeAllAlerts,
    toggleAutoRefresh,
    clearError,
  } = useAdminEstado();

  // Estado de carga inicial
  if (loading) {
    return <LoadingState t={t} navigate={navigate} />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      {/* Header con ultimo update */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "var(--fg-muted)" }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t("admin_estado", "ESTADO DEL SISTEMA")}
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--fg-muted)" }}>
              {t("admin_estado_subtitle", "Monitoreo en tiempo real")}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {lastUpdate && (
            <Typography variant="caption" sx={{ color: "var(--fg-subtle)" }}>
              {t("updated", "Actualizado")}: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          <IconButton onClick={fetchData} disabled={loading} size="small" sx={{ color: "var(--fg-muted)" }}>
            <RefreshIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }} />
          </IconButton>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* ===== TIER 1: CRITICO ===== */}

      {/* 1. Alertas Activas (solo si hay) */}
      {activeAlerts && activeAlerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <AlertsPanel
            alerts={activeAlerts}
            onAcknowledge={handleAcknowledgeAlert}
            onAcknowledgeAll={handleAcknowledgeAllAlerts}
            acknowledging={acknowledging}
          />
        </Box>
      )}

      {/* 2. Estado de Salud del Sistema */}
      <Box sx={{ mb: 3 }}>
        <HealthStatus health={health} cacheHitRate={overallCacheHit} />
      </Box>

      {/* 3. Metricas de Negocio */}
      <Box sx={{ mb: 3 }}>
        <BusinessMetricsPanel data={businessMetrics} isLoading={loading} />
      </Box>

      {/* ===== TIER 2: IMPORTANTE ===== */}

      {/* 4. Metricas de Requests */}
      <Box sx={{ mb: 3 }}>
        <RequestMetrics metrics={metrics} health={health} errorRate={errorRate} />
      </Box>

      {/* 5. Estado de Base de Datos */}
      <Box sx={{ mb: 3 }}>
        <DatabaseStatus dbStats={dbStats} />
      </Box>

      {/* ===== TIER 3: TECNICO (Colapsables) ===== */}

      {/* 6. Metricas Tecnicas (Latencia, Cache, Sistema, Infraestructura) */}
      <Box sx={{ mb: 3 }}>
        <TechnicalMetrics
          metrics={metrics}
          cacheMetrics={cacheMetrics}
          dbMetrics={dbMetrics}
          systemMetrics={systemMetrics}
          health={health}
          infrastructure={infrastructure}
        />
      </Box>

      {/* 7. Graficos Historicos */}
      <Box sx={{ mb: 3 }}>
        <HistoricalCharts
          historyData={historyData}
          selectedHours={selectedHours}
          onChangeHours={setSelectedHours}
        />
      </Box>

      {/* ===== TIER 4: ACCIONES ===== */}

      {/* 8. Panel de Control */}
      <ControlPanel
        onRefresh={fetchData}
        onResetMetrics={handleResetMetrics}
        onExport={handleExport}
        onToggleAutoRefresh={toggleAutoRefresh}
        autoRefresh={autoRefresh}
        loading={loading}
        resetting={resetting}
      />
      </Box>
    </Box>
  );
}
