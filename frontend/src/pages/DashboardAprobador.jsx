import React, { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { DataTable } from "../components/ui/DataTable";
import { TableSkeleton, StatCardSkeleton } from "../components/ui/Skeleton";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { KPICard } from "../components/ui/Charts";
import { solicitudes } from "../services/spm";
import {
  Bell,
  AlertCircle,
  FileText,
  CheckCircle2,
  Clock
} from "lucide-react";
import { useI18n } from "../context/i18n";
import { toNumber } from "../utils/formatters";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { MessageItem, getTableColumns } from "./DashboardShared";

export default function DashboardAprobador() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [stats, setStats] = useState({
    mis_borradores: 0,
    mis_aprobadas: 0,
    pendientes_aprobar: 0,
  });
  const [recent, setRecent] = useState([]);
  const [inboxMessages, setInboxMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Cargar datos del aprobador
  useEffect(() => {
    setLoadingStats(true);
    setLoadingRecent(true);

    const statsPromises = [];

    // Cargar MIS solicitudes
    if (user?.id) {
      statsPromises.push(
        solicitudes.listar({ user_id: user.id, page_size: 100 })
          .then((res) => {
            const lista = res.data.solicitudes || res.data.items || res.data || [];
            let borradores = 0, aprobadas = 0;
            lista.forEach(s => {
              const estado = (s.status || s.estado || "").toLowerCase();
              if (estado === "borrador" || estado === "draft") borradores++;
              else if (estado === "aprobada" || estado === "approved") aprobadas++;
            });
            setStats(prev => ({
              ...prev,
              mis_borradores: borradores,
              mis_aprobadas: aprobadas,
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
      </ScrollReveal>

      {/* Segunda fila: Tabla + Notificaciones */}
      <ScrollReveal delay={200}>
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
      </ScrollReveal>
    </div>
  );
}
