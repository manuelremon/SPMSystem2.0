import React, { useEffect, useState, useCallback } from "react";
import {
  User,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Send
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { Modal } from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import { useI18n } from "../context/i18n";
import api from "../services/api";

const estadoToBadge = {
  pendiente: "Pendiente",
  aprobado: "Aprobada",
  rechazado: "Rechazada"
};

const fieldLabels = {
  sector_nuevo: "Sector",
  centros_nuevos: "Centros",
  almacenes_nuevos: "Almacenes",
  jefe_nuevo: "Jefe",
  gerente1_nuevo: "Gerente 1",
  gerente2_nuevo: "Gerente 2"
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
}

export default function AdminSolicitudesPerfil() {
  const { t } = useI18n();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("pendiente");

  // Modals
  const [detailModal, setDetailModal] = useState({ open: false, request: null, detail: null });
  const [approveModal, setApproveModal] = useState({ open: false, id: null, comentario: "" });
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, motivo: "" });
  const [messageModal, setMessageModal] = useState({ open: false, id: null, mensaje: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = tab !== "todas" ? { estado: tab } : {};
      const res = await api.get("/mi-cuenta/admin/profile-requests", { params });
      setRequests(res.data.requests || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (req) => {
    setDetailModal({ open: true, request: req, detail: null });
    try {
      const res = await api.get(`/mi-cuenta/admin/profile-requests/${req.id}`);
      setDetailModal(prev => ({ ...prev, detail: res.data.request }));
    } catch (err) {
      console.error("Error loading detail:", err);
    }
  }, []);

  const handleAprobar = useCallback(async () => {
    if (!approveModal.id) return;
    setError("");
    try {
      await api.post(`/mi-cuenta/admin/profile-requests/${approveModal.id}/aprobar`, {
        comentario: approveModal.comentario
      });
      setMsg(t("profile_req_aprobada", "Solicitud aprobada y cambios aplicados"));
      setApproveModal({ open: false, id: null, comentario: "" });
      setDetailModal({ open: false, request: null, detail: null });
      load();
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [approveModal, load, t]);

  const handleRechazar = useCallback(async () => {
    if (!rejectModal.id || !rejectModal.motivo.trim()) {
      setError(t("profile_req_motivo_required", "Debe indicar un motivo"));
      return;
    }
    setError("");
    try {
      await api.post(`/mi-cuenta/admin/profile-requests/${rejectModal.id}/rechazar`, {
        motivo: rejectModal.motivo
      });
      setMsg(t("profile_req_rechazada", "Solicitud rechazada"));
      setRejectModal({ open: false, id: null, motivo: "" });
      setDetailModal({ open: false, request: null, detail: null });
      load();
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [rejectModal, load, t]);

  const handleEnviarMensaje = useCallback(async () => {
    if (!messageModal.id || !messageModal.mensaje.trim()) {
      setError(t("profile_req_mensaje_required", "Debe escribir un mensaje"));
      return;
    }
    setError("");
    try {
      await api.post(`/mi-cuenta/admin/profile-requests/${messageModal.id}/mensaje`, {
        mensaje: messageModal.mensaje
      });
      setMsg(t("profile_req_mensaje_enviado", "Mensaje enviado al solicitante"));
      setMessageModal({ open: false, id: null, mensaje: "" });
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [messageModal, t]);

  const tabs = [
    { key: "pendiente", label: t("profile_req_tab_pendientes", "Pendientes") },
    { key: "aprobado", label: t("profile_req_tab_aprobadas", "Aprobadas") },
    { key: "rechazado", label: t("profile_req_tab_rechazadas", "Rechazadas") },
    { key: "todas", label: t("profile_req_tab_todas", "Todas") }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("profile_req_title", "SOLICITUDES DE CAMBIO DE PERFIL").toUpperCase()}
        actions={
          <Button variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("common_refresh", "Actualizar")}
          </Button>
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--primary)]" />
            {t("profile_req_subtitle", "Gestionar solicitudes de actualizacion de perfil")}
          </CardTitle>
          <CardDescription>
            {t("profile_req_desc", "Aprueba, rechaza o solicita mas informacion sobre los cambios de perfil")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[var(--surface)] rounded-lg w-fit">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  tab === tabItem.key
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--card)]"
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-center py-12 text-[var(--fg-muted)]">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>{t("common_cargando", "Cargando...")}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-[var(--fg-muted)]">
              <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">{t("profile_req_empty", "No hay solicitudes")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--surface)] cursor-pointer transition-colors"
                  onClick={() => openDetail(req)}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[var(--primary)]" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--fg)]">
                        {req.solicitante?.nombre || req.usuario_id}
                      </span>
                      <StatusBadge estado={estadoToBadge[req.estado] || req.estado} />
                    </div>
                    <div className="text-sm text-[var(--fg-muted)] mt-1">
                      Solicita cambiar: {Object.keys(req.cambios_solicitados || {}).map(k => fieldLabels[k] || k).join(", ")}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)] mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(req.created_at)}
                    </div>
                  </div>

                  {/* Acciones rapidas */}
                  <div className="flex-shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {req.estado === "pendiente" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setApproveModal({ open: true, id: req.id, comentario: "" })}
                          title={t("profile_req_aprobar", "Aprobar")}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejectModal({ open: true, id: req.id, motivo: "" })}
                          title={t("profile_req_rechazar", "Rechazar")}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMessageModal({ open: true, id: req.id, mensaje: "" })}
                          title={t("profile_req_mensaje", "Enviar mensaje")}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <ChevronRight className="w-5 h-5 text-[var(--fg-subtle)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalle */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, request: null, detail: null })}
        title={`Solicitud #${detailModal.request?.id}`}
        size="lg"
        footer={
          detailModal.request?.estado === "pendiente" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setMessageModal({ open: true, id: detailModal.request?.id, mensaje: "" })}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {t("profile_req_mensaje", "Mensaje")}
              </Button>
              <Button
                variant="danger"
                onClick={() => setRejectModal({ open: true, id: detailModal.request?.id, motivo: "" })}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {t("profile_req_rechazar", "Rechazar")}
              </Button>
              <Button
                onClick={() => setApproveModal({ open: true, id: detailModal.request?.id, comentario: "" })}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t("profile_req_aprobar", "Aprobar")}
              </Button>
            </>
          )
        }
      >
        {detailModal.detail ? (
          <div className="space-y-6">
            {/* Solicitante */}
            <div className="p-4 rounded-lg bg-[var(--surface)]">
              <h4 className="text-sm font-semibold text-[var(--fg-muted)] mb-2">Solicitante</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--fg)]">{detailModal.detail.solicitante?.nombre}</div>
                  <div className="text-sm text-[var(--fg-muted)]">{detailModal.detail.solicitante?.mail}</div>
                  <div className="text-xs text-[var(--fg-subtle)]">
                    {detailModal.detail.solicitante?.posicion} - {detailModal.detail.solicitante?.sector}
                  </div>
                </div>
              </div>
            </div>

            {/* Cambios solicitados */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--fg-muted)] mb-3">Cambios Solicitados</h4>
              <div className="space-y-3">
                {Object.entries(detailModal.detail.requested_values || {}).map(([field, newValue]) => {
                  const currentValue = detailModal.detail.current_values?.[field];
                  return (
                    <div key={field} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                      <div className="text-xs font-semibold text-[var(--fg-muted)] uppercase mb-2">
                        {fieldLabels[`${field}_nuevo`] || field}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 p-2 rounded bg-[var(--surface)] text-sm">
                          <span className="text-[var(--fg-subtle)]">Actual: </span>
                          <span className="text-[var(--fg)]">
                            {Array.isArray(currentValue) ? currentValue.join(", ") : currentValue || "-"}
                          </span>
                        </div>
                        <ArrowRight className="w-5 h-5 text-[var(--primary)]" />
                        <div className="flex-1 p-2 rounded bg-[var(--primary)]/10 text-sm">
                          <span className="text-[var(--fg-subtle)]">Nuevo: </span>
                          <span className="font-semibold text-[var(--primary)]">
                            {Array.isArray(newValue) ? newValue.join(", ") : newValue || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fecha */}
            <div className="text-xs text-[var(--fg-subtle)] flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Solicitado el {formatDate(detailModal.detail.created_at)}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[var(--fg-muted)]" />
          </div>
        )}
      </Modal>

      {/* Modal Aprobar */}
      <Modal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, id: null, comentario: "" })}
        title={t("profile_req_aprobar_title", "Aprobar Solicitud")}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveModal({ open: false, id: null, comentario: "" })}>
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button onClick={handleAprobar}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {t("profile_req_aprobar", "Aprobar")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            {t("profile_req_aprobar_desc", "Los cambios se aplicaran automaticamente al perfil del usuario.")}
          </p>
          <div>
            <label className="text-sm font-medium text-[var(--fg)]">
              {t("profile_req_comentario", "Comentario (opcional)")}
            </label>
            <textarea
              value={approveModal.comentario}
              onChange={(e) => setApproveModal(prev => ({ ...prev, comentario: e.target.value }))}
              rows={3}
              className="w-full mt-2 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
              placeholder="Mensaje opcional para el solicitante..."
            />
          </div>
        </div>
      </Modal>

      {/* Modal Rechazar */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: null, motivo: "" })}
        title={t("profile_req_rechazar_title", "Rechazar Solicitud")}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal({ open: false, id: null, motivo: "" })}>
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button variant="danger" onClick={handleRechazar}>
              <XCircle className="w-4 h-4 mr-2" />
              {t("profile_req_rechazar", "Rechazar")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            {t("profile_req_rechazar_desc", "El solicitante sera notificado del rechazo.")}
          </p>
          <div>
            <label className="text-sm font-medium text-[var(--fg)]">
              {t("profile_req_motivo", "Motivo del rechazo")} *
            </label>
            <textarea
              value={rejectModal.motivo}
              onChange={(e) => setRejectModal(prev => ({ ...prev, motivo: e.target.value }))}
              rows={3}
              className="w-full mt-2 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
              placeholder="Indica el motivo del rechazo..."
            />
          </div>
        </div>
      </Modal>

      {/* Modal Mensaje */}
      <Modal
        isOpen={messageModal.open}
        onClose={() => setMessageModal({ open: false, id: null, mensaje: "" })}
        title={t("profile_req_mensaje_title", "Enviar Mensaje")}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMessageModal({ open: false, id: null, mensaje: "" })}>
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button onClick={handleEnviarMensaje}>
              <Send className="w-4 h-4 mr-2" />
              {t("profile_req_enviar", "Enviar")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            {t("profile_req_mensaje_desc", "El mensaje sera enviado a la bandeja de entrada del solicitante.")}
          </p>
          <div>
            <label className="text-sm font-medium text-[var(--fg)]">
              {t("profile_req_mensaje_contenido", "Mensaje")} *
            </label>
            <textarea
              value={messageModal.mensaje}
              onChange={(e) => setMessageModal(prev => ({ ...prev, mensaje: e.target.value }))}
              rows={4}
              className="w-full mt-2 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
              placeholder="Escribe tu mensaje..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
