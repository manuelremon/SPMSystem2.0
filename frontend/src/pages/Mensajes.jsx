import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  Inbox,
  MessageSquare,
  Clock,
  User,
  FileText,
  Reply,
  Trash2,
  CheckCircle2,
  Circle
} from "../components/ui/Icons";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import MensajeThreadModal from "../components/MensajeThreadModal";

export default function Mensajes() {
  const { user } = useAuthStore();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState("inbox"); // inbox | outbox
  const [inboxMessages, setInboxMessages] = useState([]);
  const [outboxMessages, setOutboxMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
  }, [activeTab]);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = activeTab === "inbox" ? "/mensajes/inbox" : "/mensajes/outbox";
      const response = await api.get(endpoint);
      const data = response.data;

      if (data.ok) {
        if (activeTab === "inbox") {
          setInboxMessages(data.messages || []);
        } else {
          setOutboxMessages(data.messages || []);
        }
      } else {
        setError(data.error || "Error al cargar mensajes");
      }
    } catch (err) {
      setError("Error de conexión al cargar mensajes");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/mensajes/unread-count");
      const data = response.data;
      if (data.ok) {
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  };

  const handleOpenThread = async (message) => {
    setSelectedMessage(message);
    setShowThreadModal(true);

    // Marcar como leído si es un mensaje recibido no leído
    if (activeTab === "inbox" && message.leido === 0) {
      try {
        await api.post(`/mensajes/${message.id}/mark-read`);
        // Actualizar mensaje local
        setInboxMessages(prev =>
          prev.map(m => m.id === message.id ? { ...m, leido: 1 } : m)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este mensaje?")) {
      return;
    }

    try {
      const response = await api.delete(`/mensajes/${messageId}`);
      const data = response.data;

      if (data.ok) {
        // Actualizar lista local
        if (activeTab === "inbox") {
          setInboxMessages(prev => prev.filter(m => m.id !== messageId));
        } else {
          setOutboxMessages(prev => prev.filter(m => m.id !== messageId));
        }

        // Refrescar contador
        fetchUnreadCount();
      } else {
        alert(data.error || "Error al eliminar mensaje");
      }
    } catch (err) {
      alert("Error de conexión al eliminar mensaje");
      console.error(err);
    }
  };

  const messages = activeTab === "inbox" ? inboxMessages : outboxMessages;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("mensajes_title", "Mensajes")}
        description={t("mensajes_desc", "Gestiona tus mensajes de entrada y salida")}
        icon={Mail}
      >
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100/70 border border-blue-500 rounded-lg">
            <Circle className="w-2 h-2 fill-blue-500 text-blue-500 animate-pulse-dot" />
            <span className="text-sm font-medium text-blue-600">
              {unreadCount} {unreadCount === 1 ? "mensaje nuevo" : "mensajes nuevos"}
            </span>
          </div>
        )}
      </PageHeader>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        {/* Tabs */}
        <div className="p-4 border-b border-white/30">
          <div className="flex items-center gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30 w-fit">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "inbox"
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Inbox className="w-4 h-4 text-blue-500" />
              <span>Recibidos</span>
              {unreadCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-semibold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("outbox")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "outbox"
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Send className="w-4 h-4 text-blue-600" />
              <span>Enviados</span>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-3 text-sm text-slate-500">Cargando mensajes...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100/70 flex items-center justify-center mb-4">
                {activeTab === "inbox" ? (
                  <Inbox className="w-8 h-8 text-blue-500" />
                ) : (
                  <Send className="w-8 h-8 text-blue-600" />
                )}
              </div>
              <p className="text-slate-500">
                {activeTab === "inbox"
                  ? "No tienes mensajes recibidos"
                  : "No has enviado mensajes"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  isInbox={activeTab === "inbox"}
                  onOpen={() => handleOpenThread(message)}
                  onDelete={() => handleDeleteMessage(message.id)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Thread Modal */}
      {showThreadModal && selectedMessage && (
        <MensajeThreadModal
          message={selectedMessage}
          isOpen={showThreadModal}
          onClose={() => {
            setShowThreadModal(false);
            setSelectedMessage(null);
            fetchMessages(); // Refresh messages after closing
            fetchUnreadCount(); // Refresh unread count
          }}
        />
      )}
    </div>
  );
}

function MessageRow({ message, isInbox, onOpen, onDelete }) {
  const isUnread = isInbox && message.leido === 0;

  const displayName = isInbox
    ? `${message.remitente_nombre || ""} ${message.remitente_apellido || ""}`.trim() || "Usuario"
    : `${message.destinatario_nombre || ""} ${message.destinatario_apellido || ""}`.trim() || "Usuario";

  const displayRole = isInbox ? message.remitente_rol : message.destinatario_rol;

  return (
    <div
      className={`
        group relative
        flex items-center gap-4 p-4
        border border-white/30 rounded-lg
        hover:border-slate-300 hover:bg-slate-100/70
        transition-all duration-200 cursor-pointer
        ${isUnread ? "bg-blue-100/70/20 border-blue-500/30" : ""}
      `}
      onClick={onOpen}
    >
      {/* Icon */}
      <div className={`
        flex-shrink-0 w-10 h-10 rounded-full
        flex items-center justify-center
        ${isUnread
          ? "bg-blue-600 text-white"
          : "bg-slate-100/70 text-slate-500"
        }
      `}>
        {isUnread ? (
          <Circle className="w-4 h-4 fill-current" />
        ) : (
          <MessageSquare className="w-5 h-5 text-violet-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className={`text-sm font-medium truncate ${isUnread ? "text-slate-900" : "text-slate-800"}`}>
            {displayName}
          </h3>
          {displayRole && (
            <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
              {displayRole}
            </span>
          )}
        </div>

        <p className={`text-sm mb-1 truncate ${isUnread ? "font-medium text-slate-800" : "text-slate-500"}`}>
          {message.asunto}
        </p>

        <p className="text-xs text-slate-400 line-clamp-1">
          {message.mensaje}
        </p>

        {message.solicitud_id && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan-600">
            <FileText className="w-3 h-3 text-blue-500" />
            <span>Solicitud #{message.solicitud_id}</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3 text-cyan-500" />
          <span>
            {new Date(message.created_at).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            title="Ver conversación"
          >
            <Reply className="w-4 h-4 text-blue-600" />
          </Button>

          <Button
            variant="icon-danger"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
