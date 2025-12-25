import React, { useEffect, useMemo, useState } from "react";
import Paso1AnalisisInicial from "./Paso1AnalisisInicial";
import Paso2DecisionAbastecimiento from "./Paso2DecisionAbastecimiento";
import Paso3RevisionFinal from "./Paso3RevisionFinal";
import Paso4AccionesPendientes from "./Paso4AccionesPendientes";
import api from "../../services/api";
import { ensureCsrfToken } from "../../services/csrf";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Check, TrendingUp, Layers } from "../ui/Icons";
import StatusBadge from "../ui/StatusBadge";
import { renderSector as renderSectorUtil } from "../../constants/sectores";
import { formatAlmacen } from "../../utils/formatters";
import { getCriticidadConfig } from "../../utils/styleConfig";

const PasoLabels = ["Analisis", "Decision", "Resumen", "Acciones"];

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
  const [mostrarMrp, setMostrarMrp] = useState(false);
  const [acciones, setAcciones] = useState(null);
  const [loadingAcciones, setLoadingAcciones] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

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
    setAcciones(null);
    setLoadingAcciones(false);
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

  /**
   * handleSelectDecision - Maneja decisiones multi-fuente
   *
   * Nuevo formato de decisión:
   * {
   *   fuentes: [{ opcion, cantidad_asignada, notas }, ...],
   *   comentario: string,
   *   cantidad_solicitada: number
   * }
   */
  const handleSelectDecision = (itemIdx, decision) => {
    setDecisiones((prev) => ({ ...prev, [itemIdx]: decision }));
  };

  /**
   * Verifica si un item tiene decisión completa (suma >= cantidad solicitada)
   */
  const isItemCompleto = (itemIdx) => {
    const dec = decisiones[itemIdx];
    if (!dec || !dec.fuentes || dec.fuentes.length === 0) return false;
    const totalAsignado = dec.fuentes.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
    const requerido = Number(itemsAnalisis[itemIdx]?.cantidad || 0);
    return totalAsignado >= requerido;
  };

  /**
   * Cuenta items completos e incompletos
   */
  const getItemsStatus = () => {
    let completos = 0;
    let incompletos = 0;
    for (let i = 0; i < totalItems; i++) {
      if (isItemCompleto(i)) {
        completos++;
      } else {
        incompletos++;
      }
    }
    return { completos, incompletos };
  };

  const handleNext = async () => {
    if (paso === 1) {
      setPaso(2);
      await cargarOpciones(0);
      return;
    }
    if (paso === 2) {
      const { incompletos } = getItemsStatus();
      if (incompletos > 0) {
        setError(`Faltan ${incompletos} item(s) por completar. Cada item debe tener fuentes asignadas que cubran la cantidad solicitada.`);
        return;
      }
      setPaso(3);
      return;
    }
    if (paso === 3) {
      // Guardar tratamiento y avanzar a paso 4
      await handleGuardarYAvanzar();
      return;
    }
  };

  const ejecutarAcciones = async (opciones = {}) => {
    if (!solicitud?.id) return null;
    setLoadingAcciones(true);
    try {
      await ensureCsrfToken();
      const response = await api.post(`/planificador/solicitudes/${solicitud.id}/ejecutar-acciones`, {
        enviar_resumen_solicitante: opciones.enviarResumenSolicitante || false,
      });
      const data = response.data?.data || {};
      setAcciones(data);
      return data;
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al ejecutar acciones";
      setError(`${mensaje}. Por favor, intente nuevamente.`);
      console.error("Error en ejecutarAcciones:", err);
      return null;
    } finally {
      setLoadingAcciones(false);
    }
  };

  const handleFinalizar = async () => {
    if (!solicitud?.id) return;

    // Validar que se ejecutaron las acciones
    if (!acciones) {
      setError("Debe ejecutar las acciones antes de finalizar.");
      return;
    }

    setFinalizando(true);
    setError("");

    try {
      await ensureCsrfToken();
      await api.post(`/planificador/solicitudes/${solicitud.id}/finalizar`);

      limpiarDecisionesGuardadas();
      onComplete?.();
      onClose?.();
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al finalizar";
      setError(`${mensaje}. Por favor, intente nuevamente.`);
      console.error("Error en handleFinalizar:", err);
    } finally {
      setFinalizando(false);
    }
  };

  const handleGuardarYAvanzar = async () => {
    if (!solicitud?.id) return;

    // Validar que todos los items esten completos
    const { incompletos } = getItemsStatus();
    if (incompletos > 0) {
      setError(`Faltan ${incompletos} item(s) por completar.`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await ensureCsrfToken();

      // Guardar cada decision multi-fuente usando el nuevo endpoint
      for (const [idx, decision] of Object.entries(decisiones)) {
        const itemIdx = Number(idx);
        const cantidadSolicitada = Number(itemsAnalisis[itemIdx]?.cantidad || 0);

        // Transformar fuentes al formato de la API
        const fuentes = (decision.fuentes || []).map((f, orden) => {
          const op = f.opcion || {};
          return {
            tipo_fuente: op.tipo || "stock",
            centro_origen: op.centro_origen || op.centro,
            almacen_origen: op.almacen_origen || op.almacen,
            cuit_proveedor: op.cuit || op.id_proveedor,
            proveedor_nombre: op.nombre,
            codigo_material_equiv: op.tipo === "equivalencia" ? op.codigo_material : null,
            tipo_equivalencia: op.tipo_equivalencia,
            cantidad_asignada: Number(f.cantidad_asignada || 0),
            precio_unitario: op.precio_unitario,
            precio_es_negociado: op.precio_es_negociado || false,
            plazo_dias: op.plazo_dias,
            score_opcion: op.score_recomendacion,
            orden_prioridad: orden + 1,
            notas: f.notas || op.observaciones || "",
          };
        });

        await api.post(
          `/planificador/solicitudes/${solicitud.id}/items/${itemIdx}/decision-multifuente`,
          {
            cantidad_solicitada: cantidadSolicitada,
            fuentes,
            comentario: decision.comentario || "",
          }
        );
      }

      // Guardar en formato legacy para compatibilidad
      const decisionesPayload = Object.entries(decisiones).map(([idx, dec]) => {
        const primeraFuente = dec.fuentes?.[0] || {};
        const op = primeraFuente.opcion || {};
        const totalAsignado = (dec.fuentes || []).reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);

        return {
          item_idx: Number(idx),
          decision_tipo: op.tipo || "multi_fuente",
          cantidad_aprobada: totalAsignado,
          codigo_material: op.codigo_material || op.codigo_original,
          id_proveedor: op.cuit || op.id_proveedor,
          precio_unitario_final: op.precio_unitario,
          plazo_dias: op.plazo_dias,
          compatibilidad_pct: op.compatibilidad_pct,
          observaciones: dec.comentario || op.observaciones || "",
          opcion_id: op.opcion_id,
          es_multi_fuente: true,
          num_fuentes: dec.fuentes?.length || 0,
        };
      });

      await api.post(`/planificador/solicitudes/${solicitud.id}/guardar-tratamiento`, {
        decisiones: decisionesPayload,
      });

      limpiarDecisionesGuardadas();

      // Avanzar a paso 4 (Acciones)
      setPaso(4);

    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al guardar el tratamiento";
      setError(`${mensaje}. Por favor, intente nuevamente.`);
      console.error("Error completo en handleGuardarYAvanzar:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleGuardar = async () => {
    if (!solicitud?.id) return;

    // Validar que todos los items estén completos
    const { incompletos } = getItemsStatus();
    if (incompletos > 0) {
      setError(`Faltan ${incompletos} ítem(s) por completar.`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await ensureCsrfToken();

      // Guardar cada decisión multi-fuente usando el nuevo endpoint
      for (const [idx, decision] of Object.entries(decisiones)) {
        const itemIdx = Number(idx);
        const cantidadSolicitada = Number(itemsAnalisis[itemIdx]?.cantidad || 0);

        // Transformar fuentes al formato de la API
        const fuentes = (decision.fuentes || []).map((f, orden) => {
          const op = f.opcion || {};
          return {
            tipo_fuente: op.tipo || "stock",
            // Para stock/transferencia
            centro_origen: op.centro_origen || op.centro,
            almacen_origen: op.almacen_origen || op.almacen,
            // Para proveedor
            cuit_proveedor: op.cuit || op.id_proveedor,
            proveedor_nombre: op.nombre,
            // Para equivalencia
            codigo_material_equiv: op.tipo === "equivalencia" ? op.codigo_material : null,
            tipo_equivalencia: op.tipo_equivalencia,
            // Cantidades y precios
            cantidad_asignada: Number(f.cantidad_asignada || 0),
            precio_unitario: op.precio_unitario,
            precio_es_negociado: op.precio_es_negociado || false,
            plazo_dias: op.plazo_dias,
            // Metadata
            score_opcion: op.score_recomendacion,
            orden_prioridad: orden + 1,
            notas: f.notas || op.observaciones || "",
          };
        });

        // Llamar al nuevo endpoint multi-fuente
        await api.post(
          `/planificador/solicitudes/${solicitud.id}/items/${itemIdx}/decision-multifuente`,
          {
            cantidad_solicitada: cantidadSolicitada,
            fuentes,
            comentario: decision.comentario || "",
          }
        );
      }

      // También guardar en formato legacy para compatibilidad
      const decisionesPayload = Object.entries(decisiones).map(([idx, dec]) => {
        // Tomar la primera fuente como decisión principal (legacy)
        const primeraFuente = dec.fuentes?.[0] || {};
        const op = primeraFuente.opcion || {};
        const totalAsignado = (dec.fuentes || []).reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);

        return {
          item_idx: Number(idx),
          decision_tipo: op.tipo || "multi_fuente",
          cantidad_aprobada: totalAsignado,
          codigo_material: op.codigo_material || op.codigo_original,
          id_proveedor: op.cuit || op.id_proveedor,
          precio_unitario_final: op.precio_unitario,
          plazo_dias: op.plazo_dias,
          compatibilidad_pct: op.compatibilidad_pct,
          observaciones: dec.comentario || op.observaciones || "",
          opcion_id: op.opcion_id,
          // Nuevo campo: indica que es multi-fuente
          es_multi_fuente: true,
          num_fuentes: dec.fuentes?.length || 0,
        };
      });

      await api.post(`/planificador/solicitudes/${solicitud.id}/guardar-tratamiento`, {
        decisiones: decisionesPayload,
      });

      limpiarDecisionesGuardadas();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-[98vw] h-[96vh] flex flex-col rounded-xl border border-white/50 overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)',
        }}
      >
        <div className="relative px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-soft)] flex items-center gap-3">
          {/* Título + Info de solicitud */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <h2 className="text-base font-black text-[var(--fg)] whitespace-nowrap">
              #{solicitud.id}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
              <span>{solicitud.centro || "N/D"}/{formatAlmacen(solicitud.almacen_virtual)}</span>
              <span className="text-[var(--border)]">·</span>
              <span>{renderSector(solicitud)}</span>
              <span className="text-[var(--border)]">·</span>
              <span>{renderSolicitante(solicitud)}</span>
              <span className="text-[var(--border)]">·</span>
              <span className="font-bold" style={{ color: getCriticidadConfig(solicitud.criticidad || analisis?.resumen?.criticidad).color }}>
                {solicitud.criticidad || analisis?.resumen?.criticidad || "N/D"}
              </span>
            </div>

            {/* Barra de progreso inline - Solo visible en paso 2+ */}
            {paso >= 2 && totalItems > 0 && (() => {
              const itemsStatus = itemsAnalisis.map((item, idx) => {
                const dec = decisiones[idx];
                if (!dec || !dec.fuentes || dec.fuentes.length === 0) {
                  return { status: "pendiente", asignado: 0, requerido: Number(item?.cantidad || 0) };
                }
                const asignado = dec.fuentes.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
                const requerido = Number(item?.cantidad || 0);
                const status = asignado >= requerido ? "completo" : "parcial";
                return { status, asignado, requerido };
              });
              const completos = itemsStatus.filter(s => s.status === "completo").length;
              const porcentaje = totalItems > 0 ? (completos / totalItems) * 100 : 0;
              const todoCompleto = completos === totalItems;

              return (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold tracking-wide text-[var(--fg-muted)]">
                    Progreso
                  </span>
                  <span className={`text-xs font-bold ${todoCompleto ? "text-[var(--success)]" : "text-[var(--fg)]"}`}>
                    {completos}/{totalItems}
                  </span>
                  <div className="w-20 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${porcentaje}%`,
                        backgroundColor: todoCompleto ? "var(--success)" : "var(--primary)"
                      }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Spacer para empujar el botón cerrar a la derecha */}
          <div className="flex-1" />

          <Button variant="ghost" type="button" onClick={onClose} className="shrink-0 text-xs px-2 py-1">
            ✕
          </Button>
        </div>

        {/* Info del material - Solo visible en Paso 2 */}
        {paso === 2 && itemsAnalisis[currentIdx] && (
          <MaterialInfoBar
            item={itemsAnalisis[currentIdx]}
            solicitud={solicitud}
            mostrarMrp={mostrarMrp}
            setMostrarMrp={setMostrarMrp}
          />
        )}

        {error && (
          <div className="px-6 py-3 bg-[var(--danger-bg)] text-[var(--danger)] border-b border-[var(--danger-border)]">
            {error}
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
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
          ) : paso === 3 ? (
            <Paso3RevisionFinal
              items={itemsAnalisis}
              decisiones={decisiones}
            />
          ) : (
            <Paso4AccionesPendientes
              solicitudId={solicitud.id}
              solicitud={solicitud}
              items={itemsAnalisis}
              decisiones={decisiones}
              acciones={acciones}
              loading={loadingAcciones}
              onEjecutarAcciones={ejecutarAcciones}
            />
          )}
        </div>

        <div className="px-20 py-3 border-t border-[var(--border)] bg-[var(--bg-soft)] flex items-center justify-between shrink-0">
          {/* Boton Anterior */}
          <Button
            type="button"
            onClick={() => setPaso(Math.max(1, paso - 1))}
            disabled={paso === 1 || paso === 4 || saving}
            className="min-w-[120px]"
          >
            Anterior
          </Button>

          {/* Stepper centrado */}
          <div className="flex items-center gap-2">
            {PasoLabels.map((label, idx) => {
              const step = idx + 1;
              const active = paso === step;
              const done = paso > step;
              const canNavigate = (done || active) && step !== 4; // No permitir navegacion manual al paso 4

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => canNavigate && setPaso(step)}
                  disabled={!canNavigate}
                  title={label}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                    canNavigate ? "cursor-pointer hover:bg-[var(--bg-hover)]" : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full grid place-items-center font-bold text-xs transition-all border-2 ${
                      active
                        ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--card)]"
                        : done
                          ? "border-[var(--success)] text-[var(--success)] bg-[var(--card)]"
                          : "border-[var(--border)] text-[var(--fg-muted)] bg-[var(--card)]"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : step}
                  </div>
                  <span className={`text-sm ${active ? "text-[var(--fg)] font-semibold" : done ? "text-[var(--success)]" : "text-[var(--fg-muted)]"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Boton Siguiente / Guardar / Finalizar */}
          {paso === 4 ? (
            <Button
              type="button"
              onClick={handleFinalizar}
              disabled={finalizando || !acciones}
              className="min-w-[120px]"
            >
              {finalizando ? "Finalizando..." : "Finalizar"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={saving || (paso === 2 && loadingOpciones)}
              className="min-w-[120px]"
            >
              {saving ? "Guardando..." : "Siguiente"}
            </Button>
          )}
        </div>
      </div>

      {/* Modal de Rechazo */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/50 p-6 space-y-4"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)',
            }}
          >
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
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/50 p-6 space-y-4"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)',
            }}
          >
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

/**
 * Barra horizontal de Progreso de Decisiones (Multi-fuente)
 * Muestra el avance en la selección de opciones para cada ítem
 * Verifica que la suma de cantidades asignadas cubra la cantidad solicitada
 */
function ProgresoDecisiones({ decisiones, totalItems, items, currentIdx, onSelectItem }) {
  // Calcular estado de cada ítem
  const itemsStatus = items.map((item, idx) => {
    const dec = decisiones[idx];
    if (!dec || !dec.fuentes || dec.fuentes.length === 0) {
      return { status: "pendiente", asignado: 0, requerido: Number(item?.cantidad || 0) };
    }
    const asignado = dec.fuentes.reduce((sum, f) => sum + Number(f.cantidad_asignada || 0), 0);
    const requerido = Number(item?.cantidad || 0);
    const status = asignado >= requerido ? "completo" : "parcial";
    return { status, asignado, requerido };
  });

  const completos = itemsStatus.filter(s => s.status === "completo").length;
  const parciales = itemsStatus.filter(s => s.status === "parcial").length;
  const porcentaje = totalItems > 0 ? (completos / totalItems) * 100 : 0;
  const todoCompleto = completos === totalItems;

  return (
    <div className="px-6 py-2 border-b border-[var(--border)] bg-[var(--bg-soft)] flex items-center gap-4">
      {/* Título + estado */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] uppercase font-bold tracking-[0.1em] text-[var(--fg-muted)]">
          Progreso
        </span>
        <span className={`text-xs font-bold ${todoCompleto ? "text-[var(--success)]" : "text-[var(--fg)]"}`}>
          {completos}/{totalItems}
        </span>
        {parciales > 0 && (
          <span className="text-[10px] text-[var(--warning)]">
            ({parciales} parciales)
          </span>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{
            width: `${porcentaje}%`,
            backgroundColor: todoCompleto ? "var(--success)" : "var(--primary)"
          }}
        />
      </div>

      {/* Indicadores de ítems (si hay pocos) */}
      {totalItems <= 15 && (
        <div className="flex items-center gap-1 shrink-0">
          {items.map((item, idx) => {
            const status = itemsStatus[idx]?.status || "pendiente";
            const isCurrent = idx === currentIdx;

            // Colores por estado
            const statusClasses = {
              completo: "bg-[var(--success)] text-white",
              parcial: "bg-[var(--warning)] text-white",
              pendiente: "bg-[var(--card)] text-[var(--fg-muted)] border border-[var(--border)] hover:border-[var(--primary)]"
            };

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectItem?.(idx)}
                title={`Ítem ${idx + 1}: ${item?.codigo || "N/D"} (${status})`}
                className={`w-5 h-5 rounded text-[9px] font-bold transition-all ${
                  isCurrent ? "ring-1 ring-[var(--primary)]" : ""
                } ${statusClasses[status]}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Barra de información del material - Sticky bajo el header
 */
function MaterialInfoBar({ item, solicitud, mostrarMrp, setMostrarMrp }) {
  const cantidadSolicitada = Number(item?.cantidad || 0);
  const mrpStatus = getMrpStatus(item);

  return (
    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-soft)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Código y descripción */}
        <p className="text-base font-black text-[var(--fg)]">
          {item.codigo} — {item.descripcion || "Sin descripción"}
        </p>

        {/* Info adicional inline */}
        <div className="flex items-center gap-4 text-sm">
          {/* Consumo anual */}
          <div
            className="flex items-center gap-1.5 cursor-help"
            title={`Consumo promedio anual del centro ${solicitud?.centro || "N/D"}`}
          >
            <TrendingUp className="w-4 h-4 text-[var(--info)]" />
            <span className="text-[var(--fg-muted)]">Consumo:</span>
            <span className="font-bold text-[var(--fg)]">
              {item.consumo_promedio_anual != null
                ? `${Math.round(item.consumo_promedio_anual)} un/año`
                : item.consumo_promedio != null
                  ? `${Math.round(Number(item.consumo_promedio) * 12)} un/año`
                  : "N/D"}
            </span>
          </div>

          {/* Separador */}
          <span className="text-[var(--border)]">|</span>

          {/* MRP inline */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-[var(--fg-muted)]">MRP:</span>
            {!mrpStatus.planificado ? (
              <span className="font-bold text-[var(--danger)]">No planificado</span>
            ) : mrpStatus.warn ? (
              <button
                type="button"
                onClick={() => setMostrarMrp?.(!mostrarMrp)}
                className="font-bold text-[var(--danger)] hover:underline"
              >
                ⚠ Bajo punto pedido
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarMrp?.(!mostrarMrp)}
                className="font-bold text-[var(--success)] hover:underline"
              >
                Planificado
              </button>
            )}
          </div>

          {/* Separador */}
          <span className="text-[var(--border)]">|</span>

          {/* Cantidad solicitada */}
          <p className="font-black text-[var(--fg)]">
            CANT. SOLICITADA: {cantidadSolicitada}
          </p>
        </div>
      </div>

      {/* Detalle MRP expandido */}
      {mostrarMrp && mrpStatus.planificado && (
        <div className="mt-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--fg)]">Detalle MRP</p>
            <button type="button" className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={() => setMostrarMrp(false)}>
              Cerrar
            </button>
          </div>
          {mrpStatus.warn && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-300 text-red-800 text-sm font-semibold">
              Alerta: stock actual + pedidos ({mrpStatus.total}) está por debajo del punto de pedido ({mrpStatus.detalle.punto_pedido ?? "N/D"}).
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-2 rounded-lg bg-[var(--bg-soft)]">
              <p className="text-[10px] uppercase font-bold text-[var(--fg-muted)]">Stock seguridad</p>
              <p className="font-bold text-[var(--fg)]">{mrpStatus.detalle.stock_seguridad ?? "N/D"}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-soft)]">
              <p className="text-[10px] uppercase font-bold text-[var(--fg-muted)]">Punto pedido</p>
              <p className="font-bold text-[var(--fg)]">{mrpStatus.detalle.punto_pedido ?? "N/D"}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-soft)]">
              <p className="text-[10px] uppercase font-bold text-[var(--fg-muted)]">Stock actual</p>
              <p className="font-bold text-[var(--fg)]">{mrpStatus.detalle.stock_actual ?? "N/D"}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-soft)]">
              <p className="text-[10px] uppercase font-bold text-[var(--fg-muted)]">Pedidos curso</p>
              <p className="font-bold text-[var(--fg)]">{mrpStatus.detalle.pedidos_en_curso ?? "N/D"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper para obtener estado MRP
 */
function getMrpStatus(item) {
  const detalle = item?.mrp_detalle || item?.mrp || {};
  const planificado =
    isTrueish(item?.mrp_planificado) ||
    isTrueish(detalle.planificado) ||
    isTrueish(detalle.estado) ||
    Object.keys(detalle).length > 0;
  const stockActual = Number(detalle.stock_actual || 0);
  const pedidos = Number(detalle.pedidos_en_curso || 0);
  const punto = Number(detalle.punto_pedido || 0);
  const warn = planificado && punto > 0 && stockActual + pedidos < punto;
  return {
    planificado,
    warn,
    detalle,
    total: stockActual + pedidos,
  };
}

function isTrueish(val) {
  if (val === true) return true;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    return ["si", "sí", "true", "1", "planificado", "yes"].includes(normalized);
  }
  if (typeof val === "number") return val === 1;
  return false;
}
