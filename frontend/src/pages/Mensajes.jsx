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
} from "lucide-react";
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
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--primary-muted)] border border-[var(--primary)] rounded-lg">
            <Circle className="w-2 h-2 fill-[var(--primary)] text-[var(--primary)] animate-pulse-dot" />
            <span className="text-sm font-medium text-[var(--primary)]">
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
        <div className="border-b border-[var(--border)]">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${activeTab === "inbox"
                  ? "bg-[var(--primary-muted)] text-[var(--primary)] border border-[var(--primary)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)]"
                }
              `}
            >
              <Inbox className="w-4 h-4" />
              <span>Recibidos</span>
              {unreadCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("outbox")}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${activeTab === "outbox"
                  ? "bg-[var(--primary-muted)] text-[var(--primary)] border border-[var(--primary)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)]"
                }
              `}
            >
              <Send className="w-4 h-4" />
              <span>Enviados</span>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
              <p className="mt-3 text-sm text-[var(--fg-muted)]">Cargando mensajes...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-4">
                {activeTab === "inbox" ? (
                  <Inbox className="w-8 h-8 text-[var(--fg-muted)]" />
                ) : (
                  <Send className="w-8 h-8 text-[var(--fg-muted)]" />
                )}
              </div>
              <p className="text-[var(--fg-muted)]">
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
        border border-[var(--border)] rounded-lg
        hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]
        transition-all duration-200 cursor-pointer
        ${isUnread ? "bg-[var(--primary-muted)]/20 border-[var(--primary)]/30" : ""}
      `}
      onClick={onOpen}
    >
      {/* Icon */}
      <div className={`
        flex-shrink-0 w-10 h-10 rounded-full
        flex items-center justify-center
        ${isUnread
          ? "bg-[var(--primary)] text-[var(--on-primary)]"
          : "bg-[var(--bg-elevated)] text-[var(--fg-muted)]"
        }
      `}>
        {isUnread ? (
          <Circle className="w-4 h-4 fill-current" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className={`text-sm font-medium truncate ${isUnread ? "text-[var(--fg-strong)]" : "text-[var(--fg)]"}`}>
            {displayName}
          </h3>
          {displayRole && (
            <span className="text-xs text-[var(--fg-subtle)] uppercase tracking-wider font-mono">
              {displayRole}
            </span>
          )}
        </div>

        <p className={`text-sm mb-1 truncate ${isUnread ? "font-medium text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>
          {message.asunto}
        </p>

        <p className="text-xs text-[var(--fg-subtle)] line-clamp-1">
          {message.mensaje}
        </p>

        {message.solicitud_id && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--accent)]">
            <FileText className="w-3 h-3" />
            <span>Solicitud #{message.solicitud_id}</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          <Clock className="w-3 h-3" />
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
            <Reply className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Eliminar"
            className="text-[var(--danger)] hover:bg-[var(--status-danger-bg)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
