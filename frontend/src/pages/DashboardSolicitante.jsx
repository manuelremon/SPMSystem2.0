import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import {
  ProgressCircle,
  MiniBarChart,
} from "../components/ui/Charts";
import { solicitudes } from "../services/spm";
import {
  Bell,
  Newspaper,
  MessageSquare,
  ArrowRight,
  FileText,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Activity
} from "lucide-react";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import {
  MessageItem,
  StatusRow,
  PendingAction,
  NovedadItem,
  getTableColumns
} from "./DashboardShared";

export default function DashboardSolicitante() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [stats, setStats] = useState({
    mis_borradores: 0,
    mis_enviadas: 0,
    mis_aprobadas: 0,
    mis_rechazadas: 0,
    mis_total: 0,
  });
  const [recent, setRecent] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Cargar datos del solicitante
  useEffect(() => {
    setLoadingRecent(true);

    if (user?.id) {
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
          setStats({
            mis_borradores: borradores,
            mis_enviadas: enviadas,
            mis_aprobadas: aprobadas,
            mis_rechazadas: rechazadas,
            mis_total: lista.length,
          });
          setRecent(lista.slice(0, 5));
        })
        .catch((err) => console.error("Error solicitudes usuario", err))
        .finally(() => setLoadingRecent(false));
    } else {
      setLoadingRecent(false);
    }

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
  const tasaAprobacion = stats.mis_total > 0
    ? Math.round((stats.mis_aprobadas / stats.mis_total) * 100)
    : 0;
  const weeklyData = [3, 5, 2, 8, 4, 6, 3];

  return (
    <div className="space-y-6">
      {/* Header con saludo y acciones */}
      <ScrollReveal>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-[var(--fg)]">
            Hola, {userName}
          </h1>
          <Button onClick={() => navigate('/solicitudes/nueva')} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("dash_nueva_solicitud_btn", "Nueva Solicitud")}
          </Button>
        </div>
      </ScrollReveal>

      {/* Primera fila: Mi Resumen + Mis Solicitudes Recientes (50/50) */}
      <ScrollReveal delay={100}>
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
      </ScrollReveal>

      {/* Segunda fila: Notificaciones + Novedades SPM + Mi Actividad (33/33/33) */}
      <ScrollReveal delay={200}>
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
      </ScrollReveal>
    </div>
  );
}
