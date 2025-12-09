import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
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
  RefreshCw,
  Inbox,
  Wifi,
  WifiOff
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import { useRealtime } from "../hooks/useRealtime";
import { PushNotificationToggle } from "../components/ui/PushNotificationToggle";

import { MessageSquare } from "lucide-react";

// Mapeo de tipos de notificacion a iconos y colores - Glass style
const notificationConfig = {
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50/70 backdrop-blur-sm" },
  success: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50/70 backdrop-blur-sm" },
  warning: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50/70 backdrop-blur-sm" },
  error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50/70 backdrop-blur-sm" },
  profile_request: { icon: User, color: "text-purple-600", bg: "bg-purple-50/70 backdrop-blur-sm" },
  profile_approved: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50/70 backdrop-blur-sm" },
  profile_rejected: { icon: XCircle, color: "text-red-600", bg: "bg-red-50/70 backdrop-blur-sm" },
  solicitud_created: { icon: FileText, color: "text-cyan-600", bg: "bg-cyan-50/70 backdrop-blur-sm" },
  solicitud_approved: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50/70 backdrop-blur-sm" },
  solicitud_rejected: { icon: XCircle, color: "text-red-600", bg: "bg-red-50/70 backdrop-blur-sm" },
  solicitud_planned: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50/70 backdrop-blur-sm" },
  solicitud_to_plan: { icon: Clock, color: "text-orange-600", bg: "bg-orange-50/70 backdrop-blur-sm" },
  mensaje_nuevo: { icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50/70 backdrop-blur-sm" },
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
  const [activeTab, setActiveTab] = useState("unread"); // "unread" or "read"

  // Usar hook de tiempo real unificado
  const {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh
  } = useRealtime({ enabled: !!user });

  // Combinar errores
  const error = connectionError;

  // Filtrar notificaciones segun la pestaña activa
  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter(n => !n.leido);
    }
    return notifications.filter(n => n.leido);
  }, [notifications, activeTab]);

  const readCount = useMemo(() => {
    return notifications.filter(n => n.leido).length;
  }, [notifications]);

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

    // Navegar segun el tipo de notificacion
    switch (notif.tipo) {
      case "profile_request":
        navigate("/admin/solicitudes-perfil");
        break;

      case "solicitud_created":
        navigate("/aprobaciones");
        break;

      case "solicitud_approved":
      case "solicitud_rejected":
        navigate("/mis-solicitudes");
        break;

      case "solicitud_planned":
        if (notif.solicitud_id) {
          navigate(`/solicitudes/${notif.solicitud_id}`);
        } else {
          navigate("/mis-solicitudes");
        }
        break;

      case "solicitud_to_plan":
        navigate("/planificador");
        break;

      case "budget_request":
      case "budget_approved":
      case "budget_rejected":
        navigate("/presupuesto");
        break;

      case "mensaje_nuevo":
        navigate("/mensajes");
        break;

      default:
        if (notif.solicitud_id) {
          navigate(`/solicitudes/${notif.solicitud_id}`);
        } else if (notif.mensaje?.includes("cambio de perfil")) {
          navigate("/admin/solicitudes-perfil");
        } else if (notif.mensaje?.includes("presupuesto")) {
          navigate("/presupuesto");
        }
        break;
    }
  }, [markAsRead, navigate]);

  const getNotifConfig = (tipo) => {
    return notificationConfig[tipo] || notificationConfig.info;
  };

  const renderNotificationList = (notifs) => {
    if (notifs.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          <Inbox className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-400" />
          <p className="text-lg font-medium">
            {activeTab === "unread"
              ? t("notif_empty_unread", "No tienes notificaciones pendientes")
              : t("notif_empty_read", "No tienes notificaciones leidas")
            }
          </p>
          <p className="text-sm mt-1 text-slate-400">
            {activeTab === "unread"
              ? t("notif_empty_unread_desc", "¡Estas al dia!")
              : t("notif_empty_read_desc", "Las notificaciones leidas apareceran aqui")
            }
          </p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-white/30">
        {notifs.map((notif) => {
          const config = getNotifConfig(notif.tipo);
          const IconComponent = config.icon;

          return (
            <div
              key={notif.id}
              className={`flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-white/50 ${
                !notif.leido ? "bg-blue-50/30" : ""
              }`}
              onClick={() => handleNotificationClick(notif)}
            >
              {/* Icono */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                <IconComponent className={`w-5 h-5 ${config.color}`} />
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notif.leido ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                  {notif.mensaje}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400">
                    {formatTimeAgo(notif.created_at)}
                  </span>
                  {notif.solicitud_id && (
                    <>
                      <span className="text-slate-400">•</span>
                      <span className="text-xs text-blue-600">
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
                    className="p-2 rounded-lg hover:bg-emerald-50/70 text-slate-400 hover:text-emerald-600 transition-colors"
                    title={t("notif_marcar_leida", "Marcar como leida")}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  className="p-2 rounded-lg hover:bg-red-50/70 text-slate-400 hover:text-red-600 transition-colors"
                  title={t("notif_eliminar", "Eliminar")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Indicador no leido */}
              {!notif.leido && (
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 mt-2" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notif_title", "NOTIFICACIONES").toUpperCase()}
        actions={
          <div className="flex items-center gap-3">
            {/* Push notifications toggle */}
            <PushNotificationToggle />

            <div className="h-4 w-px bg-slate-300" />

            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600">{t("realtime_live", "En vivo")}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">{t("realtime_polling", "Actualizacion periodica")}</span>
                </>
              )}
            </div>

            <div className="h-4 w-px bg-slate-300" />

            <Button
              variant="ghost"
              onClick={refresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              {t("common_refresh", "Actualizar")}
            </Button>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead}>
                <CheckCheck className="w-4 h-4" />
                {t("notif_marcar_todas", "Marcar todas como leidas")}
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      <Card>
        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("unread")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === "unread"
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                {t("notif_tab_unread", "No Leidas")}
                {unreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-blue-500 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </span>
              {activeTab === "unread" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("read")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === "read"
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">
                {t("notif_tab_read", "Leidas")}
                {readCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-medium text-slate-500 bg-slate-100 rounded-full">
                    {readCount}
                  </span>
                )}
              </span>
              {activeTab === "read" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          </div>
        </div>

        <CardContent className="pt-4">
          {isLoading && notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-600" />
              <p>{t("common_cargando", "Cargando...")}</p>
            </div>
          ) : (
            renderNotificationList(filteredNotifications)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
