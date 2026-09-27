/**
 * Admin Estado - Dashboard de estado del sistema
 *
 * Reorganizado por importancia:
 * - TIER 1: Alertas, Salud del Sistema, Metricas de Negocio
 * - TIER 2: Metricas de Requests, Estado de BD
 * - TIER 3: Metricas Tecnicas (colapsables), Graficos Historicos
 * - TIER 4: Panel de Control
 */

import { useI18n } from "../../../context/i18n";
import PageLayout from "../../../components/ui/PageLayout";

// MUI Components
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
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
            <SingleMetricChart data={historyData} metricType="cache_hit" title={t("admin_estado_cache_hit", "Tasa de aciertos de caché")} height={150} />
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
function LoadingState({ t }) {
  return (
    <PageLayout title={t("admin_estado", "Estado del sistema")} backTo="/admin">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={96} />
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
        <Skeleton variant="rounded" height={256} />
        <Skeleton variant="rounded" height={256} />
      </Box>
    </PageLayout>
  );
}

/**
 * Componente principal
 */
export default function AdminEstado() {
  const { t } = useI18n();
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
    return <LoadingState t={t} />;
  }

  return (
    <PageLayout
      title={t("admin_estado", "Estado del sistema")}
      subtitle={t("admin_estado_subtitle", "Monitoreo en tiempo real")}
      backTo="/admin"
      actions={
        <>
          {lastUpdate && (
            <Typography variant="caption" sx={{ color: "var(--fg-subtle)" }}>
              {t("updated", "Actualizado")}: {lastUpdate.toLocaleTimeString("es-AR")}
            </Typography>
          )}
          <Tooltip title={t("common_actualizar", "Actualizar")}>
            <span>
              <IconButton onClick={fetchData} disabled={loading} size="small" sx={{ color: "var(--fg-muted)" }} aria-label={t("common_actualizar", "Actualizar")}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
    >
      {/* Error */}
      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* ===== TIER 1: CRITICO ===== */}

      {/* 1. Alertas Activas (solo si hay) */}
      {activeAlerts && activeAlerts.length > 0 && (
        <Box>
          <AlertsPanel
            alerts={activeAlerts}
            onAcknowledge={handleAcknowledgeAlert}
            onAcknowledgeAll={handleAcknowledgeAllAlerts}
            acknowledging={acknowledging}
          />
        </Box>
      )}

      {/* 2. Estado de Salud del Sistema */}
      <Box>
        <HealthStatus health={health} cacheHitRate={overallCacheHit} />
      </Box>

      {/* 3. Metricas de Negocio */}
      <Box>
        <BusinessMetricsPanel data={businessMetrics} isLoading={loading} />
      </Box>

      {/* ===== TIER 2: IMPORTANTE ===== */}

      {/* 4. Metricas de Requests */}
      <Box>
        <RequestMetrics metrics={metrics} health={health} errorRate={errorRate} />
      </Box>

      {/* 5. Estado de Base de Datos */}
      <Box>
        <DatabaseStatus dbStats={dbStats} />
      </Box>

      {/* ===== TIER 3: TECNICO (Colapsables) ===== */}

      {/* 6. Metricas Tecnicas (Latencia, Cache, Sistema, Infraestructura) */}
      <Box>
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
      <Box>
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
    </PageLayout>
  );
}
