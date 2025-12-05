import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { DataTable } from "../components/ui/DataTable";
import { TableSkeleton, StatCardSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { KPICard } from "../components/ui/Charts";
import { planner, solicitudes } from "../services/spm";
import {
  Wallet,
  TrendingUp,
  ListChecks,
  Calendar,
  BarChart3
} from "lucide-react";
import { useI18n } from "../context/i18n";
import { toNumber, formatCurrency } from "../utils/formatters";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { QuickAction, getTableColumns } from "./DashboardShared";

export default function DashboardPlanificador() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [stats, setStats] = useState({
    total_solicitudes: 0,
    en_aprobacion: 0,
    en_planificacion: 0,
    presupuesto_disponible: 0,
  });
  const [recent, setRecent] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Cargar datos del planificador
  useEffect(() => {
    setLoadingStats(true);
    setLoadingRecent(true);

    const statsPromises = [];

    // Cargar estadisticas generales
    statsPromises.push(
      planner.stats()
        .then((res) => {
          const payload = res?.data?.data || res?.data || {};
          setStats({
            total_solicitudes: toNumber(payload.total_solicitudes ?? payload.total ?? 0),
            en_aprobacion: toNumber(payload.en_aprobacion ?? payload.pending ?? 0),
            en_planificacion: toNumber(payload.en_planificacion ?? payload.in_process ?? 0),
            presupuesto_disponible: payload.presupuesto_disponible ?? payload.presupuesto ?? 0,
          });
        })
        .catch((err) => console.error("Error stats planner", err))
    );

    // Cargar solicitudes recientes
    if (user?.id) {
      statsPromises.push(
        solicitudes.listar({ user_id: user.id, page_size: 100 })
          .then((res) => {
            const lista = res.data.solicitudes || res.data.items || res.data || [];
            setRecent(lista.slice(0, 5));
          })
          .catch((err) => console.error("Error solicitudes usuario", err))
          .finally(() => setLoadingRecent(false))
      );
    } else {
      setLoadingRecent(false);
    }

    Promise.allSettled(statsPromises).finally(() => setLoadingStats(false));
  }, [user]);

  const columns = useMemo(() => getTableColumns(t), [t]);
  const userName = user?.nombre?.split(' ')[0] || 'Usuario';

  return (
    <div className="space-y-6">
      {/* Header con saludo */}
      <ScrollReveal>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-[var(--fg)]">
            Hola, {userName}
          </h1>
        </div>
      </ScrollReveal>

      {/* Primera fila: KPIs */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingStats ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <KPICard
                icon={<Calendar className="w-6 h-6" />}
                title={t("dash_por_planificar", "Por Planificar")}
                value={stats.en_planificacion}
                subtitle="Solicitudes aprobadas"
                borderColor="var(--warning)"
                highlight={stats.en_planificacion > 0}
                onClick={() => navigate('/planificador')}
              />
              <KPICard
                icon={<TrendingUp className="w-6 h-6" />}
                title={t("dash_total_sistema", "Total Sistema")}
                value={stats.total_solicitudes}
                subtitle="Todas las solicitudes"
                borderColor="var(--primary)"
              />
              <KPICard
                icon={<Wallet className="w-6 h-6" />}
                title={t("dash_presupuesto", "Presupuesto")}
                value={formatCurrency(stats.presupuesto_disponible)}
                subtitle="Disponible"
                borderColor="var(--success)"
              />
              <KPICard
                icon={<ListChecks className="w-6 h-6" />}
                title="En Proceso"
                value={stats.en_aprobacion}
                subtitle="En aprobacion"
                borderColor="var(--info)"
              />
            </>
          )}
        </div>
      </ScrollReveal>

      {/* Segunda fila: Tabla + Accesos Rapidos */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dash_en_proceso", "Solicitudes en Proceso")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRecent ? (
                <TableSkeleton rows={5} columns={3} />
              ) : (
                <DataTable columns={columns} rows={recent} emptyMessage="No hay solicitudes para planificar" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Accesos Rapidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <QuickAction icon={<Calendar className="w-5 h-5" />} label="Planificador" onClick={() => navigate('/planificador')} primary />
                <QuickAction icon={<BarChart3 className="w-5 h-5" />} label="KPIs" onClick={() => navigate('/kpi')} />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>
    </div>
  );
}
