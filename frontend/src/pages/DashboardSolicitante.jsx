/**
 * DashboardSolicitante - Dashboard para usuarios solicitantes
 * Chart.js Implementation
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Button,
  Tabs,
  Tab,
  Chip,
  Stack,
  Grid,
  CircularProgress,
  Tooltip,
} from "@mui/material";

// MUI Icons
import DescriptionIcon from "@mui/icons-material/Description";
import AddIcon from "@mui/icons-material/Add";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import InventoryIcon from "@mui/icons-material/Inventory";
import BarChartIcon from "@mui/icons-material/BarChart";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

// Custom components
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { ParallaxSection } from "../components/ui/ParallaxSection";
import { WeeklyRequestsKpiCard } from "../components/dashboard/WeeklyRequestsKpiCard";
import { SPMDoughnut, SPMGauge } from "../components/ui/SPMChartJS";

// Services and utilities
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { formatCurrency, formatAlmacen, formatDate } from "../utils/formatters";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import StatusBadge from "../components/ui/StatusBadge";
import { getCriticidadConfig } from "../utils/styleConfig";
import { SPM_COLORS } from "../utils/chartTheme";

// KPI CHART COMPONENTS using Chart.js
function DonutChart({ data, colors, labels }) {
  const total = data.reduce((sum, val) => sum + val, 0) || 1;

  // Convert data to SPMDoughnut format
  const chartData = labels.map((label, idx) => ({
    label,
    value: data[idx],
    color: colors[idx],
  }));

  return (
    <Box sx={{ position: "relative", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Box sx={{ position: "relative", width: 192, height: 192 }}>
        <SPMDoughnut
          data={chartData}
          height={192}
          centerText={total}
          options={{
            plugins: {
              legend: { display: false },
            },
          }}
        />
      </Box>
      <Stack spacing={1.5} sx={{ ml: 3 }}>
        {labels.map((label, idx) => (
          <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, bgcolor: colors[idx] }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">{data[idx]}</Typography>
              <Typography variant="caption" color="text.disabled">
                ({total > 0 ? Math.round((data[idx] / total) * 100) : 0}%)
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function ProgressCircle({ percentage, color = "var(--primary)" }) {
  return (
    <Box sx={{ position: "relative", width: 96, height: 96 }}>
      <SPMGauge
        value={percentage}
        max={100}
        height={96}
        unit="%"
        thresholds={{ warning: 70, danger: 90 }}
      />
    </Box>
  );
}

export default function DashboardSolicitante() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({ todas: 0, borradores: 0, enviadas: 0, aprobadas: 0, rechazadas: 0 });
  const [allData, setAllData] = useState({ todas: [], borradores: [], enviadas: [], aprobadas: [], rechazadas: [] });
  const [loading, setLoading] = useState(true);

  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0,0,0,0,0,0,0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0 },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  });

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    solicitudes.listar({ user_id: user.id, page_size: 100 })
      .then((res) => {
        const lista = res.data.solicitudes || res.data.items || res.data || [];
        const borradores = [], enviadas = [], aprobadas = [], rechazadas = [];
        lista.forEach(s => {
          const estado = (s.status || s.estado || "").toLowerCase();
          if (estado === "borrador" || estado === "draft") borradores.push(s);
          else if (estado === "enviada" || estado === "submitted" || estado === "pendiente_de_aprobacion") enviadas.push(s);
          else if (estado === "aprobada" || estado === "approved") aprobadas.push(s);
          else if (estado === "rechazada" || estado === "rejected") rechazadas.push(s);
        });
        setStats({ todas: lista.length, borradores: borradores.length, enviadas: enviadas.length, aprobadas: aprobadas.length, rechazadas: rechazadas.length });
        setAllData({ todas: lista, borradores, enviadas, aprobadas, rechazadas });
      })
      .catch((err) => console.error("Error solicitudes usuario", err))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setKpiLoading(true);
        const response = await api.get("/kpis");
        if (response.data?.ok && response.data?.data) setKpiData(response.data.data);
      } catch (err) { console.error("Error fetching KPIs:", err); }
      finally { setKpiLoading(false); }
    };
    fetchKpis();
  }, []);

  // Columnas para SPMAgGrid (formato AG Grid)
  const columnDefs = useMemo(() => [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            color: "slate.700",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "solicitante",
      headerName: t("dash_table_solicitante", "Solicitante"),
      valueGetter: (params) => {
        const nombre = [params.data?.solicitante_nombre, params.data?.solicitante_apellido]
          .filter(Boolean).join(" ").trim();
        return nombre || "-";
      },
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontWeight: 500,
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "created_at",
      headerName: t("dash_table_fecha", "Fecha"),
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDate(params.value)}
        </Typography>
      ),
    },
    {
      field: "estado",
      headerName: t("dash_table_estado", "Estado"),
      cellRenderer: (params) => {
        const row = params.data;
        const aprobadorNombre = [row?.aprobador_nombre, row?.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [row?.planner_nombre, row?.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;
        return (
          <StatusBadge
            estado={row?.estado || row?.status || "Desconocido"}
            showIcon={false}
            tooltipInfo={{
              aprobador: aprobadorNombre,
              planificador: plannerNombre,
              fechaAprobacion: row?.updated_at,
              fechaEnvio: row?.created_at,
            }}
          />
        );
      },
    },
    {
      field: "criticidad",
      headerName: "Criticidad",
      cellRenderer: (params) => {
        const criticidad = params.value || "Normal";
        const config = getCriticidadConfig(criticidad);
        return (
          <Typography
            component="span"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: config.color,
            }}
          >
            {config.label}
          </Typography>
        );
      },
    },
    {
      field: "items",
      headerName: "Items",
      width: 80,
      valueGetter: (params) => (params.data?.items || []).length,
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "total_monto",
      headerName: "Monto",
      width: 120,
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      cellRenderer: (params) => (
        <Box
          component="span"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {formatCurrency(params.value || 0)}
        </Box>
      ),
    },
    {
      field: "sector_nombre",
      headerName: "Sector",
      valueGetter: (params) => params.data?.sector_nombre || params.data?.sector || "-",
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "centro",
      headerName: "Centro",
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "almacen_virtual",
      headerName: "Almacen",
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {formatAlmacen(params.value)}
        </Typography>
      ),
    },
    {
      field: "planificador",
      headerName: "Planificador",
      valueGetter: (params) => {
        const plannerNombre = [params.data?.planner_nombre, params.data?.planner_apellido]
          .filter(Boolean).join(" ").trim();
        return plannerNombre || "-";
      },
      cellRenderer: (params) => (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
  ], [t]);
  const tabKeys = ["todas", "borradores", "enviadas", "aprobadas", "rechazadas"];
  const tabs = [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "borradores", label: t("dash_borradores", "Borradores"), count: stats.borradores },
    { key: "enviadas", label: t("dash_enviadas", "Enviadas"), count: stats.enviadas },
    { key: "aprobadas", label: t("dash_aprobadas", "Aprobadas"), count: stats.aprobadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: stats.rechazadas },
  ];
  const currentData = allData[tabKeys[activeTab]] || [];

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getTableTitle = () => {
    switch (tabKeys[activeTab]) {
      case "todas": return t("dash_mis_solicitudes", "Mis Solicitudes");
      case "borradores": return t("dash_borradores_title", "Mis Borradores");
      case "enviadas": return t("dash_enviadas_title", "Solicitudes Enviadas");
      case "aprobadas": return t("dash_aprobadas_title", "Solicitudes Aprobadas");
      case "rechazadas": return t("dash_rechazadas_title", "Solicitudes Rechazadas");
      default: return t("dash_solicitudes", "Solicitudes");
    }
  };

  return (
    <Stack spacing={3}>
      {/* Contenedor unificado: Tabs + Tabla de Solicitudes */}
      <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
        {/* Header con tabs */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                minHeight: 48,
                fontWeight: 500,
              },
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={tab.key}
                label={`${tab.label} (${tab.count})`}
              />
            ))}
          </Tabs>
        </Box>

        {/* Tabla */}
        <Box sx={{ p: 2 }}>
          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : currentData.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <DescriptionIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2, opacity: 0.6 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {stats.todas === 0
                  ? t("dash_no_requests_user", "No tienes solicitudes. Crea tu primera solicitud.")
                  : t("dash_no_requests_category", "No hay solicitudes en esta categoria")}
              </Typography>
              {stats.todas === 0 && (
                <Button
                  component={Link}
                  to="/solicitudes/nueva"
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{ textTransform: "none" }}
                >
                  {t("dash_create_first", "Crear solicitud")}
                </Button>
              )}
            </Box>
          ) : (
            <SPMAgGrid
              columnDefs={columnDefs}
              rowData={currentData}
              emptyMessage={t("dash_no_requests", "No hay solicitudes")}
              onRowClick={(row) => navigate(`/solicitudes/${row.id}`)}
              height={400}
              pagination={true}
              paginationPageSize={10}
              enableQuickFilter={true}
              exportFileName="dashboard_solicitante"
            />
          )}
        </Box>
      </Paper>

      {kpiLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          <ParallaxSection.Light>
            <ScrollReveal delay={100}>
              <Grid container spacing={2}>
                {/* Total Solicitudes Card */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper
                    sx={{
                      height: 150,
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: "rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(12px)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>
                            Total Solicitudes
                          </Typography>
                          <Tooltip title="Numero total de solicitudes que has creado, incluyendo borradores, enviadas, aprobadas y rechazadas." arrow>
                            <HelpOutlineIcon sx={{ fontSize: 14, color: "text.disabled", cursor: "help" }} />
                          </Tooltip>
                        </Box>
                        <Typography variant="h4" fontWeight={700} color="text.primary">
                          {kpiData.solicitudes.total}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 3,
                          bgcolor: "primary.lighter",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <DescriptionIcon sx={{ fontSize: 24, color: "primary.main" }} />
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {kpiData.solicitudes.trendPercentage >= 0 ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "success.main" }}>
                          <TrendingUpIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>+{kpiData.solicitudes.trendPercentage}%</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "error.main" }}>
                          <TrendingDownIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>{kpiData.solicitudes.trendPercentage}%</Typography>
                        </Box>
                      )}
                      <Typography variant="body2" color="text.secondary">vs mes anterior</Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Tasa de Aprobacion Card */}
                <Grid item xs={12} md={6} lg={3}>
                  {(() => {
                    const tasa = kpiData.solicitudes.total > 0 ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100) : 0;
                    const isGood = tasa >= 70, isWarning = tasa >= 40 && tasa < 70;
                    const bgColor = isGood ? "success.lighter" : isWarning ? "warning.lighter" : "error.lighter";
                    const iconColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                    const textColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                    const Icon = isGood ? CheckCircleIcon : isWarning ? AccessTimeIcon : CancelIcon;
                    return (
                      <Paper
                        sx={{
                          height: 150,
                          p: 2.5,
                          borderRadius: 2,
                          bgcolor: "rgba(255, 255, 255, 0.7)",
                          backdropFilter: "blur(12px)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>
                                Tasa de Aprobacion
                              </Typography>
                              <Tooltip title="Porcentaje de solicitudes aprobadas del total enviadas. Verde >=70% (bueno), amarillo 40-70% (mejorable), rojo <40% (critico)." arrow>
                                <HelpOutlineIcon sx={{ fontSize: 14, color: "text.disabled", cursor: "help" }} />
                              </Tooltip>
                            </Box>
                            <Typography variant="h4" fontWeight={700} color={textColor}>
                              {tasa}%
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 3,
                              bgcolor: bgColor,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Icon sx={{ fontSize: 24, color: iconColor }} />
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
                        </Typography>
                      </Paper>
                    );
                  })()}
                </Grid>

                {/* Tiempo Promedio Card */}
                <Grid item xs={12} md={6} lg={3}>
                  {(() => {
                    const prom = kpiData.tiempoAprobacion.promedio, meta = kpiData.tiempoAprobacion.meta;
                    const isGood = prom <= meta, isWarning = prom > meta && prom <= meta * 1.5;
                    const bgColor = isGood ? "success.lighter" : isWarning ? "warning.lighter" : "error.lighter";
                    const iconColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                    const valueColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                    return (
                      <Paper
                        sx={{
                          height: 150,
                          p: 2.5,
                          borderRadius: 2,
                          bgcolor: "rgba(255, 255, 255, 0.7)",
                          backdropFilter: "blur(12px)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>
                                Tiempo Promedio
                              </Typography>
                              <Tooltip title="Dias promedio que tardan tus solicitudes en ser aprobadas. La meta es 3 dias o menos." arrow>
                                <HelpOutlineIcon sx={{ fontSize: 14, color: "text.disabled", cursor: "help" }} />
                              </Tooltip>
                            </Box>
                            <Typography variant="h4" fontWeight={700} color={valueColor}>
                              {prom} dias
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 3,
                              bgcolor: bgColor,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <AccessTimeIcon sx={{ fontSize: 24, color: iconColor }} />
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {isGood ? (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "success.main" }}>
                              <TrendingDownIcon sx={{ fontSize: 16 }} />
                              <Typography variant="body2" fontWeight={600}>Bajo meta</Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "warning.main" }}>
                              <TrendingUpIcon sx={{ fontSize: 16 }} />
                              <Typography variant="body2" fontWeight={600}>Sobre meta</Typography>
                            </Box>
                          )}
                          <Typography variant="body2" color="text.secondary">Meta: {meta} dias</Typography>
                        </Box>
                      </Paper>
                    );
                  })()}
                </Grid>

                {/* Presupuesto Card */}
                <Grid item xs={12} md={6} lg={3}>
                  {(() => {
                    const pct = kpiData.presupuesto.percentage;
                    const isGood = pct < 70, isWarning = pct >= 70 && pct <= 90;
                    const bgColor = isGood ? "success.lighter" : isWarning ? "warning.lighter" : "error.lighter";
                    const iconColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                    const textColor = isGood ? "success.main" : isWarning ? "warning.main" : "error.main";
                    return (
                      <Paper
                        sx={{
                          height: 150,
                          p: 2.5,
                          borderRadius: 2,
                          bgcolor: "rgba(255, 255, 255, 0.7)",
                          backdropFilter: "blur(12px)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500 }}>
                                Presupuesto
                              </Typography>
                              <Tooltip title="Porcentaje del presupuesto consumido en el periodo actual. Muestra cuanto has gastado del total asignado." arrow>
                                <HelpOutlineIcon sx={{ fontSize: 14, color: "text.disabled", cursor: "help" }} />
                              </Tooltip>
                            </Box>
                            <Typography variant="h5" fontWeight={700} color="text.primary">
                              {formatCurrency(kpiData.presupuesto.utilizado)}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 3,
                              bgcolor: bgColor,
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <AttachMoneyIcon sx={{ fontSize: 24, color: iconColor }} />
                          </Box>
                        </Box>
                        <Typography variant="body2">
                          <Typography component="span" fontWeight={600} color={textColor}>{pct}%</Typography>
                          <Typography component="span" color="text.secondary"> de {formatCurrency(kpiData.presupuesto.total)}</Typography>
                        </Typography>
                      </Paper>
                    );
                  })()}
                </Grid>
              </Grid>
            </ScrollReveal>
          </ParallaxSection.Light>

          <ParallaxSection.Moderate>
            <ScrollReveal delay={200}>
              <Grid container spacing={3}>
                {/* KPI Card compacta con sparkline */}
                <Grid item xs={12} lg={6}>
                  <WeeklyRequestsKpiCard
                    data={kpiData.solicitudes.trend}
                    trendPercentage={kpiData.solicitudes.trendPercentage}
                  />
                </Grid>

                {/* Distribucion de Estados */}
                <Grid item xs={12} lg={6}>
                  <Paper
                    sx={{
                      borderRadius: 2,
                      bgcolor: "rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <Box
                      sx={{
                        px: 3,
                        pt: 2.5,
                        pb: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        Distribucion de Estados
                      </Typography>
                      <BarChartIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                    </Box>
                    <Box sx={{ px: 3, pb: 2.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <DonutChart
                        data={[kpiData.solicitudes.aprobadas, kpiData.solicitudes.rechazadas, kpiData.solicitudes.pendientes]}
                        colors={[SPM_COLORS.success, SPM_COLORS.error, SPM_COLORS.warning]}
                        labels={["Aprobadas", "Rechazadas", "Pendientes"]}
                      />
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </ScrollReveal>
          </ParallaxSection.Moderate>

          <ParallaxSection.Subtle>
            <ScrollReveal delay={250}>
              <Grid container spacing={3}>
                {/* Materiales Mas Solicitados */}
                <Grid item xs={12} lg={6}>
                  <Paper
                    sx={{
                      height: 320,
                      borderRadius: 2,
                      bgcolor: "rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(12px)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Box
                      sx={{
                        px: 2.5,
                        pt: 2.5,
                        pb: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        Materiales Mas Solicitados
                      </Typography>
                      <InventoryIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                    </Box>
                    <Box sx={{ px: 2.5, pb: 2.5, overflow: "auto", flex: 1 }}>
                      <Stack spacing={1.5}>
                        {(kpiData.materialesMasSolicitados || []).length > 0 ? (
                          kpiData.materialesMasSolicitados.map((m, i) => {
                            const maxC = Math.max(...kpiData.materialesMasSolicitados.map(x => x.cantidad), 1);
                            return (
                              <Box key={i}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}>
                                    <Box
                                      sx={{
                                        flexShrink: 0,
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        bgcolor: "primary.lighter",
                                        display: "grid",
                                        placeItems: "center",
                                      }}
                                    >
                                      <Typography variant="caption" fontWeight={700} color="primary.main">
                                        {i + 1}
                                      </Typography>
                                    </Box>
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                      color="text.primary"
                                      title={m.nombre}
                                      sx={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {m.nombre}
                                    </Typography>
                                  </Box>
                                  <Typography
                                    variant="caption"
                                    fontWeight={600}
                                    color="text.primary"
                                    sx={{ flexShrink: 0, ml: 1, fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {(m.cantidad || 0).toLocaleString()}
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    height: 10,
                                    bgcolor: "grey.100",
                                    borderRadius: 2,
                                    overflow: "hidden",
                                  }}
                                >
                                  <Box
                                    sx={{
                                      height: "100%",
                                      background: `linear-gradient(to right, ${SPM_COLORS.primary}, ${SPM_COLORS.info})`,
                                      borderRadius: 2,
                                      transition: "all 500ms",
                                      width: `${(m.cantidad / maxC) * 100}%`,
                                      "&:hover": {
                                        background: `linear-gradient(to right, ${SPM_COLORS.primary}, ${SPM_COLORS.primary})`,
                                      },
                                    }}
                                  />
                                </Box>
                              </Box>
                            );
                          })
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                            No hay datos disponibles
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>

                {/* Presupuesto por Centro */}
                <Grid item xs={12} lg={6}>
                  <Paper
                    sx={{
                      height: 320,
                      borderRadius: 2,
                      bgcolor: "rgba(255, 255, 255, 0.7)",
                      backdropFilter: "blur(12px)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Box
                      sx={{
                        px: 2.5,
                        pt: 2.5,
                        pb: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        Presupuesto por Centro
                      </Typography>
                      <AttachMoneyIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                    </Box>
                    <Box sx={{ px: 2.5, pb: 2.5, overflow: "auto", flex: 1 }}>
                      <Stack spacing={1.5}>
                        {(kpiData.presupuesto.porCentro || []).length > 0 ? (
                          kpiData.presupuesto.porCentro.map((c, i) => {
                            const maxV = Math.max(...kpiData.presupuesto.porCentro.map(x => x.valor), 1);
                            return (
                              <Box key={i}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                                  <Typography
                                    variant="body2"
                                    fontWeight={500}
                                    color="text.primary"
                                    title={c.nombre}
                                    sx={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      flex: 1,
                                    }}
                                  >
                                    {c.nombre}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    fontWeight={600}
                                    color="text.primary"
                                    sx={{ flexShrink: 0, ml: 1, fontVariantNumeric: "tabular-nums" }}
                                  >
                                    {formatCurrency(c.valor)}
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    height: 10,
                                    bgcolor: "grey.100",
                                    borderRadius: 2,
                                    overflow: "hidden",
                                  }}
                                >
                                  <Box
                                    sx={{
                                      height: "100%",
                                      background: `linear-gradient(to right, ${SPM_COLORS.success}, ${SPM_COLORS.successLight})`,
                                      borderRadius: 2,
                                      transition: "all 500ms",
                                      width: `${(c.valor / maxV) * 100}%`,
                                      "&:hover": {
                                        background: `linear-gradient(to right, ${SPM_COLORS.successLight}, ${SPM_COLORS.success})`,
                                      },
                                    }}
                                  />
                                </Box>
                              </Box>
                            );
                          })
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                            No hay datos disponibles
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </ScrollReveal>
          </ParallaxSection.Subtle>

          <ParallaxSection.Light>
            <ScrollReveal delay={300}>
              <Paper
                sx={{
                  borderRadius: 2,
                  bgcolor: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Resumen de Presupuesto
                  </Typography>
                </Box>
                <Box sx={{ px: 3, pb: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 4,
                    }}
                  >
                    <Box sx={{ flexShrink: 0 }}>
                      <ProgressCircle percentage={kpiData.presupuesto.percentage} />
                    </Box>
                    <Grid container spacing={3} sx={{ flex: 1, width: "100%" }}>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500, display: "block", mb: 1 }}
                          >
                            Presupuesto Total
                          </Typography>
                          <Typography variant="h5" fontWeight={700} color="text.primary">
                            {formatCurrency(kpiData.presupuesto.total)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500, display: "block", mb: 1 }}
                          >
                            Utilizado
                          </Typography>
                          <Typography variant="h5" fontWeight={700} color="warning.main">
                            {formatCurrency(kpiData.presupuesto.utilizado)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 500, display: "block", mb: 1 }}
                          >
                            Disponible
                          </Typography>
                          <Typography variant="h5" fontWeight={700} color="success.main">
                            {formatCurrency(kpiData.presupuesto.disponible)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </Paper>
            </ScrollReveal>
          </ParallaxSection.Light>
        </>
      )}
    </Stack>
  );
}
