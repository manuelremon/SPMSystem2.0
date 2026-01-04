import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Check,
  XCircle,
  MessageSquare,
  User,
  Building,
  MapPin,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Send,
} from "../ui/Icons";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";

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

// Componente para mostrar comparación de valores
function ValueComparison({ label, current, requested, icon: Icon }) {
  if (!requested && requested !== 0) return null;

  const currentDisplay = Array.isArray(current) ? current.join(", ") : current || "—";
  const requestedDisplay = Array.isArray(requested) ? requested.join(", ") : requested || "—";

  const hasChange = currentDisplay !== requestedDisplay;

  if (!hasChange) return null;

  return (
    <div className="p-3 bg-[var(--bg-soft)] rounded-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--fg)] mb-2">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--fg-muted)] line-through">{currentDisplay}</span>
        <ArrowRight className="w-4 h-4 text-[var(--fg-muted)]" />
        <span className="text-green-600 dark:text-green-400 font-medium">{requestedDisplay}</span>
      </div>
    </div>
  );
}

export default function ProfileRequestActionModal({ notif, onClose, onAction }) {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestData, setRequestData] = useState(null);

  const [activeView, setActiveView] = useState("detail"); // detail, approve, reject, message
  const [comentario, setComentario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  // Extraer request_id de múltiples fuentes
  const extractRequestId = () => {
    // 1. Buscar en solicitud_id directo
    if (notif.solicitud_id) return notif.solicitud_id;

    // 2. Buscar en el mensaje con patrón #N
    const msgMatch = notif.mensaje?.match(/#(\d+)/);
    if (msgMatch) return parseInt(msgMatch[1]);

    // 3. Buscar en el asunto
    const asuntoMatch = notif.asunto?.match(/#(\d+)/);
    if (asuntoMatch) return parseInt(asuntoMatch[1]);

    // 4. Buscar patrón "perfil #N" o "perfil N"
    const perfilMatch = (notif.mensaje || notif.asunto || "").match(/perfil\s*#?(\d+)/i);
    if (perfilMatch) return parseInt(perfilMatch[1]);

    return null;
  };

  const [requestId, setRequestId] = useState(extractRequestId());
  const [pendingRequests, setPendingRequests] = useState([]);

  // Si no hay requestId, cargar solicitudes pendientes para seleccionar
  useEffect(() => {
    if (requestId) {
      loadRequestData();
    } else {
      loadPendingRequests();
    }
  }, [requestId]);

  const loadPendingRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mi-cuenta/admin/profile-requests?estado=pendiente");
      if (res.data?.ok && res.data.requests?.length > 0) {
        setPendingRequests(res.data.requests);
        // Si solo hay una, seleccionarla automáticamente
        if (res.data.requests.length === 1) {
          setRequestId(res.data.requests[0].id);
        }
      } else {
        setError("No hay solicitudes de perfil pendientes");
      }
    } catch (err) {
      setError("Error al cargar solicitudes pendientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId && !requestData) {
      loadRequestData();
    }
  }, [requestId]);

  const loadRequestData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/mi-cuenta/admin/profile-requests/${requestId}`);
      if (res.data?.ok) {
        setRequestData(res.data.request);
      } else {
        setError(res.data?.error?.message || "Error al cargar datos");
      }
    } catch (err) {
      console.error("Error loading profile request:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/mi-cuenta/admin/profile-requests/${requestId}/aprobar`, {
        comentario: comentario.trim() || undefined,
      });
      if (res.data?.ok) {
        setSuccess("Solicitud aprobada y cambios aplicados");
        setTimeout(() => {
          onAction?.();
          onClose();
        }, 1500);
      } else {
        setError(res.data?.error?.message || "Error al aprobar");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!motivo.trim()) {
      setError("Debe indicar un motivo de rechazo");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/mi-cuenta/admin/profile-requests/${requestId}/rechazar`, {
        motivo: motivo.trim(),
      });
      if (res.data?.ok) {
        setSuccess("Solicitud rechazada");
        setTimeout(() => {
          onAction?.();
          onClose();
        }, 1500);
      } else {
        setError(res.data?.error?.message || "Error al rechazar");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnviarMensaje = async () => {
    if (!mensaje.trim()) {
      setError("Debe escribir un mensaje");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/mi-cuenta/admin/profile-requests/${requestId}/mensaje`, {
        mensaje: mensaje.trim(),
      });
      if (res.data?.ok) {
        setSuccess("Mensaje enviado al solicitante");
        setMensaje("");
        setTimeout(() => {
          setSuccess(null);
          setActiveView("detail");
        }, 1500);
      } else {
        setError(res.data?.error?.message || "Error al enviar mensaje");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = requestData?.estado === "pendiente";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col bg-[var(--card)] shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--fg)]">
              {t("profile_req_action_title", "Solicitud de Cambio de Perfil")}
              {requestId ? ` #${requestId}` : ""}
            </h2>
            {requestData && (
              <p className="text-sm text-[var(--fg-muted)] mt-1">
                {formatDateTime(requestData.created_at)}
              </p>
            )}
          </div>
          <Button
            onClick={onClose}
            variant="icon"
            size="icon-md"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : !requestId && pendingRequests.length > 0 ? (
            /* Selector de solicitudes pendientes */
            <div className="space-y-4">
              <p className="text-sm text-[var(--fg-muted)]">
                Selecciona la solicitud de cambio de perfil que deseas gestionar:
              </p>
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setRequestId(req.id)}
                    className="w-full text-left p-4 bg-[var(--bg-soft)] hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg border border-[var(--border)] hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--fg)]">
                          {req.solicitante?.nombre || `Usuario ${req.usuario_id}`}
                        </p>
                        <p className="text-sm text-[var(--fg-muted)]">
                          Solicitud #{req.id} • {formatDateTime(req.created_at)}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Pendiente</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : error && !requestData ? (
            <Alert variant="error">{error}</Alert>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-medium text-green-700 dark:text-green-300">{success}</p>
            </div>
          ) : requestData ? (
            <>
              {/* Vista de detalle */}
              {activeView === "detail" && (
                <div className="space-y-6">
                  {/* Solicitante */}
                  <div className="flex items-start gap-4 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800/50 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--fg)]">
                        {requestData.solicitante?.nombre || "Usuario"}
                      </p>
                      <p className="text-sm text-[var(--fg)]">
                        {requestData.solicitante?.mail}
                      </p>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {requestData.solicitante?.posicion} • {requestData.solicitante?.sector}
                      </p>
                    </div>
                    <Badge
                      className={`ml-auto ${
                        requestData.estado === "pendiente"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : requestData.estado === "aprobado"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {requestData.estado}
                    </Badge>
                  </div>

                  {/* Cambios solicitados */}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--fg-muted)] mb-3 uppercase tracking-wider">
                      {t("profile_req_cambios", "Cambios Solicitados")}
                    </h3>
                    <div className="space-y-2">
                      <ValueComparison
                        label="Sector"
                        current={requestData.current_values?.sector}
                        requested={requestData.requested_values?.sector}
                        icon={Building}
                      />
                      <ValueComparison
                        label="Centros"
                        current={requestData.current_values?.centros}
                        requested={requestData.requested_values?.centros}
                        icon={MapPin}
                      />
                      <ValueComparison
                        label="Almacenes"
                        current={requestData.current_values?.almacenes}
                        requested={requestData.requested_values?.almacenes}
                        icon={MapPin}
                      />
                      <ValueComparison
                        label="Jefe"
                        current={requestData.current_values?.jefe}
                        requested={requestData.requested_values?.jefe}
                        icon={User}
                      />
                    </div>
                  </div>

                  {/* Error inline */}
                  {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

                  {/* Advertencia si ya fue procesada */}
                  {!isPending && (
                    <div className="p-4 bg-[var(--bg-soft)] rounded-lg border border-[var(--border)]">
                      <p className="text-sm text-[var(--fg-muted)]">
                        Esta solicitud ya fue <strong>{requestData.estado}</strong> y no puede modificarse.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Vista de aprobar */}
              {activeView === "approve" && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Los cambios se aplicarán automáticamente al perfil del usuario.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                      {t("profile_req_comentario", "Comentario (opcional)")}
                    </label>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Agregar un comentario..."
                      className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                </div>
              )}

              {/* Vista de rechazar */}
              {activeView === "reject" && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-700">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      El solicitante será notificado del rechazo con el motivo indicado.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                      {t("profile_req_motivo", "Motivo del rechazo")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Indicar el motivo del rechazo..."
                      className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                      rows={3}
                      required
                    />
                  </div>
                  {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                </div>
              )}

              {/* Vista de mensaje */}
              {activeView === "message" && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      El mensaje será enviado a la bandeja de entrada del solicitante.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                      {t("profile_req_mensaje_label", "Mensaje")}
                    </label>
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder="Escribir mensaje..."
                      className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={4}
                    />
                  </div>
                  {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer con acciones */}
        {requestData && !success && (
          <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-soft)]/50">
            {activeView === "detail" && isPending && (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setActiveView("approve")}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t("profile_req_aprobar", "Aprobar")}
                </Button>
                <Button
                  onClick={() => setActiveView("reject")}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("profile_req_rechazar", "Rechazar")}
                </Button>
                <Button
                  onClick={() => setActiveView("message")}
                  variant="outline"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t("profile_req_mensaje", "Enviar mensaje")}
                </Button>
              </div>
            )}

            {activeView === "detail" && !isPending && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveView("message")}
                  variant="outline"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t("profile_req_mensaje", "Enviar mensaje")}
                </Button>
                <Button
                  onClick={() => navigate("/admin/solicitudes-perfil")}
                  variant="outline"
                >
                  {t("profile_req_ver_todas", "Ver todas las solicitudes")}
                </Button>
              </div>
            )}

            {activeView === "approve" && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveView("detail")}
                  variant="outline"
                  disabled={submitting}
                >
                  {t("common_cancel", "Cancelar")}
                </Button>
                <Button
                  onClick={handleAprobar}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {t("profile_req_confirmar_aprobar", "Confirmar Aprobación")}
                </Button>
              </div>
            )}

            {activeView === "reject" && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveView("detail")}
                  variant="outline"
                  disabled={submitting}
                >
                  {t("common_cancel", "Cancelar")}
                </Button>
                <Button
                  onClick={handleRechazar}
                  disabled={submitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {t("profile_req_confirmar_rechazar", "Confirmar Rechazo")}
                </Button>
              </div>
            )}

            {activeView === "message" && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveView("detail")}
                  variant="outline"
                  disabled={submitting}
                >
                  {t("common_cancel", "Cancelar")}
                </Button>
                <Button
                  onClick={handleEnviarMensaje}
                  disabled={submitting || !mensaje.trim()}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {t("profile_req_enviar", "Enviar")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
