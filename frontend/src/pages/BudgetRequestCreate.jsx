import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { budget } from "../services/spm";
import api from "../services/api";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { useI18n } from "../context/i18n";
import { formatCurrency } from "../utils/formatters";
import { ArrowLeft, Send, DollarSign, Building, MapPin } from "../components/ui/Icons";

const UMBRAL_L1 = 200000;
const UMBRAL_L2 = 1000000;

export default function BudgetRequestCreate() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    centro: "",
    sector: "",
    monto_solicitado: "",
    justificacion: "",
  });

  // Catalogs
  const [centros, setCentros] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [presupuestoInfo, setPresupuestoInfo] = useState(null);

  // Load catalogs (using public endpoints, not admin)
  useEffect(() => {
    const loadCatalogos = async () => {
      setLoading(true);
      try {
        const [centrosRes, sectoresRes] = await Promise.all([
          api.get("/catalogos/centros"),
          api.get("/catalogos/sectores"),
        ]);
        setCentros(centrosRes.data || []);
        setSectores(sectoresRes.data || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    loadCatalogos();
  }, []);

  // Load budget info when centro/sector changes
  useEffect(() => {
    const loadPresupuesto = async () => {
      if (!form.centro || !form.sector) {
        setPresupuestoInfo(null);
        return;
      }
      try {
        const res = await budget.getInfo(form.centro, form.sector);
        setPresupuestoInfo(res.data.presupuesto || null);
      } catch {
        setPresupuestoInfo(null);
      }
    };
    loadPresupuesto();
  }, [form.centro, form.sector]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const getNivelAprobacion = useCallback((monto) => {
    const m = parseFloat(monto) || 0;
    if (m > UMBRAL_L2) return { nivel: "ADMIN", label: t("bur_nivel_admin", "Admin (mas de $1M)") };
    if (m > UMBRAL_L1) return { nivel: "L2", label: t("bur_nivel_l2", "Nivel 2 (hasta $1M)") };
    return { nivel: "L1", label: t("bur_nivel_l1", "Nivel 1 (hasta $200K)") };
  }, [t]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    // Validations
    if (!form.centro || !form.sector) {
      setError(t("admin_required_fields", "Faltan campos obligatorios"));
      return;
    }
    const monto = parseFloat(form.monto_solicitado);
    if (!monto || monto <= 0) {
      setError(t("bur_create_error", "Monto debe ser mayor a 0"));
      return;
    }
    if ((form.justificacion || "").trim().length < 10) {
      setError(t("bur_campo_justificacion", "Justificacion debe tener al menos 10 caracteres"));
      return;
    }

    setSubmitting(true);
    try {
      await budget.crear({
        centro: form.centro,
        sector: form.sector,
        monto_solicitado: monto,
        justificacion: form.justificacion.trim(),
      });
      setMsg(t("bur_create_success", "Solicitud creada exitosamente"));
      setTimeout(() => navigate("/presupuestos"), 1500);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate, t]);

  const nivelInfo = getNivelAprobacion(form.monto_solicitado);
  const montoNum = parseFloat(form.monto_solicitado) || 0;
  const nuevoSaldo = presupuestoInfo
    ? (presupuestoInfo.saldo_usd || 0) + montoNum
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("bur_create_title", "NUEVA SOLICITUD DE PRESUPUESTO").toUpperCase()}
        actions={
          <Button variant="ghost" onClick={() => navigate("/presupuestos")}>
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            {t("common_volver", "Volver")}
          </Button>
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {msg && <Alert variant="success" onDismiss={() => setMsg("")}>{msg}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Centro */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    <Building className="w-4 h-4 inline mr-2 text-slate-600" />
                    {t("bur_campo_centro", "Centro")} *
                  </label>
                  <select
                    name="centro"
                    value={form.centro}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/50 text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all"
                    disabled={loading}
                  >
                    <option value="">{t("crud_select", "Selecciona")}...</option>
                    {centros.map((c) => (
                      <option key={c.codigo || c.id} value={c.codigo || c.id}>
                        {c.codigo || c.id} - {c.nombre || c.descripcion || ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    <MapPin className="w-4 h-4 inline mr-2 text-slate-600" />
                    {t("bur_campo_sector", "Sector")} *
                  </label>
                  <select
                    name="sector"
                    value={form.sector}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/50 text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all"
                    disabled={loading}
                  >
                    <option value="">{t("crud_select", "Selecciona")}...</option>
                    {sectores.map((s) => (
                      <option key={s.id || s.codigo} value={s.nombre}>
                        {s.nombre || s.descripcion || ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Monto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    <DollarSign className="w-4 h-4 inline mr-2 text-amber-700" />
                    {t("bur_campo_monto", "Monto (USD)")} *
                  </label>
                  <input
                    type="number"
                    name="monto_solicitado"
                    value={form.monto_solicitado}
                    onChange={handleChange}
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/50 text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all font-mono"
                  />
                  {montoNum > 0 && (
                    <p className="text-xs text-slate-500">
                      {t("bur_col_nivel", "Nivel de aprobacion")}: <span className="font-semibold text-blue-600">{nivelInfo.label}</span>
                    </p>
                  )}
                </div>

                {/* Justificacion */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    {t("bur_campo_justificacion", "Justificacion")} *
                  </label>
                  <textarea
                    name="justificacion"
                    value={form.justificacion}
                    onChange={handleChange}
                    rows={4}
                    placeholder={t("bur_campo_justificacion_placeholder", "Explica el motivo del aumento de presupuesto...")}
                    className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/50 text-sm text-slate-800 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all resize-none"
                  />
                  <p className="text-xs text-slate-500">
                    {(form.justificacion || "").length}/10 {t("common_minimo", "mínimo")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-white/30">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate("/presupuestos")}
                    disabled={submitting}
                  >
                    {t("bur_btn_cancelar", "Cancelar")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || loading}
                    className="flex-1"
                  >
                    <Send className="w-4 h-4 text-blue-600" />
                    {submitting ? t("common_cargando", "Cargando...") : t("bur_btn_enviar", "Enviar Solicitud")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          {/* Current budget */}
          {presupuestoInfo && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("bur_saldo_actual", "Saldo actual")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">{t("common_presupuesto", "Presupuesto")}</span>
                    <span className="font-mono text-lg font-semibold text-slate-800">
                      {formatCurrency(presupuestoInfo.monto_usd)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">{t("bur_saldo_actual", "Saldo")}</span>
                    <span className="font-mono text-lg font-semibold text-emerald-600">
                      {formatCurrency(presupuestoInfo.saldo_usd)}
                    </span>
                  </div>
                  {montoNum > 0 && (
                    <>
                      <div className="border-t border-white/30 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">{t("bur_saldo_nuevo", "Nuevo saldo")}</span>
                          <span className="font-mono text-lg font-semibold text-blue-600">
                            {formatCurrency(nuevoSaldo)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval levels info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("bur_col_nivel", "Niveles de Aprobación")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">L1</span>
                  <span>{t("bur_nivel_l1", "Hasta $200K")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">L2</span>
                  <span>{t("bur_nivel_l2", "Hasta $1M")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Admin</span>
                  <span>{t("bur_nivel_admin", "Mas de $1M")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
