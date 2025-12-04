import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { budget } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import StatusBadge from "../components/ui/StatusBadge";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import { Modal } from "../components/ui/Modal";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  DollarSign,
  Building,
  MapPin,
  User,
  Calendar,
  FileText,
  Shield,
} from "lucide-react";

const estadoToBadge = {
  pendiente: "Pendiente",
  aprobado_l1: "Aprobado L1",
  aprobado_l2: "Aprobado L2",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
};

const nivelLabels = {
  L1: "Nivel 1 (hasta $200K)",
  L2: "Nivel 2 (hasta $1M)",
  ADMIN: "Admin (mas de $1M)",
};

export default function BudgetRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const [bur, setBur] = useState(null);
  const [presupuestoInfo, setPresupuestoInfo] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [approveModal, setApproveModal] = useState({ open: false, comentario: "" });
  const [rejectModal, setRejectModal] = useState({ open: false, motivo: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await budget.obtener(id);
      const data = res.data.request;
      setBur(data);

      // Load budget info
      if (data?.centro && data?.sector) {
        try {
          const presRes = await budget.getInfo(data.centro, data.sector);
          setPresupuestoInfo(presRes.data.presupuesto || null);
        } catch {
          setPresupuestoInfo(null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAprobar = useCallback(async () => {
    setError("");
    setMsg("");
    try {
      await budget.aprobar(id, approveModal.comentario);
      setMsg(t("bur_aprobada_msg", "Solicitud de presupuesto aprobada"));
      setApproveModal({ open: false, comentario: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [id, approveModal.comentario, load, t]);

  const handleRechazar = useCallback(async () => {
    setError("");
    setMsg("");
    const motivo = rejectModal.motivo.trim();
    if (motivo.length < 5) {
      setError(t("bur_motivo_required", "Debe proporcionar un motivo"));
      return;
    }
    try {
      await budget.rechazar(id, motivo);
      setMsg(t("bur_rechazada_msg", "Solicitud de presupuesto rechazada"));
      setRejectModal({ open: false, motivo: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, [id, rejectModal.motivo, load, t]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canApprove = bur?.estado === "pendiente";
  const nuevoSaldo = presupuestoInfo && bur
    ? (presupuestoInfo.saldo_usd || 0) + (bur.monto_solicitado_usd || 0)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[var(--fg-muted)]">{t("common_cargando", "Cargando...")}</div>
      </div>
    );
  }

  if (!bur) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("bur_detail_title", "DETALLE DE SOLICITUD").toUpperCase()}
          actions={
            <Button variant="ghost" onClick={() => navigate("/presupuestos")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common_volver", "Volver")}
            </Button>
          }
        />
        <Alert variant="danger">{t("common_no_encontrado", "Solicitud no encontrada")}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("bur_detail_title", "SOLICITUD")} #${id}`.toUpperCase()}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/presupuestos")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common_volver", "Volver")}
            </Button>
            {canApprove && (
              <>
                <Button onClick={() => setApproveModal({ open: true, comentario: "" })}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t("bur_aprobar", "Aprobar")}
                </Button>
                <Button variant="danger" onClick={() => setRejectModal({ open: true, motivo: "" })}>
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("bur_rechazar", "Rechazar")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("bur_detail_title", "Detalle de Solicitud")}</CardTitle>
                <StatusBadge estado={estadoToBadge[bur.estado] || bur.estado} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Centro */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <Building className="w-4 h-4" />
                    {t("bur_campo_centro", "Centro")}
                  </div>
                  <div className="text-lg font-semibold text-[var(--fg)]">{bur.centro || "-"}</div>
                </div>

                {/* Sector */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <MapPin className="w-4 h-4" />
                    {t("bur_campo_sector", "Sector")}
                  </div>
                  <div className="text-lg font-semibold text-[var(--fg)]">{bur.sector || "-"}</div>
                </div>

                {/* Monto */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <DollarSign className="w-4 h-4" />
                    {t("bur_col_monto", "Monto Solicitado")}
                  </div>
                  <div className="text-2xl font-bold font-mono text-[var(--primary)]">
                    {formatCurrency(bur.monto_solicitado_usd)}
                  </div>
                </div>

                {/* Nivel */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <Shield className="w-4 h-4" />
                    {t("bur_col_nivel", "Nivel de Aprobacion")}
                  </div>
                  <div className="text-lg font-semibold text-[var(--fg)]">
                    {nivelLabels[bur.nivel_aprobacion_requerido] || bur.nivel_aprobacion_requerido}
                  </div>
                </div>

                {/* Solicitante */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <User className="w-4 h-4" />
                    {t("bur_solicitante", "Solicitante")}
                  </div>
                  <div className="text-lg font-semibold text-[var(--fg)]">
                    {bur.solicitante_id || "-"}
                    {bur.solicitante_rol && (
                      <span className="ml-2 text-xs px-2 py-1 rounded bg-[var(--surface)] text-[var(--fg-muted)]">
                        {bur.solicitante_rol}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fecha */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <Calendar className="w-4 h-4" />
                    {t("bur_fecha_creacion", "Fecha de creacion")}
                  </div>
                  <div className="text-lg font-semibold text-[var(--fg)]">{formatDate(bur.created_at)}</div>
                </div>
              </div>

              {/* Justificacion */}
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)] mb-2">
                  <FileText className="w-4 h-4" />
                  {t("bur_campo_justificacion", "Justificacion")}
                </div>
                <div className="p-4 rounded-lg bg-[var(--surface)] text-[var(--fg)]">
                  {bur.justificacion || "-"}
                </div>
              </div>

              {/* Rejection reason if rejected */}
              {bur.estado === "rechazado" && bur.motivo_rechazo && (
                <div className="mt-6 pt-6 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2 text-sm text-[var(--danger)] mb-2">
                    <XCircle className="w-4 h-4" />
                    {t("bur_motivo_rechazo", "Motivo de rechazo")}
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-[var(--fg)]">
                    {bur.motivo_rechazo}
                  </div>
                </div>
              )}

              {/* Approval info */}
              {bur.aprobador_id && (
                <div className="mt-6 pt-6 border-t border-[var(--border)]">
                  <div className="flex items-center gap-2 text-sm text-[var(--success)] mb-2">
                    <CheckCircle className="w-4 h-4" />
                    {t("common_aprobado_por", "Aprobado por")}
                  </div>
                  <div className="text-[var(--fg)]">
                    {bur.aprobador_id}
                    {bur.aprobador_rol && (
                      <span className="ml-2 text-xs px-2 py-1 rounded bg-[var(--surface)] text-[var(--fg-muted)]">
                        {bur.aprobador_rol}
                      </span>
                    )}
                    {bur.aprobado_at && (
                      <span className="ml-2 text-sm text-[var(--fg-muted)]">
                        {formatDate(bur.aprobado_at)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Budget impact */}
          {presupuestoInfo && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("common_presupuesto", "Presupuesto")}</CardTitle>
                <CardDescription>{bur.centro}/{bur.sector}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--fg-muted)]">{t("bur_saldo_actual", "Saldo actual")}</span>
                    <span className="font-mono text-lg font-semibold text-[var(--fg)]">
                      {formatCurrency(presupuestoInfo.saldo_usd)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--fg-muted)]">{t("bur_col_monto", "Aumento")}</span>
                    <span className="font-mono text-lg font-semibold text-[var(--success)]">
                      +{formatCurrency(bur.monto_solicitado_usd)}
                    </span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--fg-muted)]">{t("bur_saldo_nuevo", "Nuevo saldo")}</span>
                      <span className="font-mono text-xl font-bold text-[var(--primary)]">
                        {formatCurrency(nuevoSaldo)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline / History placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("common_historial", "Historial")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                  <div>
                    <div className="text-[var(--fg)]">{t("bur_estado_pendiente", "Creada")}</div>
                    <div className="text-xs text-[var(--fg-muted)]">{formatDate(bur.created_at)}</div>
                  </div>
                </div>
                {bur.aprobado_at && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                    <div>
                      <div className="text-[var(--fg)]">{t("bur_estado_aprobado", "Aprobada")}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{formatDate(bur.aprobado_at)}</div>
                    </div>
                  </div>
                )}
                {bur.estado === "rechazado" && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--danger)]" />
                    <div>
                      <div className="text-[var(--fg)]">{t("bur_estado_rechazado", "Rechazada")}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{formatDate(bur.updated_at)}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, comentario: "" })}
        title={`${t("bur_aprobar", "Aprobar")} #${id}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveModal({ open: false, comentario: "" })}>
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button onClick={handleAprobar}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {t("bur_aprobar", "Aprobar")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            {t("bur_confirm_aprobar", "Esta accion aumentara el presupuesto de")} {bur.centro}/{bur.sector} {t("common_en", "en")} {formatCurrency(bur.monto_solicitado_usd)}.
          </p>
          <div className="space-y-2">
            <label className="text-sm text-[var(--fg-muted)]">
              {t("bur_comentario_aprobacion", "Comentario (opcional)")}
            </label>
            <textarea
              value={approveModal.comentario}
              onChange={(e) => setApproveModal((prev) => ({ ...prev, comentario: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
            />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, motivo: "" })}
        title={`${t("bur_rechazar", "Rechazar")} #${id}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal({ open: false, motivo: "" })}>
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button variant="danger" onClick={handleRechazar}>
              <XCircle className="w-4 h-4 mr-2" />
              {t("bur_rechazar", "Rechazar")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-sm text-[var(--fg-muted)]">
            {t("bur_motivo_rechazo", "Motivo de rechazo")} *
          </label>
          <textarea
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
            placeholder={t("bur_motivo_placeholder", "Indica el motivo del rechazo...")}
          />
        </div>
      </Modal>
    </div>
  );
}
