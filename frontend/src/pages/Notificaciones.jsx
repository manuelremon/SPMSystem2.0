import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  User,
  FileText,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { useNotifications } from "../hooks/useNotifications";

// Mapeo de tipos de notificacion a iconos y colores
const notificationConfig = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  warning: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  profile_request: { icon: User, color: "text-purple-400", bg: "bg-purple-500/10" },
  solicitud_created: { icon: FileText, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  solicitud_approved: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  solicitud_rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  solicitud_planned: { icon: Clock, color: "text-orange-400", bg: "bg-orange-500/10" },
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function Notificaciones() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [msg, setMsg] = useState("");

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh
  } = useNotifications({ enabled: !!user });

  const handleMarkAsRead = useCallback(async (notifId) => {
    const success = await markAsRead(notifId);
    if (success) {
      setMsg(t("notif_marcada_leida", "Notificacion marcada como leida"));
      setTimeout(() => setMsg(""), 2000);
    }
  }, [markAsRead, t]);

  const handleMarkAllAsRead = useCallback(async () => {
    const success = await markAllAsRead();
    if (success) {
      setMsg(t("notif_todas_leidas", "Todas las notificaciones marcadas como leidas"));
      setTimeout(() => setMsg(""), 2000);
    }
  }, [markAllAsRead, t]);

  const handleDelete = useCallback(async (notifId) => {
    if (!confirm(t("notif_confirmar_eliminar", "¿Eliminar esta notificacion?"))) return;
    const success = await deleteNotification(notifId);
    if (success) {
      setMsg(t("notif_eliminada", "Notificacion eliminada"));
      setTimeout(() => setMsg(""), 2000);
    }
  }, [deleteNotification, t]);

  const handleNotificationClick = useCallback((notif) => {
    // Marcar como leida
    if (!notif.leido) {
      markAsRead(notif.id);
    }

    // Navegar segun el tipo
    if (notif.solicitud_id) {
      // Si es una solicitud de perfil (user_profile_requests)
      if (notif.tipo === "profile_request" || notif.mensaje?.includes("cambio de perfil")) {
        navigate("/admin/solicitudes-perfil");
      } else {
        // Solicitud normal
        navigate(`/solicitudes/${notif.solicitud_id}`);
      }
    }
  }, [markAsRead, navigate]);

  const getNotifConfig = (tipo) => {
    return notificationConfig[tipo] || notificationConfig.info;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notif_title", "NOTIFICACIONES").toUpperCase()}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {t("common_refresh", "Actualizar")}
            </Button>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead}>
                <CheckCheck className="w-4 h-4 mr-2" />
                {t("notif_marcar_todas", "Marcar todas como leidas")}
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--primary)]" />
            {t("notif_subtitle", "Centro de Notificaciones")}
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold">
                {unreadCount} {t("notif_sin_leer", "sin leer")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && notifications.length === 0 ? (
            <div className="text-center py-12 text-[var(--fg-muted)]">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>{t("common_cargando", "Cargando...")}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-[var(--fg-muted)]">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">{t("notif_empty", "No tienes notificaciones")}</p>
              <p className="text-sm mt-1">{t("notif_empty_desc", "Cuando recibas alertas del sistema, apareceran aqui")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {notifications.map((notif) => {
                const config = getNotifConfig(notif.tipo);
                const IconComponent = config.icon;

                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-[var(--surface)] ${
                      !notif.leido ? "bg-[var(--primary)]/5" : ""
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {/* Icono */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                      <IconComponent className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.leido ? "font-semibold text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>
                        {notif.mensaje}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-[var(--fg-subtle)]" />
                        <span className="text-xs text-[var(--fg-subtle)]">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                        {notif.solicitud_id && (
                          <>
                            <span className="text-[var(--fg-subtle)]">•</span>
                            <span className="text-xs text-[var(--primary)]">
                              #{notif.solicitud_id}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {!notif.leido && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--success)] transition-colors"
                          title={t("notif_marcar_leida", "Marcar como leida")}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--danger)] transition-colors"
                        title={t("notif_eliminar", "Eliminar")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Indicador no leido */}
                    {!notif.leido && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--primary)] mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
