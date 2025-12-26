import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { budget } from "../services/spm";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { SearchInput } from "../components/ui/SearchInput";
import { Card, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { withSpmAlignments } from "../utils/tableAlignments";
import StatusBadge from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import { useDebounced } from "../hooks/useDebounced";
import { Modal } from "../components/ui/Modal";
import { XCircle, CheckCircle, RefreshCw, Plus, Eye, TrendingUp, TrendingDown, FileText } from "../components/ui/Icons";

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
  const [mainTab, setMainTab] = useState("historial"); // "solicitudes" | "historial"
  const [tab, setTab] = useState("todas");

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

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

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setError("");
    try {
      const res = await budget.getLedger({ limit: 100 });
      setLedgerEntries(res.data.entries || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "solicitudes") {
      load();
    } else {
      loadLedger();
    }
  }, [load, loadLedger, mainTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (mainTab === "solicitudes") {
      await load();
    } else {
      await loadLedger();
    }
    setRefreshing(false);
  }, [load, loadLedger, mainTab]);

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

  const columns = useMemo(() => withSpmAlignments([
    {
      key: "id",
      header: t("bur_col_id", "ID"),
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => <span className="font-semibold text-slate-800">#{row.id}</span>,
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
        <span className="font-mono text-sm text-slate-800">
          {formatCurrency(row.monto_solicitado_usd)}
        </span>
      ),
    },
    {
      key: "nivel_aprobacion_requerido",
      header: t("bur_col_nivel", "Nivel"),
      sortAccessor: (row) => row.nivel_aprobacion_requerido || "",
      render: (row) => (
        <span className="text-xs px-2 py-1 rounded bg-slate-100/70 text-slate-500">
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
            <Eye className="w-4 h-4 mr-1 text-blue-500" />
            {t("bur_ver", "Ver")}
          </Button>
          {["pendiente", "aprobado_l1", "aprobado_l2"].includes(row.estado) && (
            <>
              <Button
                className="px-3 py-1.5 text-xs"
                onClick={() => openApproveModal(row.id)}
              >
                <CheckCircle className="w-4 h-4 mr-1 text-emerald-500" />
                {t("bur_aprobar", "Aprobar")}
              </Button>
              <Button
                variant="danger"
                className="px-3 py-1.5 text-xs"
                onClick={() => openRejectModal(row.id)}
              >
                <XCircle className="w-4 h-4 mr-1 text-red-500" />
                {t("bur_rechazar", "Rechazar")}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]), [t, navigate, openApproveModal, openRejectModal]);

  const tabs = [
    { key: "todas", label: t("bur_tab_todas", "Todas") },
    { key: "pendientes", label: t("bur_tab_pendientes", "Pendientes") },
    { key: "aprobadas", label: t("bur_tab_aprobadas", "Aprobadas") },
    { key: "rechazadas", label: t("bur_tab_rechazadas", "Rechazadas") },
  ];

  // Ledger columns
  const ledgerColumns = useMemo(() => withSpmAlignments([
    {
      key: "created_at",
      header: t("ledger_col_fecha", "Fecha"),
      sortAccessor: (row) => row.created_at || "",
      render: (row) => {
        const date = new Date(row.created_at);
        return (
          <span className="text-sm text-slate-600">
            {date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
            <span className="text-xs text-slate-400 ml-1">
              {date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </span>
        );
      },
    },
    {
      key: "tipo_movimiento",
      header: t("ledger_col_tipo", "Tipo"),
      sortAccessor: (row) => row.tipo_movimiento || "",
      render: (row) => {
        const tipo = row.tipo_movimiento || "";
        const isConsumo = tipo.includes("consumo");
        const isIncorporacion = tipo.includes("incorporacion") || tipo.includes("ajuste_positivo");
        return (
          <div className="flex items-center gap-2">
            {isConsumo ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : isIncorporacion ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400" />
            )}
            <span className={`text-xs px-2 py-1 rounded ${
              isConsumo ? "bg-red-50 text-red-700" :
              isIncorporacion ? "bg-green-50 text-green-700" :
              "bg-slate-100 text-slate-600"
            }`}>
              {tipo.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        );
      },
    },
    {
      key: "centro",
      header: t("ledger_col_centro", "Centro"),
      sortAccessor: (row) => row.centro || "",
      render: (row) => row.centro || "-",
    },
    {
      key: "sector",
      header: t("ledger_col_sector", "Sector"),
      sortAccessor: (row) => row.sector || "",
      render: (row) => row.sector || "-",
    },
    {
      key: "monto",
      header: t("ledger_col_monto", "Monto"),
      sortAccessor: (row) => Math.abs(row.monto_cents || 0),
      render: (row) => {
        const montoCents = row.monto_cents || 0;
        const monto = montoCents / 100;
        const isNegative = montoCents < 0;
        return (
          <span className={`font-mono text-sm ${isNegative ? "text-red-600" : "text-green-600"}`}>
            {isNegative ? "-" : "+"}{formatCurrency(Math.abs(monto))}
          </span>
        );
      },
    },
    {
      key: "saldo",
      header: t("ledger_col_saldo", "Saldo"),
      sortAccessor: (row) => row.saldo_posterior_cents || 0,
      render: (row) => {
        const saldo = (row.saldo_posterior_cents || 0) / 100;
        return (
          <span className="font-mono text-sm text-slate-800">
            {formatCurrency(saldo)}
          </span>
        );
      },
    },
    {
      key: "referencia",
      header: t("ledger_col_referencia", "Referencia"),
      sortAccessor: (row) => row.referencia_id || "",
      render: (row) => {
        if (!row.referencia_id) return "-";
        const tipo = row.referencia_tipo || "";
        if (tipo === "solicitud") {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="px-2 py-1 text-xs"
              onClick={() => navigate(`/solicitud/${row.referencia_id}`)}
            >
              <FileText className="w-3 h-3 mr-1 text-blue-500" />
              #{row.referencia_id}
            </Button>
          );
        }
        return <span className="text-xs text-slate-500">{tipo} #{row.referencia_id}</span>;
      },
    },
    {
      key: "motivo",
      header: t("ledger_col_motivo", "Motivo"),
      render: (row) => (
        <span className="text-sm text-slate-600 line-clamp-1" title={row.motivo}>
          {row.motivo || "-"}
        </span>
      ),
    },
  ]), [t, navigate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("bur_title", "PRESUPUESTOS").toUpperCase()}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={refreshing || loading || ledgerLoading}
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
              {t("common_refresh", "Actualizar")}
            </Button>
            <Button onClick={() => navigate("/presupuestos/nueva")}>
              <Plus className="w-4 h-4 text-blue-600" />
              {t("bur_crear", "Incorporar Saldo")}
            </Button>
          </div>
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      {/* Main Tabs: Historial / Solicitudes */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setMainTab("historial")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            mainTab === "historial"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          {t("bur_main_historial", "Historial de Movimientos")}
        </button>
        <button
          onClick={() => setMainTab("solicitudes")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            mainTab === "solicitudes"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          {t("bur_main_solicitudes", "Solicitudes BUR")}
        </button>
      </div>

      {/* Content based on main tab */}
      {mainTab === "historial" ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {t("ledger_descripcion", "Movimientos de presupuesto por aprobaciones y ajustes")}
              </p>
              {ledgerLoading && (
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("bur_loading", "Cargando...")}
                </div>
              )}
            </div>

            {ledgerLoading ? (
              <TableSkeleton rows={5} columns={8} />
            ) : (
              <DataTable
                columns={ledgerColumns}
                rows={ledgerEntries}
                emptyMessage={t("ledger_empty", "No hay movimientos de presupuesto")}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Sub-tabs for BUR */}
            <div className="flex items-center gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30 w-fit">
              {tabs.map((tabItem) => (
                <button
                  key={tabItem.key}
                  onClick={() => setTab(tabItem.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === tabItem.key
                      ? "bg-white shadow-sm text-blue-600"
                      : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
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
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
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
      )}

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
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              {t("bur_aprobar", "Aprobar")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("bur_comentario_aprobacion", "Comentario (opcional)")}
          </label>
          <textarea
            value={approveModal.comentario}
            onChange={(e) => setApproveModal((prev) => ({ ...prev, comentario: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/50 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all resize-none"
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
              <XCircle className="w-4 h-4 text-red-500" />
              {t("bur_rechazar", "Rechazar")}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("bur_motivo_rechazo", "Motivo de rechazo")} *
          </label>
          <textarea
            value={rejectModal.motivo}
            onChange={(e) => setRejectModal((prev) => ({ ...prev, motivo: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/50 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all resize-none"
            placeholder={t("bur_motivo_placeholder", "Indica el motivo del rechazo...")}
          />
        </div>
      </Modal>
    </div>
  );
}
