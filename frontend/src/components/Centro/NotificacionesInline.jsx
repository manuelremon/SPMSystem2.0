import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Clock,
  FileText,
  AlertTriangle,
  Package,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  User,
} from "../ui/Icons";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card, CardContent } from "../ui/Card";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";
import ProfileRequestActionModal from "./ProfileRequestActionModal";

const tipoIcons = {
  solicitud_approved: Check,
  solicitud_rejected: X,
  solicitud_to_plan: Clock,
  stock_consulta: Package,
  mensaje_nuevo: MessageSquare,
  budget_approved: Check,
  budget_rejected: X,
  profile_request: User,
  profile_approved: Check,
  profile_rejected: X,
  default: Bell,
};

const tipoColors = {
  solicitud_approved: "text-green-600 bg-green-50",
  solicitud_rejected: "text-red-600 bg-red-50",
  solicitud_to_plan: "text-blue-600 bg-blue-50",
  stock_consulta: "text-orange-600 bg-orange-50",
  mensaje_nuevo: "text-purple-600 bg-purple-50",
  budget_approved: "text-green-600 bg-green-50",
  budget_rejected: "text-red-600 bg-red-50",
  profile_request: "text-indigo-600 bg-indigo-50",
  profile_approved: "text-green-600 bg-green-50",
  profile_rejected: "text-red-600 bg-red-50",
  default: "text-gray-600 bg-gray-50",
};

// Tipos que requieren respuesta del usuario
const TIPOS_REQUIEREN_RESPUESTA = ["stock_consulta", "mensaje_nuevo", "profile_request"];

// Tipos que abren modal de acción de perfil
const TIPOS_PROFILE_ACTION = ["profile_request"];

// Detectar si una notificación es de cambio de perfil por contenido
function isProfileRequestNotif(notif) {
  if (TIPOS_PROFILE_ACTION.includes(notif.tipo)) return true;
  // También detectar por contenido del mensaje
  const msg = (notif.mensaje || "").toLowerCase();
  return msg.includes("cambio de perfil") || msg.includes("solicitud de perfil");
}

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

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Modal de detalle de notificacion
function NotificacionDetailModal({ notif, onClose, onMarcarLeida }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [marcando, setMarcando] = useState(false);

  const IconComponent = tipoIcons[notif.tipo] || tipoIcons.default;
  const colorClass = tipoColors[notif.tipo] || tipoColors.default;
  const requiereRespuesta = TIPOS_REQUIEREN_RESPUESTA.includes(notif.tipo);

  // Auto-marcar como leida despues de 2 minutos
  useEffect(() => {
    if (!notif.leido) {
      const timer = setTimeout(() => {
        handleMarcarLeida();
      }, 120000); // 2 minutos
      return () => clearTimeout(timer);
    }
  }, [notif.id, notif.leido]);

  const handleMarcarLeida = async () => {
    if (notif.leido || marcando) return;
    setMarcando(true);
    try {
      await api.post(`/notificaciones/${notif.id}/marcar-leida`);
      onMarcarLeida(notif.id);
    } catch (err) {
      console.error("Error marcando como leida:", err);
    } finally {
      setMarcando(false);
    }
  };

  const handleVerSolicitud = () => {
    onClose();
    navigate(`/solicitud/${notif.solicitud_id}`);
  };

  const handleResponder = () => {
    onClose();
    if (notif.tipo === "stock_consulta") {
      navigate("/centro-interaccion");
    } else if (notif.tipo === "mensaje_nuevo") {
      navigate("/mensajes");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/50 overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colorClass}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {t("centro_notificacion", "Notificacion")}
                </span>
                {!notif.leido && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatDateTime(notif.created_at)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Advertencia si requiere respuesta */}
        {requiereRespuesta && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {t("centro_requiere_respuesta", "Esta notificacion requiere tu respuesta")}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {notif.tipo === "stock_consulta"
                  ? t("centro_responder_consulta", "Hay una consulta de stock pendiente")
                  : t("centro_responder_mensaje", "Tienes un mensaje sin responder")}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed">{notif.mensaje}</p>

          {notif.solicitud_id && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">
                {t("centro_solicitud_relacionada", "Solicitud relacionada")}:{" "}
                <span className="font-bold">#{notif.solicitud_id}</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
          <div className="flex gap-2">
            {!notif.leido && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarcarLeida}
                disabled={marcando}
              >
                <Check className="w-4 h-4 mr-2" />
                {marcando
                  ? t("common_loading", "...")
                  : t("centro_marcar_leida", "Marcar como leida")}
              </Button>
            )}
            {requiereRespuesta && (
              <Button size="sm" onClick={handleResponder}>
                <MessageSquare className="w-4 h-4 mr-2" />
                {t("centro_responder", "Responder")}
              </Button>
            )}
          </div>

          {notif.solicitud_id && (
            <Button variant="outline" size="sm" onClick={handleVerSolicitud}>
              <FileText className="w-4 h-4 mr-2" />
              {t("centro_ver_solicitud", "Ver Solicitud")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente principal
export default function NotificacionesInline({ onUpdate }) {
  const { t } = useI18n();
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const loadNotificaciones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notificaciones?limit=20");
      if (res.data?.ok) {
        setNotificaciones(res.data.notifications || []);
      } else {
        setError("Error al cargar notificaciones");
      }
    } catch (err) {
      console.error("Error loading notificaciones:", err);
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificaciones();
  }, [loadNotificaciones]);

  const handleMarcarLeida = (notifId) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, leido: true } : n))
    );
    if (onUpdate) onUpdate();
  };

  const handleMarcarTodasLeidas = async () => {
    setMarcandoTodas(true);
    try {
      await api.post("/notificaciones/marcar-todas-leidas");
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Error marcando todas como leidas:", err);
    } finally {
      setMarcandoTodas(false);
    }
  };

  const unreadCount = notificaciones.filter((n) => !n.leido).length;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {t("centro_notificaciones_recientes", "Notificaciones Recientes")}
            </h3>
            {unreadCount > 0 && (
              <Badge variant="danger">{unreadCount} sin leer</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarcarTodasLeidas}
                disabled={marcandoTodas}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                {marcandoTodas
                  ? t("common_loading", "...")
                  : t("centro_marcar_todas", "Marcar todas")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadNotificaciones}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{t("centro_sin_notificaciones", "No tienes notificaciones")}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {notificaciones.map((notif) => {
              const IconComponent = tipoIcons[notif.tipo] || tipoIcons.default;
              const colorClass = tipoColors[notif.tipo] || tipoColors.default;
              const requiereRespuesta = TIPOS_REQUIEREN_RESPUESTA.includes(notif.tipo);

              return (
                <div
                  key={notif.id}
                  onClick={() => setSelectedNotif(notif)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all
                    border border-transparent hover:border-gray-200 hover:shadow-sm
                    ${notif.leido ? "bg-white" : "bg-blue-50/50"}`}
                >
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm line-clamp-2 ${
                          notif.leido ? "text-gray-600" : "text-gray-900 font-medium"
                        }`}
                      >
                        {notif.mensaje}
                      </p>
                      {!notif.leido && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                      {notif.solicitud_id && (
                        <span className="text-xs text-blue-600">
                          #{notif.solicitud_id}
                        </span>
                      )}
                      {requiereRespuesta && (
                        <Badge variant="warning" className="text-xs py-0">
                          {t("centro_requiere_accion", "Requiere accion")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de detalle - diferente según tipo */}
        {selectedNotif && isProfileRequestNotif(selectedNotif) ? (
          <ProfileRequestActionModal
            notif={selectedNotif}
            onClose={() => setSelectedNotif(null)}
            onAction={() => {
              handleMarcarLeida(selectedNotif.id);
              loadNotificaciones();
            }}
          />
        ) : selectedNotif ? (
          <NotificacionDetailModal
            notif={selectedNotif}
            onClose={() => setSelectedNotif(null)}
            onMarcarLeida={handleMarcarLeida}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
