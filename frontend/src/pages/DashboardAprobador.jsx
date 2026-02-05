/**
 * DashboardAprobador - Dashboard para rol aprobador
 * Material UI Implementation
 */

import React, { useEffect, useState, useMemo } from "react";
import { SPMAgGrid } from "../components/ui/SPMAgGrid";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { solicitudes } from "../services/spm";
import api from "../services/api";
import { formatCurrency, formatAlmacen, formatDate } from "../utils/formatters";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { WeeklyRequestsKpiCard } from "../components/dashboard/WeeklyRequestsKpiCard";
import StatusBadge from "../components/ui/StatusBadge";
import { getCriticidadConfig } from "../utils/styleConfig";
import { SPM_COLORS } from "../utils/chartTheme";

// MUI Components
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  CircularProgress,
  Skeleton,
} from "@mui/material";

// MUI Icons
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import InventoryIcon from "@mui/icons-material/Inventory";

// ============================================================================
// KPI CHART COMPONENTS
// ============================================================================

function DonutChart({ data, colors, labels }) {
  const total = data.reduce((sum, val) => sum + val, 0) || 1;
  const radius = 70;
  const strokeWidth = 24;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;
  let currentOffset = 0;

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
      <Box sx={{ position: "relative", width: 192, height: 192 }}>
        <svg viewBox="0 0 160 160" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="80" cy="80" r={innerRadius} fill="none" stroke="var(--bg-soft)" strokeWidth={strokeWidth} />
          {data.map((value, idx) => {
            const percentage = value / total;
            const dashLength = percentage * circumference;
            const dashOffset = currentOffset;
            currentOffset += dashLength;
            if (value === 0) return null;
            return (
              <circle
                key={idx}
                cx="80"
                cy="80"
                r={innerRadius}
                fill="none"
                stroke={colors[idx]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-dashOffset}
                strokeLinecap="round"
                style={{ transition: "all 0.5s ease" }}
              />
            );
          })}
        </svg>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="h4" fontWeight={700} color="text.primary">
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
            Total
          </Typography>
        </Box>
      </Box>
      <Stack spacing={1.5} sx={{ ml: 3 }}>
        {labels.map((label, idx) => (
          <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, bgcolor: colors[idx] }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {data[idx]}
              </Typography>
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
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <Box sx={{ position: "relative", width: 96, height: 96 }}>
      <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="48" cy="48" r={radius} stroke="var(--border)" strokeWidth="8" fill="none" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "all 0.5s ease" }}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6" fontWeight={700} color="text.primary">
          {percentage}%
        </Typography>
      </Box>
    </Box>
  );
}

// ============================================================================
// DASHBOARD APROBADOR COMPONENT
// ============================================================================

export default function DashboardAprobador() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({ todas: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 });
  const [allData, setAllData] = useState({ todas: [], pendientes: [], aprobadas: [], rechazadas: [] });
  const [loading, setLoading] = useState(true);

  // KPI state
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    solicitudes: { total: 0, aprobadas: 0, rechazadas: 0, pendientes: 0, trend: [0, 0, 0, 0, 0, 0, 0], trendPercentage: 0 },
    presupuesto: { total: 0, utilizado: 0, disponible: 0, percentage: 0, porCentro: [] },
    tiempoAprobacion: { promedio: 0, meta: 3.0 },
    materialesMasSolicitados: [],
    gruposArticulosMasSolicitados: [],
  });

  const tabKeys = ["todas", "pendientes", "aprobadas", "rechazadas"];

  // AG Grid column definitions
  const columnDefs = useMemo(() => [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      flex: 0,
      cellRenderer: (params) => (
        <span style={{
          fontFamily: "monospace",
          fontSize: "0.75rem",
          fontVariantNumeric: "tabular-nums",
          color: "var(--fg-strong)",
        }}>
          {params.value}
        </span>
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
        <span style={{
          fontSize: "0.75rem",
          color: "var(--fg-muted)",
          fontWeight: 500,
        }}>
          {params.value}
        </span>
      ),
    },
    {
      field: "created_at",
      headerName: t("dash_table_fecha", "Fecha"),
      width: 110,
      flex: 0,
      valueFormatter: (params) => formatDate(params.value),
      cellRenderer: (params) => (
        <span style={{
          fontSize: "0.75rem",
          color: "var(--fg-muted)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {formatDate(params.data?.created_at)}
        </span>
      ),
    },
    {
      field: "estado",
      headerName: t("dash_table_estado", "Estado"),
      width: 130,
      flex: 0,
      cellRenderer: (params) => {
        const row = params.data || {};
        const aprobadorNombre = [row.aprobador_nombre, row.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;
        return (
          <StatusBadge
            estado={row.estado || row.status || "Desconocido"}
            showIcon={false}
            tooltipInfo={{
              aprobador: aprobadorNombre,
              planificador: plannerNombre,
              fechaAprobacion: row.updated_at,
              fechaEnvio: row.created_at,
            }}
          />
        );
      },
    },
    {
      field: "criticidad",
      headerName: "Criticidad",
      width: 100,
      flex: 0,
      cellRenderer: (params) => {
        const criticidad = params.value || "Normal";
        const config = getCriticidadConfig(criticidad);
        return (
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: config.color,
          }}>
            {config.label}
          </span>
        );
      },
    },
    {
      field: "items",
      headerName: "Items",
      width: 70,
      flex: 0,
      valueGetter: (params) => (params.data?.items || []).length,
      cellRenderer: (params) => (
        <span style={{
          fontFamily: "monospace",
          fontSize: "0.75rem",
          fontVariantNumeric: "tabular-nums",
        }}>
          {params.value}
        </span>
      ),
    },
    {
      field: "total_monto",
      headerName: "Monto",
      width: 120,
      flex: 0,
      type: "numericColumn",
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) => formatCurrency(params.value || 0),
      cellRenderer: (params) => (
        <span style={{
          fontFamily: "monospace",
          fontSize: "0.75rem",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          display: "block",
          whiteSpace: "nowrap",
        }}>
          {formatCurrency(params.data?.total_monto || 0)}
        </span>
      ),
    },
    {
      field: "sector_nombre",
      headerName: "Sector",
      valueGetter: (params) => params.data?.sector_nombre || params.data?.sector || "-",
      cellRenderer: (params) => (
        <span style={{
          fontSize: "0.75rem",
          color: "var(--fg-muted)",
        }}>
          {params.value}
        </span>
      ),
    },
    {
      field: "centro",
      headerName: "Centro",
      valueGetter: (params) => params.data?.centro || "-",
      cellRenderer: (params) => (
        <span style={{
          fontSize: "0.75rem",
          color: "var(--fg-muted)",
        }}>
          {params.value}
        </span>
      ),
    },
    {
      field: "almacen_virtual",
      headerName: "Almacen",
      valueGetter: (params) => formatAlmacen(params.data?.almacen_virtual),
      cellRenderer: (params) => (
        <span style={{
          fontSize: "0.75rem",
          color: "var(--fg-muted)",
        }}>
          {params.value}
        </span>
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
        <span style={{
          fontSize: "0.75rem",
          color: "var(--fg-muted)",
        }}>
          {params.value}
        </span>
      ),
    },
  ], [t]);

  useEffect(() => {
    setLoading(true);
    const pendientesCall = solicitudes.listar({ estado: "Enviada", page_size: 100 }).catch(() => null);
    const aprobadasCall = solicitudes.listar({ estado: "Aprobada", page_size: 100 }).catch(() => null);
    const rechazadasCall = solicitudes.listar({ estado: "Rechazada", page_size: 100 }).catch(() => null);

    Promise.all([pendientesCall, aprobadasCall, rechazadasCall])
      .then(([pendientesRes, aprobadasRes, rechazadasRes]) => {
        const pendientesLista = pendientesRes?.data?.solicitudes || pendientesRes?.data?.items || [];
        const aprobadasLista = aprobadasRes?.data?.solicitudes || aprobadasRes?.data?.items || [];
        const rechazadasLista = rechazadasRes?.data?.solicitudes || rechazadasRes?.data?.items || [];
        const todasLista = [...pendientesLista, ...aprobadasLista, ...rechazadasLista].sort(
          (a, b) => new Date(b.fecha_creacion || b.created_at || 0) - new Date(a.fecha_creacion || a.created_at || 0)
        );

        setStats({
          todas: todasLista.length,
          pendientes: pendientesLista.length,
          aprobadas: aprobadasLista.length,
          rechazadas: rechazadasLista.length,
        });
        setAllData({
          todas: todasLista,
          pendientes: pendientesLista,
          aprobadas: aprobadasLista,
          rechazadas: rechazadasLista,
        });
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setKpiLoading(true);
        const response = await api.get("/kpis");
        if (response.data?.ok && response.data?.data) setKpiData(response.data.data);
      } catch (err) {
        console.error("Error fetching KPIs:", err);
      } finally {
        setKpiLoading(false);
      }
    };
    fetchKpis();
  }, []);

  const tabs = [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "pendientes", label: t("dash_por_aprobar", "Por Aprobar"), count: stats.pendientes },
    { key: "aprobadas", label: t("dash_aprobadas", "Aprobadas"), count: stats.aprobadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: stats.rechazadas },
  ];
  const currentData = allData[tabKeys[activeTab]] || [];

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header: Tabs */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 500,
              minWidth: "auto",
              px: 2,
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab key={tab.key} label={`${tab.label} (${tab.count})`} />
          ))}
        </Tabs>
      </Box>

      {/* Tabla principal */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Stack spacing={1}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          ) : currentData.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: "success.light", opacity: 0.6, mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {tabKeys[activeTab] === "pendientes"
                  ? t("dash_no_pending_approval", "No hay solicitudes pendientes de aprobacion")
                  : t("dash_no_requests_category", "No hay solicitudes en esta categoria")}
              </Typography>
            </Box>
          ) : (
            <SPMAgGrid
              columnDefs={columnDefs}
              rowData={currentData}
              emptyMessage={t("dash_no_requests", "No hay solicitudes")}
              onRowClick={(row) => navigate(`/solicitudes/${row.id}`)}
              height={400}
              pagination={true}
              paginationPageSize={25}
              enableQuickFilter={true}
              exportFileName="solicitudes_aprobador"
            />
          )}
        </Box>
      </Paper>

      {/* KPI SECTION */}
      {kpiLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          {/* Metricas principales */}
          <ScrollReveal delay={100}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                gap: 2,
              }}
            >
              {/* Total Solicitudes */}
              <Paper
                elevation={0}
                sx={{
                  height: 150,
                  p: 2.5,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>
                      Total Solicitudes
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="text.primary">
                      {kpiData.solicitudes.total}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "primary.lighter", display: "grid", placeItems: "center" }}>
                    <DescriptionIcon sx={{ fontSize: 24, color: "primary.main" }} />
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {kpiData.solicitudes.trendPercentage >= 0 ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "success.main" }}>
                      <TrendingUpIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2" fontWeight={600}>
                        +{kpiData.solicitudes.trendPercentage}%
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "error.main" }}>
                      <TrendingDownIcon sx={{ fontSize: 16 }} />
                      <Typography variant="body2" fontWeight={600}>
                        {kpiData.solicitudes.trendPercentage}%
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    vs mes anterior
                  </Typography>
                </Box>
              </Paper>

              {/* Tasa de Aprobacion */}
              {(() => {
                const tasaAprobacion =
                  kpiData.solicitudes.total > 0 ? Math.round((kpiData.solicitudes.aprobadas / kpiData.solicitudes.total) * 100) : 0;
                const isGood = tasaAprobacion >= 70;
                const isWarning = tasaAprobacion >= 40 && tasaAprobacion < 70;
                const statusColor = isGood ? "success" : isWarning ? "warning" : "error";
                const IconComp = isGood ? CheckCircleOutlineIcon : isWarning ? AccessTimeIcon : CancelOutlinedIcon;
                return (
                  <Paper
                    elevation={0}
                    sx={{
                      height: 150,
                      p: 2.5,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>
                          Tasa de Aprobacion
                        </Typography>
                        <Typography variant="h4" fontWeight={700} color={`${statusColor}.main`}>
                          {tasaAprobacion}%
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${statusColor}.lighter`, display: "grid", placeItems: "center" }}>
                        <IconComp sx={{ fontSize: 24, color: `${statusColor}.main` }} />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {kpiData.solicitudes.aprobadas} aprobadas de {kpiData.solicitudes.total}
                    </Typography>
                  </Paper>
                );
              })()}

              {/* Tiempo Promedio */}
              {(() => {
                const promedio = kpiData.tiempoAprobacion.promedio;
                const meta = kpiData.tiempoAprobacion.meta;
                const isGood = promedio <= meta;
                const isWarning = promedio > meta && promedio <= meta * 1.5;
                const statusColor = isGood ? "success" : isWarning ? "warning" : "error";
                return (
                  <Paper
                    elevation={0}
                    sx={{
                      height: 150,
                      p: 2.5,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>
                          Tiempo Promedio
                        </Typography>
                        <Typography variant="h4" fontWeight={700} color={`${statusColor}.main`}>
                          {promedio} dias
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${statusColor}.lighter`, display: "grid", placeItems: "center" }}>
                        <AccessTimeIcon sx={{ fontSize: 24, color: `${statusColor}.main` }} />
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {isGood ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "success.main" }}>
                          <TrendingDownIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>
                            Bajo meta
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "warning.main" }}>
                          <TrendingUpIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" fontWeight={600}>
                            Sobre meta
                          </Typography>
                        </Box>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        Meta: {meta} dias
                      </Typography>
                    </Box>
                  </Paper>
                );
              })()}

              {/* Presupuesto */}
              {(() => {
                const percentage = kpiData.presupuesto.percentage;
                const isGood = percentage < 70;
                const isWarning = percentage >= 70 && percentage <= 90;
                const statusColor = isGood ? "success" : isWarning ? "warning" : "error";
                return (
                  <Paper
                    elevation={0}
                    sx={{
                      height: 150,
                      p: 2.5,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>
                          Presupuesto
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="text.primary">
                          {formatCurrency(kpiData.presupuesto.utilizado)}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${statusColor}.lighter`, display: "grid", placeItems: "center" }}>
                        <AttachMoneyIcon sx={{ fontSize: 24, color: `${statusColor}.main` }} />
                      </Box>
                    </Box>
                    <Typography variant="body2">
                      <Typography component="span" fontWeight={600} color={`${statusColor}.main`}>
                        {percentage}%
                      </Typography>
                      <Typography component="span" color="text.secondary">
                        {" "}
                        de {formatCurrency(kpiData.presupuesto.total)}
                      </Typography>
                    </Typography>
                  </Paper>
                );
              })()}
            </Box>
          </ScrollReveal>

          {/* KPI Semanal + Donut */}
          <ScrollReveal delay={200}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
                gap: 3,
              }}
            >
              <WeeklyRequestsKpiCard data={kpiData.solicitudes.trend} trendPercentage={kpiData.solicitudes.trendPercentage} />
              <Paper
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Distribucion de Estados
                  </Typography>
                </Box>
                <Box sx={{ px: 3, pb: 2.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DonutChart
                    data={[kpiData.solicitudes.aprobadas, kpiData.solicitudes.rechazadas, kpiData.solicitudes.pendientes]}
                    colors={[SPM_COLORS.success, SPM_COLORS.error, SPM_COLORS.warning]}
                    labels={["Aprobadas", "Rechazadas", "Pendientes"]}
                  />
                </Box>
              </Paper>
            </Box>
          </ScrollReveal>

          {/* Materiales | Presupuesto */}
          <ScrollReveal delay={250}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
                gap: 3,
              }}
            >
              {/* Materiales Mas Solicitados */}
              <Paper
                elevation={0}
                sx={{
                  height: 320,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Materiales Mas Solicitados
                  </Typography>
                  <InventoryIcon sx={{ fontSize: 20, color: "primary.main" }} />
                </Box>
                <Box sx={{ px: 2.5, pb: 2.5, overflow: "auto", flex: 1 }}>
                  <Stack spacing={1.5}>
                    {(kpiData.materialesMasSolicitados || []).length > 0 ? (
                      kpiData.materialesMasSolicitados.map((m, idx) => {
                        const maxC = Math.max(...kpiData.materialesMasSolicitados.map((x) => x.cantidad), 1);
                        return (
                          <Box key={idx}>
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
                                    {idx + 1}
                                  </Typography>
                                </Box>
                                <Typography
                                  variant="body2"
                                  fontWeight={500}
                                  color="text.primary"
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={m.nombre}
                                >
                                  {m.nombre}
                                </Typography>
                              </Box>
                              <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ flexShrink: 0, ml: 1, fontVariantNumeric: "tabular-nums" }}>
                                {(m.cantidad || 0).toLocaleString()}
                              </Typography>
                            </Box>
                            <Box sx={{ height: 10, bgcolor: "grey.100", borderRadius: 1, overflow: "hidden" }}>
                              <Box
                                sx={{
                                  height: "100%",
                                  background: `linear-gradient(90deg, ${SPM_COLORS.primary}, ${SPM_COLORS.primaryLight})`,
                                  borderRadius: 1,
                                  transition: "all 0.5s ease",
                                  width: `${(m.cantidad / maxC) * 100}%`,
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

              {/* Presupuesto por Centro */}
              <Paper
                elevation={0}
                sx={{
                  height: 320,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Presupuesto por Centro
                  </Typography>
                  <AttachMoneyIcon sx={{ fontSize: 20, color: "success.main" }} />
                </Box>
                <Box sx={{ px: 2.5, pb: 2.5, overflow: "auto", flex: 1 }}>
                  <Stack spacing={1.5}>
                    {(kpiData.presupuesto.porCentro || []).length > 0 ? (
                      kpiData.presupuesto.porCentro.map((c, idx) => {
                        const maxV = Math.max(...kpiData.presupuesto.porCentro.map((x) => x.valor), 1);
                        return (
                          <Box key={idx}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color="text.primary"
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                }}
                                title={c.nombre}
                              >
                                {c.nombre}
                              </Typography>
                              <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ flexShrink: 0, ml: 1, fontVariantNumeric: "tabular-nums" }}>
                                {formatCurrency(c.valor)}
                              </Typography>
                            </Box>
                            <Box sx={{ height: 10, bgcolor: "grey.100", borderRadius: 1, overflow: "hidden" }}>
                              <Box
                                sx={{
                                  height: "100%",
                                  background: `linear-gradient(90deg, ${SPM_COLORS.success}, ${SPM_COLORS.successLight})`,
                                  borderRadius: 1,
                                  transition: "all 0.5s ease",
                                  width: `${(c.valor / maxV) * 100}%`,
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
            </Box>
          </ScrollReveal>

          {/* Resumen Presupuesto */}
          <ScrollReveal delay={300}>
            <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
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
                  <Box
                    sx={{
                      flex: 1,
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                      gap: 3,
                      width: "100%",
                    }}
                  >
                    <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, mb: 1, display: "block" }}>
                        Presupuesto Total
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="text.primary">
                        {formatCurrency(kpiData.presupuesto.total)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, mb: 1, display: "block" }}>
                        Utilizado
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {formatCurrency(kpiData.presupuesto.utilizado)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, mb: 1, display: "block" }}>
                        Disponible
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {formatCurrency(kpiData.presupuesto.disponible)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </ScrollReveal>
        </>
      )}
    </Box>
  );
}
