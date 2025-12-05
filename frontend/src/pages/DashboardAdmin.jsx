import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { DataTable } from "../components/ui/DataTable";
import { TableSkeleton, StatCardSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import {
  KPICard,
  ProgressBar,
  TrendLine
} from "../components/ui/Charts";
import { planner, solicitudes } from "../services/spm";
import {
  Bell,
  Wallet,
  TrendingUp,
  ListChecks,
  ClipboardCheck,
  Settings,
  Calendar,
  BarChart3
} from "lucide-react";
import { useI18n } from "../context/i18n";
import { toNumber, formatCurrency } from "../utils/formatters";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { MessageItem, QuickAction, getTableColumns } from "./DashboardShared";

export default function DashboardAdmin() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [stats, setStats] = useState({
    total_solicitudes: 0,
    en_aprobacion: 0,
    en_planificacion: 0,
    presupuesto_disponible: 0,
    pendientes_aprobar: 0,
    mis_aprobadas: 0,
    mis_rechazadas: 0,
  });
  const [recent, setRecent] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Cargar datos del administrador
  useEffect(() => {
    setLoadingStats(true);
    setLoadingRecent(true);

    const statsPromises = [];

    // Cargar estadisticas generales
    statsPromises.push(
      planner.stats()
        .then((res) => {
          const payload = res?.data?.data || res?.data || {};
          setStats(prev => ({
            ...prev,
            total_solicitudes: toNumber(payload.total_solicitudes ?? payload.total ?? 0),
            en_aprobacion: toNumber(payload.en_aprobacion ?? payload.pending ?? 0),
            en_planificacion: toNumber(payload.en_planificacion ?? payload.in_process ?? 0),
            presupuesto_disponible: payload.presupuesto_disponible ?? payload.presupuesto ?? 0,
          }));
        })
        .catch((err) => console.error("Error stats planner", err))
    );

    // Cargar MIS solicitudes
    if (user?.id) {
      statsPromises.push(
        solicitudes.listar({ user_id: user.id, page_size: 100 })
          .then((res) => {
            const lista = res.data.solicitudes || res.data.items || res.data || [];
            let aprobadas = 0, rechazadas = 0;
            lista.forEach(s => {
              const estado = (s.status || s.estado || "").toLowerCase();
              if (estado === "aprobada" || estado === "approved") aprobadas++;
              else if (estado === "rechazada" || estado === "rejected") rechazadas++;
            });
            setStats(prev => ({
              ...prev,
              mis_aprobadas: aprobadas,
              mis_rechazadas: rechazadas,
            }));
            setRecent(lista.slice(0, 5));
          })
          .catch((err) => console.error("Error solicitudes usuario", err))
          .finally(() => setLoadingRecent(false))
      );
    } else {
      setLoadingRecent(false);
    }

    // Cargar pendientes de aprobacion
    statsPromises.push(
      solicitudes.listar({ estado: "Enviada", page_size: 100 })
        .then((res) => {
          const lista = res.data.solicitudes || res.data.items || res.data || [];
          setStats(prev => ({ ...prev, pendientes_aprobar: lista.length }));
        })
        .catch((err) => console.error("Error pendientes aprobacion", err))
    );

    Promise.allSettled(statsPromises).finally(() => setLoadingStats(false));

    // Cargar mensajes del inbox
    setLoadingMessages(true);
    api.get("/mensajes/inbox?limit=4")
      .then((res) => {
        if (res.data.ok) {
          setInboxMessages(res.data.messages || []);
        }
      })
      .catch((err) => console.error("Error cargando mensajes", err))
      .finally(() => setLoadingMessages(false));
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
                icon={<TrendingUp className="w-6 h-6" />}
                title={t("dash_total_solicitudes", "Total Solicitudes")}
                value={stats.total_solicitudes}
                subtitle="En el sistema"
                trend={12.5}
                trendLabel="vs mes anterior"
                borderColor="var(--primary)"
              />
              <KPICard
                icon={<ClipboardCheck className="w-6 h-6" />}
                title={t("dash_en_aprobacion", "En Aprobacion")}
                value={stats.pendientes_aprobar || stats.en_aprobacion}
                subtitle="Pendientes de decision"
                borderColor="var(--warning)"
                highlight={stats.pendientes_aprobar > 0}
                onClick={() => navigate('/aprobaciones')}
              />
              <KPICard
                icon={<ListChecks className="w-6 h-6" />}
                title={t("dash_en_planificacion", "En Planificacion")}
                value={stats.en_planificacion}
                subtitle="Para asignar"
                borderColor="var(--success)"
                onClick={() => navigate('/planificador')}
              />
              <KPICard
                icon={<Wallet className="w-6 h-6" />}
                title={t("dash_presupuesto", "Presupuesto")}
                value={formatCurrency(stats.presupuesto_disponible)}
                subtitle="Disponible global"
                borderColor="var(--info)"
              />
            </>
          )}
        </div>
      </ScrollReveal>

      {/* Segunda fila: Tendencia + Tabla */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grafico de tendencia */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tendencia Semanal</CardTitle>
                <BarChart3 className="w-5 h-5 text-[var(--primary)]" />
              </div>
            </CardHeader>
            <CardContent>
              <TrendLine data={[45, 52, 48, 61, 58, 67, 72]} height={80} />
              <div className="grid grid-cols-7 gap-1 text-[10px] text-[var(--fg-muted)] text-center mt-2">
                {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
                <span className="text-[var(--fg-muted)]">Promedio semanal</span>
                <span className="font-semibold text-[var(--fg)]">58 solicitudes</span>
              </div>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dash_ultimas_sistema", "Ultimas Solicitudes del Sistema")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRecent ? (
                <TableSkeleton rows={5} columns={3} />
              ) : (
                <DataTable columns={columns} rows={recent} emptyMessage="No hay solicitudes" />
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>

      {/* Tercera fila: Distribucion + Notificaciones + Accesos Rapidos */}
      <ScrollReveal delay={300}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribucion de Estados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar value={stats.mis_aprobadas || 65} max={100} color="var(--success)" label="Aprobadas" showValue />
              <ProgressBar value={stats.pendientes_aprobar || 20} max={100} color="var(--warning)" label="Pendientes" showValue />
              <ProgressBar value={stats.mis_rechazadas || 15} max={100} color="var(--danger)" label="Rechazadas" showValue />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[var(--warning)]" />
                <CardTitle className="text-base">Notificaciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]"></div>
                </div>
              ) : inboxMessages.length === 0 ? (
                <p className="text-center py-6 text-[var(--fg-muted)] text-sm">Sin mensajes nuevos</p>
              ) : (
                <div className="space-y-2">
                  {inboxMessages.slice(0, 3).map((msg) => (
                    <MessageItem key={msg.id} msg={msg} onClick={() => navigate('/mensajes')} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Accesos Rapidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction icon={<Settings className="w-5 h-5" />} label="Admin" onClick={() => navigate('/admin')} primary />
                <QuickAction icon={<BarChart3 className="w-5 h-5" />} label="KPIs" onClick={() => navigate('/kpi')} />
                <QuickAction icon={<Calendar className="w-5 h-5" />} label="Planificador" onClick={() => navigate('/planificador')} />
                <QuickAction icon={<Wallet className="w-5 h-5" />} label="Presupuestos" onClick={() => navigate('/presupuestos')} />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>
    </div>
  );
}
