import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  RefreshCw,
  User,
  FileText,
} from "../ui/Icons";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card, CardContent } from "../ui/Card";
import { useI18n } from "../../context/i18n";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import MensajeThreadModal from "../MensajeThreadModal";
import ProfileRequestActionModal from "./ProfileRequestActionModal";

// Detectar si un mensaje es sobre solicitud de cambio de perfil
function isProfileRequestMessage(mensaje) {
  const asunto = (mensaje.asunto || "").toLowerCase();
  const contenido = (mensaje.mensaje || mensaje.contenido || "").toLowerCase();
  return (
    asunto.includes("cambio de perfil") ||
    asunto.includes("solicitud de perfil") ||
    contenido.includes("solicitud de cambio de perfil")
  );
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

function truncateText(text, maxLength = 80) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

function getInitials(nombre, apellido) {
  const n = nombre?.[0] || "";
  const a = apellido?.[0] || "";
  return (n + a).toUpperCase() || "?";
}

export default function MensajesInline({ onUpdate }) {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMensaje, setSelectedMensaje] = useState(null);

  const loadMensajes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/mensajes/inbox?limit=20");
      if (res.data?.ok) {
        setMensajes(res.data.messages || []);
      } else {
        setError("Error al cargar mensajes");
      }
    } catch (err) {
      console.error("Error loading mensajes:", err);
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMensajes();
  }, [loadMensajes]);

  const handleMensajeClick = async (mensaje) => {
    // Marcar como leido al abrir
    if (!mensaje.leido) {
      try {
        await api.post(`/mensajes/${mensaje.id}/mark-read`);
        setMensajes((prev) =>
          prev.map((m) => (m.id === mensaje.id ? { ...m, leido: true } : m))
        );
        if (onUpdate) onUpdate();
      } catch (err) {
        console.error("Error marcando mensaje como leido:", err);
      }
    }
    setSelectedMensaje(mensaje);
  };

  const handleModalClose = () => {
    setSelectedMensaje(null);
    // Refrescar lista por si se envio respuesta
    loadMensajes();
    if (onUpdate) onUpdate();
  };

  const unreadCount = mensajes.filter((m) => !m.leido).length;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {t("centro_mensajes_recientes", "Mensajes Recientes")}
            </h3>
            {unreadCount > 0 && (
              <Badge variant="danger">{unreadCount} sin leer</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMensajes}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-500/20">
            {error}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--fg-muted)]" />
          </div>
        ) : mensajes.length === 0 ? (
          <div className="text-center py-8 text-[var(--fg-muted)]">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("centro_sin_mensajes", "No tienes mensajes")}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {mensajes.map((mensaje) => {
              const initials = getInitials(
                mensaje.remitente_nombre,
                mensaje.remitente_apellido
              );
              const nombreCompleto = `${mensaje.remitente_nombre || ""} ${
                mensaje.remitente_apellido || ""
              }`.trim();

              return (
                <div
                  key={mensaje.id}
                  onClick={() => handleMensajeClick(mensaje)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all
                    border border-transparent hover:border-[var(--border)] hover:shadow-sm
                    ${mensaje.leido ? "bg-[var(--card)]" : "bg-purple-100/50 dark:bg-purple-900/20"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${
                        mensaje.leido
                          ? "bg-[var(--bg-soft)] text-[var(--fg-muted)]"
                          : "bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                      }`}
                  >
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`text-sm ${
                            mensaje.leido
                              ? "text-[var(--fg)]"
                              : "text-[var(--fg)] font-semibold"
                          }`}
                        >
                          {nombreCompleto || "Usuario"}
                        </p>
                        {mensaje.remitente_rol && (
                          <span className="text-xs text-[var(--fg-muted)] uppercase tracking-wider">
                            {mensaje.remitente_rol}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-[var(--fg-muted)]">
                          {formatTimeAgo(mensaje.created_at)}
                        </span>
                        {!mensaje.leido && (
                          <span className="w-2 h-2 bg-purple-500 rounded-full" />
                        )}
                      </div>
                    </div>

                    {/* Asunto */}
                    <p
                      className={`text-sm mt-1 ${
                        mensaje.leido ? "text-[var(--fg-muted)]" : "text-[var(--fg)] font-medium"
                      }`}
                    >
                      {mensaje.asunto}
                    </p>

                    {/* Preview del mensaje */}
                    <p className="text-xs text-[var(--fg-muted)] mt-1 line-clamp-1">
                      {truncateText(mensaje.mensaje || mensaje.contenido, 80)}
                    </p>

                    {/* Indicadores */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {mensaje.solicitud_id && (
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[var(--primary)]" />
                          <span className="text-xs text-[var(--primary)]">
                            Solicitud #{mensaje.solicitud_id}
                          </span>
                        </div>
                      )}
                      {isProfileRequestMessage(mensaje) && (
                        <Badge variant="warning" className="text-xs py-0">
                          Requiere acción
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal - diferente según tipo de mensaje */}
        {selectedMensaje && isProfileRequestMessage(selectedMensaje) ? (
          <ProfileRequestActionModal
            notif={{ mensaje: selectedMensaje.asunto, ...selectedMensaje }}
            onClose={handleModalClose}
            onAction={() => {
              loadMensajes();
              if (onUpdate) onUpdate();
            }}
          />
        ) : selectedMensaje ? (
          <MensajeThreadModal
            message={selectedMensaje}
            isOpen={!!selectedMensaje}
            onClose={handleModalClose}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
