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
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500 line-through">{currentDisplay}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className="text-green-600 font-medium">{requestedDisplay}</span>
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

  // Extraer request_id del mensaje de notificación
  const extractRequestId = () => {
    const match = notif.mensaje?.match(/#(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const requestId = extractRequestId();

  useEffect(() => {
    if (requestId) {
      loadRequestData();
    } else {
      setError("No se pudo identificar la solicitud");
      setLoading(false);
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
        className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/50 overflow-hidden flex flex-col"
        style={{
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("profile_req_action_title", "Solicitud de Cambio de Perfil")} #{requestId}
            </h2>
            {requestData && (
              <p className="text-sm text-gray-500 mt-1">
                {formatDateTime(requestData.created_at)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error && !requestData ? (
            <Alert variant="error">{error}</Alert>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-medium text-green-700">{success}</p>
            </div>
          ) : requestData ? (
            <>
              {/* Vista de detalle */}
              {activeView === "detail" && (
                <div className="space-y-6">
                  {/* Solicitante */}
                  <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {requestData.solicitante?.nombre || "Usuario"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {requestData.solicitante?.mail}
                      </p>
                      <p className="text-sm text-gray-500">
                        {requestData.solicitante?.posicion} • {requestData.solicitante?.sector}
                      </p>
                    </div>
                    <Badge
                      className={`ml-auto ${
                        requestData.estado === "pendiente"
                          ? "bg-amber-100 text-amber-700"
                          : requestData.estado === "aprobado"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {requestData.estado}
                    </Badge>
                  </div>

                  {/* Cambios solicitados */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
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
                    <div className="p-4 bg-gray-100 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Esta solicitud ya fue <strong>{requestData.estado}</strong> y no puede modificarse.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Vista de aprobar */}
              {activeView === "approve" && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      Los cambios se aplicarán automáticamente al perfil del usuario.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("profile_req_comentario", "Comentario (opcional)")}
                    </label>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Agregar un comentario..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                  {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
                </div>
              )}

              {/* Vista de rechazar */}
              {activeView === "reject" && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      El solicitante será notificado del rechazo con el motivo indicado.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("profile_req_motivo", "Motivo del rechazo")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Indicar el motivo del rechazo..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
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
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      El mensaje será enviado a la bandeja de entrada del solicitante.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("profile_req_mensaje_label", "Mensaje")}
                    </label>
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder="Escribir mensaje..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
          <div className="p-6 border-t border-gray-100 bg-gray-50/50">
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
