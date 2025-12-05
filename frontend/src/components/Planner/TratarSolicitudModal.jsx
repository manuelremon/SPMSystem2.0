import React, { useEffect, useMemo, useState } from "react";
import Paso1AnalisisInicial from "./Paso1AnalisisInicial";
import Paso2DecisionAbastecimiento from "./Paso2DecisionAbastecimiento";
import Paso3RevisionFinal from "./Paso3RevisionFinal";
import api from "../../services/api";
import { ensureCsrfToken } from "../../services/csrf";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Check } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import { renderSector as renderSectorUtil } from "../../constants/sectores";
import { formatAlmacen } from "../../utils/formatters";

const PasoLabels = ["Analisis", "Decision", "Confirmacion"];

export default function TratarSolicitudModal({ solicitud, isOpen, onClose, onComplete }) {
  const [paso, setPaso] = useState(1);
  const [analisis, setAnalisis] = useState(null);
  const [opciones, setOpciones] = useState({});
  const [decisiones, setDecisiones] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingOpciones, setLoadingOpciones] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [infoRequest, setInfoRequest] = useState("");

  const itemsAnalisis = useMemo(() => {
    const grupos = analisis?.materiales_por_criticidad || {};
    const all = [
      ...(grupos.Critico || []),
      ...(grupos.Normal || []),
      ...(grupos.Bajo || []),
    ];
    return all.sort((a, b) => (a?.idx ?? 0) - (b?.idx ?? 0));
  }, [analisis]);

  const totalItems = analisis?.resumen?.total_items || itemsAnalisis.length || 0;

  useEffect(() => {
    if (isOpen && solicitud) {
      resetState();
      cargarAnalisis();
      recuperarDecisiones();
    }
  }, [isOpen, solicitud]);

  // Auto-save: Guardar decisiones en localStorage cada vez que cambian
  useEffect(() => {
    if (solicitud?.id && Object.keys(decisiones).length > 0) {
      const key = `planner_decisiones_${solicitud.id}`;
      localStorage.setItem(key, JSON.stringify(decisiones));
    }
  }, [decisiones, solicitud?.id]);

  const recuperarDecisiones = () => {
    if (!solicitud?.id) return;
    try {
      const key = `planner_decisiones_${solicitud.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDecisiones(parsed);
      }
    } catch (err) {
      console.error("Error al recuperar decisiones guardadas:", err);
    }
  };

  const limpiarDecisionesGuardadas = () => {
    if (!solicitud?.id) return;
    try {
      const key = `planner_decisiones_${solicitud.id}`;
      localStorage.removeItem(key);
    } catch (err) {
      console.error("Error al limpiar decisiones guardadas:", err);
    }
  };

  const resetState = () => {
    setPaso(1);
    setError("");
    setAnalisis(null);
    setOpciones({});
    setDecisiones({});
    setCurrentIdx(0);
    setSaving(false);
  };

  const cargarAnalisis = async () => {
    if (!solicitud?.id) return;
    setLoading(true);
    setError("");
    try {
      await ensureCsrfToken();
      const response = await api.post(`/planificador/solicitudes/${solicitud.id}/analizar`);
      setAnalisis(response.data?.data || {});
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error desconocido";
      setError(`Error al cargar análisis: ${mensaje}`);
      console.error("Error completo en cargarAnalisis:", err);
    } finally {
      setLoading(false);
    }
  };

  const cargarOpciones = async (itemIdx) => {
    if (opciones[itemIdx] || itemIdx == null) return;
    setLoadingOpciones(true);
    setError("");
    try {
      await ensureCsrfToken();
      const res = await api.get(`/planificador/solicitudes/${solicitud.id}/items/${itemIdx}/opciones-abastecimiento`);
      const data = res.data?.data || {};
      setOpciones((prev) => ({ ...prev, [itemIdx]: data }));
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error desconocido";
      setError(`Error al cargar opciones de abastecimiento (Item ${itemIdx}): ${mensaje}`);
      console.error("Error completo en cargarOpciones:", err);
    } finally {
      setLoadingOpciones(false);
    }
  };

  const handleSelectDecision = (itemIdx, opcion) => {
    setDecisiones((prev) => ({ ...prev, [itemIdx]: opcion }));
  };

  const handleNext = async () => {
    if (paso === 1) {
      setPaso(2);
      await cargarOpciones(0);
      return;
    }
    if (paso === 2) {
      if (Object.keys(decisiones).length < totalItems) {
        setError("Debes seleccionar al menos una opcion para cada item antes de continuar.");
        return;
      }
      setPaso(3);
      return;
    }
  };

  const handleGuardar = async () => {
    if (!solicitud?.id) return;
    if (Object.keys(decisiones).length < totalItems) {
      setError("Faltan decisiones por completar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const decisionesPayload = Object.entries(decisiones).map(([idx, op]) => ({
        item_idx: Number(idx),
        decision_tipo: op?.tipo || op?.opcion_id || "stock",
        cantidad_aprobada: op?.cantidad_aprobada ?? op?.cantidad_solicitada ?? op?.cantidad_disponible ?? op?.cantidad ?? 0,
        codigo_material: op?.codigo_material || op?.codigo_original,
        id_proveedor: op?.id_proveedor,
        precio_unitario_final: op?.precio_unitario,
        plazo_dias: op?.plazo_dias,
        compatibilidad_pct: op?.compatibilidad_pct,
        observaciones: op?.observaciones || op?.motivo_equivalencia || "",
        opcion_id: op?.opcion_id,
      }));
      await ensureCsrfToken();
      await api.post(`/planificador/solicitudes/${solicitud.id}/guardar-tratamiento`, {
        decisiones: decisionesPayload,
      });
      limpiarDecisionesGuardadas(); // Limpiar auto-save después de guardar exitosamente
      onComplete?.();
      onClose?.();
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al guardar el tratamiento";
      setError(`${mensaje}. Por favor, intente nuevamente.`);
      console.error("Error completo en handleGuardar:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setError("Debe ingresar un motivo de rechazo");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await ensureCsrfToken();
      // Llamar API de rechazo (esta ruta existe en solicitudes.py)
      await api.post(`/solicitudes/${solicitud.id}/rechazar`, {
        motivo: rejectReason.trim()
      });
      setShowRejectModal(false);
      setRejectReason("");
      onComplete?.();
      onClose?.();
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al rechazar";
      setError(`${mensaje}. Por favor, intente nuevamente.`);
      console.error("Error en handleConfirmReject:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestInfoClick = () => {
    setShowRequestInfoModal(true);
  };

  const handleConfirmRequestInfo = async () => {
    if (!infoRequest.trim()) {
      setError("Debe especificar qué información necesita");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await ensureCsrfToken();

      // 1. Agregar comentario/notificación a la solicitud (mantener funcionalidad existente)
      await api.post(`/solicitudes/${solicitud.id}/comentar`, {
        comentario: `[SOLICITUD DE INFORMACIÓN] ${infoRequest.trim()}`,
        requiere_respuesta: true
      });

      // 2. Enviar mensaje al solicitante en su bandeja de entrada
      await api.post(`/mensajes`, {
        destinatario_id: solicitud.id_usuario,
        asunto: `Solicitud de información - Solicitud #${solicitud.id}`,
        mensaje: infoRequest.trim(),
        solicitud_id: solicitud.id,
        tipo: 'solicitud_informacion',
        metadata: {
          origen: 'planificador',
          paso: 'analisis_inicial'
        }
      });

      setShowRequestInfoModal(false);
      setInfoRequest("");
      alert("Solicitud de información enviada al solicitante. El solicitante recibirá el mensaje en su bandeja de entrada.");
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al enviar solicitud";
      setError(`${mensaje}. Por favor, intente nuevamente.`);
      console.error("Error en handleConfirmRequestInfo:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !solicitud) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[2080px] max-h-[92vh] overflow-hidden rounded-2xl border border-[var(--border)] shadow-[var(--shadow-strong)] bg-[var(--card)]">
        <div className="relative px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-soft)]">
          <Button variant="ghost" type="button" onClick={onClose} className="absolute right-4 top-4">
            Cerrar
          </Button>
          <div className="space-y-2">
            <p className="text-xs uppercase font-extrabold tracking-[0.18em] text-[var(--fg-muted)]">Planificador</p>
            <h2 className="text-2xl font-black text-[var(--fg)]">Tratar solicitud #{solicitud.id}</h2>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-[var(--fg-muted)]">
              <span><span className="font-semibold text-[var(--fg)]">Centro:</span> {solicitud.centro || "N/D"}</span>
              <span className="text-[var(--border)]">/</span>
              <span><span className="font-semibold text-[var(--fg)]">Almacén:</span> {formatAlmacen(solicitud.almacen_virtual)}</span>
              <span className="text-[var(--border)]">/</span>
              <span><span className="font-semibold text-[var(--fg)]">Sector:</span> {renderSector(solicitud)}</span>
              <span className="text-[var(--border)]">/</span>
              <span><span className="font-semibold text-[var(--fg)]">Solicitante:</span> {renderSolicitante(solicitud)}</span>
              <span className="text-[var(--border)]">/</span>
              <span><span className="font-semibold text-[var(--fg)]">Criticidad:</span> {solicitud.criticidad || analisis?.resumen?.criticidad || "N/D"}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-center gap-4">
          {PasoLabels.map((label, idx) => {
            const step = idx + 1;
            const active = paso === step;
            const done = paso > step;
            const canNavigate = done || active; // Can click on completed or current step

            return (
              <button
                key={label}
                type="button"
                onClick={() => canNavigate && setPaso(step)}
                disabled={!canNavigate}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  canNavigate ? "cursor-pointer hover:bg-[var(--bg-hover)]" : "cursor-not-allowed opacity-50"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full grid place-items-center font-black text-sm transition-all ${
                    active
                      ? "bg-[var(--primary)] text-white"
                      : done
                        ? "bg-[var(--success)] text-white"
                        : "bg-[var(--bg-soft)] text-[var(--fg-muted)]"
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : step}
                </div>
                <span className={`text-sm ${active ? "text-[var(--fg)] font-semibold" : done ? "text-[var(--success)] font-medium" : "text-[var(--fg-muted)]"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="px-6 py-3 bg-[var(--danger-bg)] text-[var(--danger)] border-b border-[var(--danger-border)]">
            {error}
          </div>
        )}

        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {loading && paso === 1 ? (
            <Card>
              <CardContent className="p-6 text-center text-[var(--fg-muted)]">Cargando analisis...</CardContent>
            </Card>
          ) : paso === 1 ? (
            <Paso1AnalisisInicial
              analisis={analisis || {}}
              solicitud={solicitud}
              onNext={handleNext}
              onReject={handleRejectClick}
              onRequestInfo={handleRequestInfoClick}
            />
          ) : paso === 2 ? (
            <Paso2DecisionAbastecimiento
              solicitud={solicitud}
              analisis={analisis}
              items={itemsAnalisis}
              totalItems={totalItems}
              currentIdx={currentIdx}
              onChangeIdx={setCurrentIdx}
              opciones={opciones}
              decisiones={decisiones}
              onSelectDecision={handleSelectDecision}
              onFetchOpciones={cargarOpciones}
              loadingOpciones={loadingOpciones}
              onPrev={() => setPaso(1)}
              onNext={handleNext}
            />
          ) : (
            <Paso3RevisionFinal
              solicitud={solicitud}
              items={itemsAnalisis}
              decisiones={decisiones}
              totalItems={totalItems}
              onBack={() => setPaso(2)}
              onConfirm={handleGuardar}
              loading={saving}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-soft)] flex justify-between">
          <Button variant="ghost" type="button" onClick={() => setPaso(Math.max(1, paso - 1))} disabled={paso === 1 || saving}>
            Anterior
          </Button>
          <Button
            type="button"
            onClick={paso === 3 ? handleGuardar : handleNext}
            disabled={saving || (paso === 2 && loadingOpciones)}
          >
            {saving ? "Guardando..." : paso === 3 ? "Guardar tratamiento" : "Siguiente"}
          </Button>
        </div>
      </div>

      {/* Modal de Rechazo */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-strong)] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] font-extrabold text-[var(--fg-muted)]">
                  Rechazar Solicitud
                </p>
                <h3 className="text-xl font-black text-[var(--fg)]">
                  #{solicitud.id}
                </h3>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                Cancelar
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-[var(--fg-muted)]">
                Motivo del rechazo
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                placeholder="Explique por qué se rechaza esta solicitud..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                type="button"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleConfirmReject} type="button" disabled={saving}>
                {saving ? "Rechazando..." : "Confirmar rechazo"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitud de Información */}
      {showRequestInfoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-strong)] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] font-extrabold text-[var(--fg-muted)]">
                  Solicitar Información
                </p>
                <h3 className="text-xl font-black text-[var(--fg)]">
                  Solicitud #{solicitud.id}
                </h3>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
                onClick={() => {
                  setShowRequestInfoModal(false);
                  setInfoRequest("");
                }}
              >
                Cancelar
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-[var(--fg-muted)]">
                ¿Qué información necesita del solicitante?
              </p>
              <textarea
                value={infoRequest}
                onChange={(e) => setInfoRequest(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                placeholder="Especifique qué información adicional requiere..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRequestInfoModal(false);
                  setInfoRequest("");
                }}
                type="button"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmRequestInfo} type="button" disabled={saving}>
                {saving ? "Enviando..." : "Enviar solicitud"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderSector(solicitud) {
  return renderSectorUtil(solicitud);
}

function renderSolicitante(solicitud) {
  const nombre = solicitud.solicitante_nombre || solicitud.nombre || "";
  const apellido = solicitud.solicitante_apellido || solicitud.apellido || "";
  const full = `${nombre} ${apellido}`.trim();
  return full || solicitud.id_usuario || "N/D";
}
