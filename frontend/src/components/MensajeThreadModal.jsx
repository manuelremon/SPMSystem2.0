import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  User,
  Clock,
  FileText,
  Loader2,
  MessageSquare
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Alert } from "./ui/Alert";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

export default function MensajeThreadModal({ message, isOpen, onClose }) {
  const { user } = useAuthStore();
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && message) {
      fetchThread();
    }
  }, [isOpen, message]);

  useEffect(() => {
    // Scroll to bottom when thread updates
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const fetchThread = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/mensajes/${message.id}/thread`);
      const data = response.data;

      if (data.ok) {
        setThread(data.thread || []);
      } else {
        setError(data.error || "Error al cargar conversación");
      }
    } catch (err) {
      setError("Error de conexión al cargar conversación");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await api.post(`/mensajes/${message.id}/reply`, {
        mensaje: replyText
      });
      const data = response.data;

      if (data.ok) {
        // Refresh thread
        await fetchThread();
        setReplyText("");
      } else {
        setError(data.error || "Error al enviar respuesta");
      }
    } catch (err) {
      setError("Error de conexión al enviar respuesta");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSendReply();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-strong flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[var(--fg-strong)] mb-1">
              {message.asunto}
            </h2>
            {message.solicitud_id && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--accent)]">
                <FileText className="w-4 h-4" />
                <span>Solicitud #{message.solicitud_id}</span>
                {message.solicitud_justificacion && (
                  <span className="text-[var(--fg-subtle)]">
                    - {message.solicitud_justificacion}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 ml-4 p-2 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[var(--bg-elevated)] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 pt-4">
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {/* Messages Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
            </div>
          ) : thread.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-[var(--fg-muted)] mb-3" />
              <p className="text-[var(--fg-muted)]">No se encontraron mensajes</p>
            </div>
          ) : (
            <>
              {thread.map((msg, index) => {
                const isMe = msg.remitente_id === user?.id_spm;
                const senderName = isMe
                  ? "Tú"
                  : `${msg.remitente_nombre || ""} ${msg.remitente_apellido || ""}`.trim() || "Usuario";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} space-y-1`}>
                      {/* Sender info */}
                      <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                          ${isMe
                            ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-strong)] text-[var(--on-primary)]"
                            : "bg-[var(--bg-elevated)] text-[var(--fg-muted)]"
                          }
                        `}>
                          {senderName[0]?.toUpperCase()}
                        </div>
                        <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                          <span className="text-sm font-medium text-[var(--fg)]">
                            {senderName}
                          </span>
                          {msg.remitente_rol && !isMe && (
                            <span className="text-xs text-[var(--fg-subtle)] uppercase tracking-wider font-mono">
                              {msg.remitente_rol}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Message bubble */}
                      <div
                        className={`
                          px-4 py-3 rounded-lg
                          ${isMe
                            ? "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] text-[var(--on-primary)] rounded-tr-none"
                            : "bg-[var(--bg-elevated)] text-[var(--fg)] border border-[var(--border)] rounded-tl-none"
                          }
                        `}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.mensaje}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <div className={`flex items-center gap-1 text-xs text-[var(--fg-subtle)] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(msg.created_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Reply Input */}
        <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-soft)]">
          <div className="flex gap-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta... (Ctrl+Enter para enviar)"
              className="
                flex-1 px-4 py-3 rounded-lg
                bg-[var(--input-bg)] border border-[var(--input-border)]
                text-sm text-[var(--fg)]
                placeholder:text-[var(--fg-subtle)]
                focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--input-focus)]
                focus:outline-none
                transition-all duration-200
                resize-none
                min-h-[80px]
              "
              disabled={sending}
            />

            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              className="self-end"
              title="Enviar respuesta (Ctrl+Enter)"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline ml-2">Enviar</span>
            </Button>
          </div>

          <p className="mt-2 text-xs text-[var(--fg-subtle)]">
            Presiona <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded font-mono">Enter</kbd> para enviar
          </p>
        </div>
      </div>
    </div>
  );
}
