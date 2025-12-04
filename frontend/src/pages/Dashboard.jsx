import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { TableSkeleton, StatCardSkeleton } from "../components/ui/Skeleton";
import {
  KPICard,
  ProgressCircle,
  ProgressBar,
  TrendLine,
  MiniBarChart,
  TrendIndicator,
  StatItem
} from "../components/ui/Charts";
import { planner, solicitudes } from "../services/spm";
import {
  Bell,
  Wallet,
  Newspaper,
  TrendingUp,
  ListChecks,
  ClipboardCheck,
  MessageSquare,
  Clock,
  ArrowRight,
  FileText,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Send,
  User,
  Settings,
  Calendar,
  AlertCircle,
  Plus,
  BarChart3,
  Activity
} from "lucide-react";
import { useI18n } from "../context/i18n";
import { toNumber, formatNumber, formatCurrency, formatDate } from "../utils/formatters";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [stats, setStats] = useState({
    total_solicitudes: 0,
    en_aprobacion: 0,
    en_planificacion: 0,
    presupuesto_disponible: 0,
    mis_borradores: 0,
    mis_enviadas: 0,
    mis_aprobadas: 0,
    mis_rechazadas: 0,
    mis_total: 0,
    pendientes_aprobar: 0,
    pendientes_planificar: 0,
  });
  const [recent, setRecent] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Determinar rol del usuario
  const userRoles = useMemo(() => user?.roles || [], [user]);
  const isAdmin = user?.is_admin || userRoles.some(r => ['admin', 'administrador'].includes(r?.toLowerCase?.() || r));
  const isPlanificador = userRoles.some(r => ['planificador', 'planner'].includes(r?.toLowerCase?.() || r));
  const isAprobador = userRoles.some(r => ['aprobador', 'approver', 'jefe', 'gerente1', 'gerente2', 'aprobador_solicitudes'].includes(r?.toLowerCase?.() || r));
  const isSolicitante = !isAdmin || userRoles.some(r => ['usuario', 'user', 'solicitante'].includes(r?.toLowerCase?.() || r));

  // Cargar datos
  useEffect(() => {
    setLoadingStats(true);
    setLoadingRecent(true);
    let statsPromises = [];

    // Cargar estadisticas generales (para admin/planificador)
    if (isAdmin || isPlanificador) {
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
    }

    // Cargar MIS solicitudes (para todos los usuarios)
    if (user?.id) {
      statsPromises.push(
        solicitudes.listar({ user_id: user.id, page_size: 100 })
          .then((res) => {
            const lista = res.data.solicitudes || res.data.items || res.data || [];
            let borradores = 0, enviadas = 0, aprobadas = 0, rechazadas = 0;
            lista.forEach(s => {
              const estado = (s.status || s.estado || "").toLowerCase();
              if (estado === "borrador" || estado === "draft") borradores++;
              else if (estado === "enviada" || estado === "submitted" || estado === "pendiente_de_aprobacion") enviadas++;
              else if (estado === "aprobada" || estado === "approved") aprobadas++;
              else if (estado === "rechazada" || estado === "rejected") rechazadas++;
            });
            setStats(prev => ({
              ...prev,
              mis_borradores: borradores,
              mis_enviadas: enviadas,
              mis_aprobadas: aprobadas,
              mis_rechazadas: rechazadas,
              mis_total: lista.length,
            }));
            setRecent(lista.slice(0, 5));
          })
          .catch((err) => console.error("Error solicitudes usuario", err))
          .finally(() => setLoadingRecent(false))
      );
    } else {
      setLoadingRecent(false);
    }

    // Para aprobadores: cargar pendientes de aprobacion
    if (isAprobador || isAdmin) {
      statsPromises.push(
        solicitudes.listar({ estado: "Enviada", page_size: 100 })
          .then((res) => {
            const lista = res.data.solicitudes || res.data.items || res.data || [];
            setStats(prev => ({ ...prev, pendientes_aprobar: lista.length }));
          })
          .catch((err) => console.error("Error pendientes aprobacion", err))
      );
    }

    Promise.allSettled(statsPromises).finally(() => setLoadingStats(false));

    // Cargar ultimos 4 mensajes del inbox
    setLoadingMessages(true);
    api.get("/mensajes/inbox?limit=4")
      .then((res) => {
        if (res.data.ok) {
          setInboxMessages(res.data.messages || []);
        }
      })
      .catch((err) => console.error("Error cargando mensajes", err))
      .finally(() => setLoadingMessages(false));
  }, [user, isAdmin, isPlanificador, isAprobador]);

  // Columnas de la tabla con tooltip en estado
  const columns = useMemo(() => [
    { key: "id", header: "ID", sortAccessor: (row) => Number(row.id) || 0 },
    {
      key: "estado",
      header: t("dash_table_estado", "Estado"),
      render: (row) => {
        const aprobadorNombre = [row.aprobador_nombre, row.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;

        return (
          <StatusBadge
            estado={row.estado || row.status || "Desconocido"}
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
      key: "criticidad",
      header: "Criticidad",
      render: (row) => {
        const crit = (row.criticidad || "Normal").toLowerCase();
        const colors = {
          alta: "text-red-500",
          media: "text-yellow-500",
          normal: "text-[var(--fg-muted)]",
          baja: "text-green-500",
        };
        return (
          <span className={`text-xs font-medium ${colors[crit] || colors.normal}`}>
            {row.criticidad || "Normal"}
          </span>
        );
      },
    },
    {
      key: "items",
      header: "Items",
      render: (row) => {
        const items = row.items || [];
        return <span className="text-sm">{items.length}</span>;
      },
    },
    {
      key: "monto",
      header: "Monto",
      render: (row) => (
        <span className="text-sm font-medium">{formatCurrency(row.total_monto || 0)}</span>
      ),
    },
    {
      key: "centro",
      header: "Centro",
      render: (row) => (
        <span className="text-xs text-[var(--fg-muted)]">{row.centro || "-"}</span>
      ),
    },
    {
      key: "almacen",
      header: "Almacen",
      render: (row) => (
        <span className="text-xs text-[var(--fg-muted)]">{row.almacen_virtual || "-"}</span>
      ),
    },
    {
      key: "planificador",
      header: "Planificador",
      render: (row) => {
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <span className="text-xs text-[var(--fg-muted)]">
            {plannerNombre || "-"}
          </span>
        );
      },
    },
  ], [t]);

  // Datos para el usuario
  const userName = user?.nombre?.split(' ')[0] || 'Usuario';

  // Calculos para graficos
  const tasaAprobacion = stats.mis_total > 0
    ? Math.round((stats.mis_aprobadas / stats.mis_total) * 100)
    : 0;

  // Datos para mini charts (simulados, en produccion vendrian del backend)
  const weeklyData = [3, 5, 2, 8, 4, 6, 3];

  return (
    <div className="space-y-6">
      {/* Header con saludo y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--fg)]">
          Hola, {userName}
        </h1>
        {isSolicitante && (
          <Button onClick={() => navigate('/solicitudes/nueva')} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("dash_nueva_solicitud_btn", "Nueva Solicitud")}
          </Button>
        )}
      </div>

      {/* === DASHBOARD SOLICITANTE === */}
      {isSolicitante && !isAdmin && !isPlanificador && (
        <>
          {/* Primera fila: Mi Resumen + Mis Solicitudes Recientes (50/50) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mi Resumen */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t("dash_mi_resumen", "Mi Resumen")}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-[var(--fg)]">{stats.mis_total}</span>
                    <span className="text-xs text-[var(--fg-muted)]">total</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Circulo de tasa de aprobacion */}
                  <div className="flex-shrink-0">
                    <ProgressCircle
                      percentage={tasaAprobacion}
                      size={100}
                      color="var(--success)"
                      label="Aprobadas"
                    />
                  </div>

                  {/* Desglose por estado - clickeable */}
                  <div className="flex-1 w-full space-y-3">
                    <StatusRow
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      label="Aprobadas"
                      value={stats.mis_aprobadas}
                      total={stats.mis_total}
                      color="var(--success)"
                      onClick={() => navigate('/mis-solicitudes?estado=aprobada')}
                    />
                    <StatusRow
                      icon={<Clock className="w-4 h-4" />}
                      label="En espera"
                      value={stats.mis_enviadas}
                      total={stats.mis_total}
                      color="var(--warning)"
                      onClick={() => navigate('/mis-solicitudes?estado=enviada')}
                    />
                    <StatusRow
                      icon={<FileText className="w-4 h-4" />}
                      label="Borradores"
                      value={stats.mis_borradores}
                      total={stats.mis_total}
                      color="var(--fg-muted)"
                      onClick={() => navigate('/mis-solicitudes?estado=borrador')}
                    />
                    <StatusRow
                      icon={<XCircle className="w-4 h-4" />}
                      label="Rechazadas"
                      value={stats.mis_rechazadas}
                      total={stats.mis_total}
                      color="var(--danger)"
                      onClick={() => navigate('/mis-solicitudes?estado=rechazada')}
                    />
                  </div>
                </div>

                {/* Actividad semanal */}
                <div className="mt-6 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-3">
                    Actividad Semanal
                  </p>
                  <MiniBarChart data={weeklyData} color="var(--primary)" height={40} />
                  <div className="grid grid-cols-7 gap-1 text-[10px] text-[var(--fg-muted)] text-center mt-2">
                    {["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d}>{d}</span>)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mis Solicitudes Recientes */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t("dash_mis_recientes", "Mis Solicitudes Recientes")}</CardTitle>
                  <Activity className="w-5 h-5 text-[var(--primary)]" />
                </div>
              </CardHeader>
              <CardContent>
                {loadingRecent ? (
                  <TableSkeleton rows={5} columns={3} />
                ) : (
                  <>
                    <DataTable
                      columns={columns}
                      rows={recent}
                      emptyMessage={t("dash_no_solicitudes_usuario", "No tienes solicitudes. Crea tu primera solicitud!")}
                    />
                    {recent.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => navigate('/mis-solicitudes')}
                        >
                          {t("dash_ver_todas", "Ver todas mis solicitudes")}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Segunda fila: Notificaciones + Novedades SPM + Mi Actividad (33/33/33) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Notificaciones */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-[var(--warning)]" />
                    <CardTitle className="text-base">{t("dash_notif_title", "Notificaciones")}</CardTitle>
                  </div>
                  {inboxMessages.length > 0 && (
                    <Badge variant="warning">{inboxMessages.filter(m => !m.leido).length} nuevos</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--primary)]"></div>
                  </div>
                ) : inboxMessages.length === 0 ? (
                  <div className="text-center py-6 text-[var(--fg-muted)]">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t("dash_notif_none", "Sin mensajes nuevos")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inboxMessages.slice(0, 3).map((msg) => (
                      <MessageItem key={msg.id} msg={msg} onClick={() => navigate('/mensajes')} />
                    ))}
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/mensajes')}>
                      Ver todos
                      <ArrowRight className="w-3 h-3 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Novedades SPM */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-[var(--accent)]" />
                  <CardTitle className="text-base">Novedades SPM</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <NovedadItem
                    title="Nueva version disponible"
                    description="SPM v2.0 incluye mejoras de rendimiento y nuevas funcionalidades"
                    date="Hace 2 dias"
                    type="update"
                  />
                  <NovedadItem
                    title="Mantenimiento programado"
                    description="El sistema estara en mantenimiento el domingo de 02:00 a 04:00"
                    date="Hace 5 dias"
                    type="maintenance"
                  />
                  <NovedadItem
                    title="Nuevos materiales agregados"
                    description="Se han incorporado 150 nuevos materiales al catalogo"
                    date="Hace 1 semana"
                    type="info"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Mi Actividad */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[var(--primary)]" />
                  <CardTitle className="text-base">Mi Actividad</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Acciones pendientes contextuales */}
                {stats.mis_borradores > 0 && (
                  <PendingAction
                    icon={<FileText className="w-4 h-4" />}
                    title={`${stats.mis_borradores} borrador${stats.mis_borradores > 1 ? 'es' : ''} sin enviar`}
                    description="Completa y envia tus solicitudes"
                    actionLabel="Ver"
                    onClick={() => navigate('/mis-solicitudes?estado=borrador')}
                    color="var(--fg-muted)"
                  />
                )}

                {stats.mis_rechazadas > 0 && (
                  <PendingAction
                    icon={<XCircle className="w-4 h-4" />}
                    title={`${stats.mis_rechazadas} rechazada${stats.mis_rechazadas > 1 ? 's' : ''}`}
                    description="Revisa los motivos"
                    actionLabel="Ver"
                    onClick={() => navigate('/mis-solicitudes?estado=rechazada')}
                    color="var(--danger)"
                  />
                )}

                {stats.mis_enviadas > 0 && (
                  <PendingAction
                    icon={<Clock className="w-4 h-4" />}
                    title={`${stats.mis_enviadas} en espera`}
                    description="Pendientes de aprobacion"
                    actionLabel="Ver"
                    onClick={() => navigate('/mis-solicitudes?estado=enviada')}
                    color="var(--warning)"
                  />
                )}

                {/* Si no hay acciones pendientes */}
                {stats.mis_borradores === 0 && stats.mis_rechazadas === 0 && stats.mis_enviadas === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-60" />
                    <p className="text-sm text-[var(--fg-muted)]">
                      {stats.mis_total === 0
                        ? "Sin solicitudes activas"
                        : "Todo al dia"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* === DASHBOARD APROBADOR === */}
      {isAprobador && !isAdmin && (
        <>
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
                  icon={<AlertCircle className="w-6 h-6" />}
                  title={t("dash_pendientes_aprobar", "Pendientes de Aprobar")}
                  value={stats.pendientes_aprobar}
                  subtitle={t("dash_requieren_decision", "Requieren tu decision")}
                  borderColor="var(--warning)"
                  highlight={stats.pendientes_aprobar > 0}
                  onClick={() => navigate('/aprobaciones')}
                />
                <KPICard
                  icon={<FileText className="w-6 h-6" />}
                  title={t("dash_mis_borradores", "Mis Borradores")}
                  value={stats.mis_borradores}
                  subtitle="Solicitudes propias"
                  borderColor="var(--fg-muted)"
                  onClick={() => navigate('/mis-solicitudes')}
                />
                <KPICard
                  icon={<CheckCircle2 className="w-6 h-6" />}
                  title={t("dash_mis_aprobadas", "Mis Aprobadas")}
                  value={stats.mis_aprobadas}
                  subtitle="Solicitudes propias"
                  borderColor="var(--success)"
                  onClick={() => navigate('/mis-solicitudes')}
                />
                <KPICard
                  icon={<Clock className="w-6 h-6" />}
                  title="Tiempo Promedio"
                  value="2.3 dias"
                  subtitle="Meta: 3 dias"
                  borderColor="var(--info)"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("dash_mis_recientes", "Mis Solicitudes Recientes")}</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRecent ? (
                  <TableSkeleton rows={5} columns={3} />
                ) : (
                  <DataTable columns={columns} rows={recent} emptyMessage="No hay solicitudes" />
                )}
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
                    {inboxMessages.map((msg) => (
                      <MessageItem key={msg.id} msg={msg} onClick={() => navigate('/mensajes')} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* === DASHBOARD PLANIFICADOR === */}
      {isPlanificador && !isAdmin && (
        <>
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
        </>
      )}

      {/* === DASHBOARD ADMIN === */}
      {isAdmin && (
        <>
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

          {/* Tercera fila admin */}
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
        </>
      )}
    </div>
  );
}

// === COMPONENTES AUXILIARES ===

function MessageItem({ msg, onClick }) {
  const isUnread = msg.leido === 0;
  const senderName = `${msg.remitente_nombre || ""} ${msg.remitente_apellido || ""}`.trim() || "Usuario";

  return (
    <button
      type="button"
      className={`
        w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer
        ${isUnread
          ? "bg-[var(--primary-muted)]/20 border-[var(--primary)]/30 hover:border-[var(--primary)]/50"
          : "bg-[var(--bg-soft)] border-[var(--border)] hover:border-[var(--border-hover)]"
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isUnread ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isUnread ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>
            {senderName}
          </p>
          <p className={`text-xs truncate mt-0.5 ${isUnread ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>
            {msg.asunto}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-[var(--fg-subtle)] ml-5 mt-1">
        <Clock className="w-2.5 h-2.5" />
        <span>
          {new Date(msg.created_at).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>
    </button>
  );
}

function QuickAction({ icon, label, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200
        ${primary
          ? "bg-[var(--primary)] text-white border-[var(--primary)] hover:bg-[var(--primary-bright)]"
          : "bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg)] hover:border-[var(--primary)] hover:bg-[var(--primary-muted)]/10"
        }
      `}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function StatusRow({ icon, label, value, total, color, onClick }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-soft)] transition-all group"
    >
      <span
        className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[var(--fg)]">{label}</span>
          <span className="text-sm font-bold" style={{ color }}>{value}</span>
        </div>
        <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function PendingAction({ icon, title, description, actionLabel, onClick, color = "var(--primary)" }) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] hover:border-[var(--border-hover)] transition-all group cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span
        className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--fg)] leading-tight">{title}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">{description}</p>
        <span className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 group-hover:gap-1.5 transition-all" style={{ color }}>
          {actionLabel}
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

function NovedadItem({ title, description, date, type = "info" }) {
  const typeConfig = {
    update: { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "var(--success)" },
    maintenance: { icon: <Clock className="w-3.5 h-3.5" />, color: "var(--warning)" },
    info: { icon: <Newspaper className="w-3.5 h-3.5" />, color: "var(--accent)" },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--bg-soft)] transition-colors">
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full grid place-items-center mt-0.5"
        style={{ backgroundColor: `${config.color}15`, color: config.color }}
      >
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--fg)] leading-tight">{title}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5 line-clamp-2">{description}</p>
        <p className="text-[10px] text-[var(--fg-subtle)] mt-1">{date}</p>
      </div>
    </div>
  );
}
