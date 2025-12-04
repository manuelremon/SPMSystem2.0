import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { budget } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/SearchInput";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { DataTable } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import { useDebounced } from "../hooks/useDebounced";
import { Modal } from "../components/ui/Modal";
import { XCircle, CheckCircle, RefreshCw, Plus, Eye } from "lucide-react";

const DEBOUNCE_MS = 300;

const estadoToBadge = {
  pendiente: "Pendiente",
  aprobado_l1: "Aprobado L1",
  aprobado_l2: "Aprobado L2",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
};

const nivelLabels = {
  L1: "Nivel 1",
  L2: "Nivel 2",
  ADMIN: "Admin",
};

export default function BudgetRequests() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, DEBOUNCE_MS);
  const [msg, setMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("todas");

  // Modals
  const [approveModal, setApproveModal] = useState({ open: false, id: null, comentario: "" });
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, motivo: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (tab === "pendientes") params.estado = "pendiente";
      else if (tab === "aprobadas") params.estado = "aprobado";
      else if (tab === "rechazadas") params.estado = "rechazado";

      const res = await budget.listar(params);
      const data = res.data.requests || [];
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) => {
      return (
        String(s.id).includes(term) ||
        (s.justificacion || "").toLowerCase().includes(term) ||
        (s.centro || "").toLowerCase().includes(term) ||
        (s.sector || "").toLowerCase().includes(term)
      );
    });
  }, [items, debouncedQ]);

  const openApproveModal = useCallback((id) => {
    setApproveModal({ open: true, id, comentario: "" });
  }, []);

  const confirmAprobar = useCallback(async () => {
    if (!approveModal.id) return;
    setMsg("");
    setError("");
    try {
      await budget.aprobar(approveModal.id, approveModal.comentario);
      setMsg(t("bur_aprobada_msg", "Solicitud de presupuesto aprobada"));
      setTimeout(() => setMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setApproveModal({ open: false, id: null, comentario: "" });
    }
  }, [approveModal.id, approveModal.comentario, load, t]);

  const openRejectModal = useCallback((id) => {
    setRejectModal({ open: true, id, motivo: "" });
  }, []);

  const confirmRechazar = useCallback(async () => {
    if (!rejectModal.id) return;
    setMsg("");
    setError("");
    const motivo = rejectModal.motivo.trim();
    if (motivo.length < 5) {
      setError(t("bur_motivo_required", "Debe proporcionar un motivo"));
      return;
    }
    try {
      await budget.rechazar(rejectModal.id, motivo);
      setMsg(t("bur_rechazada_msg", "Solicitud de presupuesto rechazada"));
      setTimeout(() => setMsg(""), 3000);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setRejectModal({ open: false, id: null, motivo: "" });
    }
  }, [rejectModal.id, rejectModal.motivo, load, t]);

  const columns = useMemo(() => [
    {
      key: "id",
      header: t("bur_col_id", "ID"),
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => <span className="font-semibold text-[var(--fg)]">#{row.id}</span>,
    },
    {
      key: "centro",
      header: t("bur_col_centro", "Centro"),
      sortAccessor: (row) => row.centro || "",
      render: (row) => row.centro || "-",
    },
    {
      key: "sector",
      header: t("bur_col_sector", "Sector"),
      sortAccessor: (row) => row.sector || "",
      render: (row) => row.sector || "-",
    },
    {
      key: "monto_solicitado_usd",
      header: t("bur_col_monto", "Monto"),
      sortAccessor: (row) => Number(row.monto_solicitado_usd || 0),
      render: (row) => (
        <span className="font-mono text-sm text-[var(--fg)]">
          {formatCurrency(row.monto_solicitado_usd)}
        </span>
      ),
    },
    {
      key: "nivel_aprobacion_requerido",
      header: t("bur_col_nivel", "Nivel"),
      sortAccessor: (row) => row.nivel_aprobacion_requerido || "",
      render: (row) => (
        <span className="text-xs px-2 py-1 rounded bg-[var(--surface)] text-[var(--fg-muted)]">
          {nivelLabels[row.nivel_aprobacion_requerido] || row.nivel_aprobacion_requerido}
        </span>
      ),
    },
    {
      key: "estado",
      header: t("bur_col_estado", "Estado"),
      sortAccessor: (row) => (row.estado || "").toLowerCase(),
      render: (row) => <StatusBadge estado={estadoToBadge[row.estado] || row.estado} />,
    },
    {
      key: "acciones",
      header: t("bur_col_acciones", "Acciones"),
      render: (row) => (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={() => navigate(`/presupuestos/${row.id}`)}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            {t("bur_ver", "Ver")}
          </Button>
          {["pendiente", "aprobado_l1", "aprobado_l2"].includes(row.estado) && (
            <>
              <Button
                className="px-3 py-1.5 text-xs"
                onClick={() => openApproveModal(row.id)}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                {t("bur_aprobar", "Aprobar")}
              </Button>
              <Button
                variant="danger"
                className="px-3 py-1.5 text-xs"
                onClick={() => openRejectModal(row.id)}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                {t("bur_rechazar", "Rechazar")}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ], [t, navigate, openApproveModal, openRejectModal]);

  const tabs = [
    { key: "todas", label: t("bur_tab_todas", "Todas") },
    { key: "pendientes", label: t("bur_tab_pendientes", "Pendientes") },
    { key: "aprobadas", label: t("bur_tab_aprobadas", "Aprobadas") },
    { key: "rechazadas", label: t("bur_tab_rechazadas", "Rechazadas") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("bur_title", "SOLICITUDES DE PRESUPUESTO").toUpperCase()}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {t("common_refresh", "Actualizar")}
            </Button>
            <Button onClick={() => navigate("/presupuestos/nueva")}>
              <Plus className="w-4 h-4 mr-2" />
              {t("bur_crear", "Incorporar Saldo")}
            </Button>
          </div>
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("bur_title", "Solicitudes de Presupuesto")}</CardTitle>
            <CardDescription>{t("bur_subtitle", "Gestiona solicitudes de aumento de presupuesto")}</CardDescription>
          </div>
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

          {/* Search */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("bur_search_placeholder", "Buscar por centro, sector o justificacion")}
              className="md:max-w-md"
            />
            {loading && (
              <div className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--fg-muted)]">
                {t("bur_loading", "Cargando...")}
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : (
            <DataTable
              columns={columns}
              rows={filtered}
              emptyMessage={t("bur_empty", "No hay solicitudes de presupuesto")}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal de aprobacion */}
      <Modal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, id: null, comentario: "" })}
        title={`${t("bur_aprobar", "Aprobar")} #${approveModal.id}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setApproveModal({ open: false, id: null, comentario: "" })}
            >
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button onClick={confirmAprobar}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {t("bur_aprobar", "Aprobar")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-sm text-[var(--fg-muted)]">
            {t("bur_comentario_aprobacion", "Comentario (opcional)")}
          </label>
          <textarea
            value={approveModal.comentario}
            onChange={(e) => setApproveModal((prev) => ({ ...prev, comentario: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
            placeholder={t("bur_comentario_aprobacion", "Comentario (opcional)")}
          />
        </div>
      </Modal>

      {/* Modal de rechazo */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: null, motivo: "" })}
        title={`${t("bur_rechazar", "Rechazar")} #${rejectModal.id}`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRejectModal({ open: false, id: null, motivo: "" })}
            >
              {t("common_cancelar", "Cancelar")}
            </Button>
            <Button variant="danger" onClick={confirmRechazar}>
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
