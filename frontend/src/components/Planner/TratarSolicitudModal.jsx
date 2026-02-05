import React, { useEffect, useMemo, useState } from "react";
import Paso1AnalisisInicial from "./Paso1AnalisisInicial";
import Paso2DecisionAbastecimiento from "./Paso2DecisionAbastecimiento";
import Paso3RevisionFinal from "./Paso3RevisionFinal";
import Paso4AccionesPendientes from "./Paso4AccionesPendientes";
import api from "../../services/api";
import { ensureCsrfToken } from "../../services/csrf";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import StatusBadge from "../ui/StatusBadge";
import { renderSector as renderSectorUtil } from "../../constants/sectores";
import { formatAlmacen } from "../../utils/formatters";
import { getCriticidadConfig } from "../../utils/styleConfig";

// MUI Components
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import StepConnector, { stepConnectorClasses } from "@mui/material/StepConnector";
import { styled } from "@mui/material/styles";

// MUI Icons
import AnalyticsIcon from "@mui/icons-material/Analytics";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import LayersIcon from "@mui/icons-material/Layers";

// Connector personalizado
const CustomConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.primary.main,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundColor: theme.palette.success.main,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.grey[300],
    borderRadius: 1,
  },
}));

// Icono personalizado para cada paso
const CustomStepIconRoot = styled("div")(({ theme, ownerState }) => ({
  backgroundColor: ownerState.completed
    ? theme.palette.success.main
    : ownerState.active
    ? theme.palette.primary.main
    : theme.palette.grey[300],
  zIndex: 1,
  color: "#fff",
  width: 44,
  height: 44,
  display: "flex",
  borderRadius: "50%",
  justifyContent: "center",
  alignItems: "center",
  boxShadow: ownerState.active ? `0 4px 10px 0 ${theme.palette.primary.main}35` : "none",
  transition: "all 0.3s ease",
}));

function CustomStepIcon(props) {
  const { active, completed, className, icon } = props;

  const icons = {
    1: <AnalyticsIcon />,
    2: <AssignmentIcon />,
    3: <FactCheckIcon />,
    4: <PlaylistAddCheckIcon />,
  };

  return (
    <CustomStepIconRoot ownerState={{ completed, active }} className={className}>
      {completed ? <CheckCircleIcon /> : icons[String(icon)]}
    </CustomStepIconRoot>
  );
}

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
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <Paper
        elevation={24}
        sx={{
          width: '98vw',
          height: '96vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            position: 'relative',
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {/* Título + Info de solicitud */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flexShrink: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
              #{solicitud.id}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
              <Typography variant="caption">{solicitud.centro || "N/D"}/{formatAlmacen(solicitud.almacen_virtual)}</Typography>
              <Typography variant="caption" sx={{ color: 'divider' }}>·</Typography>
              <Typography variant="caption">{renderSector(solicitud)}</Typography>
              <Typography variant="caption" sx={{ color: 'divider' }}>·</Typography>
              <Typography variant="caption">{renderSolicitante(solicitud)}</Typography>
              <Typography variant="caption" sx={{ color: 'divider' }}>·</Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: getCriticidadConfig(solicitud.criticidad || analisis?.resumen?.criticidad).color }}
              >
                {solicitud.criticidad || analisis?.resumen?.criticidad || "N/D"}
              </Typography>
            </Box>

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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, pl: 1, borderLeft: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary' }}>
                    Progreso
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: todoCompleto ? 'success.main' : 'text.primary' }}
                  >
                    {completos}/{totalItems}
                  </Typography>
                  <Box sx={{ width: 80, height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        transition: 'all 0.3s',
                        borderRadius: 3,
                        width: `${porcentaje}%`,
                        bgcolor: todoCompleto ? 'success.main' : 'primary.main',
                      }}
                    />
                  </Box>
                </Box>
              );
            })()}
          </Box>

          {/* Spacer para empujar el botón cerrar a la derecha */}
          <Box sx={{ flex: 1 }} />

          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

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
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ p: 3, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {loading && paso === 1 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Cargando analisis...</Typography>
            </Paper>
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
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 10,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {/* Boton Anterior */}
          <Button
            type="button"
            onClick={() => setPaso(Math.max(1, paso - 1))}
            disabled={paso === 1 || paso === 4 || saving}
            style={{ minWidth: 120 }}
          >
            Anterior
          </Button>

          {/* Stepper MUI centrado */}
          <Stepper
            activeStep={paso - 1}
            connector={<CustomConnector />}
            sx={{ minWidth: 500 }}
          >
            {PasoLabels.map((label, idx) => {
              const step = idx + 1;
              const canNavigate = (paso > step || paso === step) && step !== 4;

              return (
                <Step
                  key={label}
                  completed={paso > step}
                  sx={{ cursor: canNavigate ? "pointer" : "default" }}
                  onClick={() => canNavigate && setPaso(step)}
                >
                  <StepLabel
                    StepIconComponent={CustomStepIcon}
                    sx={{
                      "& .MuiStepLabel-label": {
                        fontWeight: paso === step ? 600 : 400,
                        color: paso === step ? "primary.main" : paso > step ? "success.main" : "grey.500",
                        fontSize: "0.875rem",
                      },
                    }}
                  >
                    {label}
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {/* Boton Siguiente / Guardar / Finalizar */}
          {paso === 4 ? (
            <Button
              type="button"
              onClick={handleFinalizar}
              disabled={finalizando || !acciones}
              style={{ minWidth: 120 }}
            >
              {finalizando ? "Finalizando..." : "Finalizar"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={saving || (paso === 2 && loadingOpciones)}
              style={{ minWidth: 120 }}
            >
              {saving ? "Guardando..." : "Siguiente"}
            </Button>
          )}
        </Box>
      </Paper>

      {/* Modal de Rechazo */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason("");
        }}
        title={`Rechazar Solicitud #${solicitud?.id}`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
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
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Motivo del rechazo
          </Typography>
          <TextField
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            rows={4}
            fullWidth
            placeholder="Explique por qué se rechaza esta solicitud..."
            size="small"
          />
        </Box>
      </Modal>

      {/* Modal de Solicitud de Información */}
      <Modal
        isOpen={showRequestInfoModal}
        onClose={() => {
          setShowRequestInfoModal(false);
          setInfoRequest("");
        }}
        title={`Solicitar Información - #${solicitud?.id}`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
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
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            ¿Qué información necesita del solicitante?
          </Typography>
          <TextField
            value={infoRequest}
            onChange={(e) => setInfoRequest(e.target.value)}
            multiline
            rows={4}
            fullWidth
            placeholder="Especifique qué información adicional requiere..."
            size="small"
          />
        </Box>
      </Modal>
    </Box>
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
    <Box
      sx={{
        px: 3,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {/* Título + estado */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Typography
          variant="caption"
          sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary' }}
        >
          Progreso
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: todoCompleto ? 'success.main' : 'text.primary' }}
        >
          {completos}/{totalItems}
        </Typography>
        {parciales > 0 && (
          <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'warning.main' }}>
            ({parciales} parciales)
          </Typography>
        )}
      </Box>

      {/* Barra de progreso */}
      <Box sx={{ flex: 1, height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            transition: 'all 0.3s',
            borderRadius: 3,
            width: `${porcentaje}%`,
            bgcolor: todoCompleto ? 'success.main' : 'primary.main',
          }}
        />
      </Box>

      {/* Indicadores de ítems (si hay pocos) */}
      {totalItems <= 15 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {items.map((item, idx) => {
            const status = itemsStatus[idx]?.status || "pendiente";
            const isCurrent = idx === currentIdx;

            // Colores por estado
            const statusStyles = {
              completo: { bgcolor: 'success.main', color: 'white' },
              parcial: { bgcolor: 'warning.main', color: 'white' },
              pendiente: { bgcolor: 'background.paper', color: 'text.secondary', border: 1, borderColor: 'divider', '&:hover': { borderColor: 'primary.main' } }
            };

            return (
              <Box
                key={idx}
                component="button"
                type="button"
                onClick={() => onSelectItem?.(idx)}
                title={`Ítem ${idx + 1}: ${item?.codigo || "N/D"} (${status})`}
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 1,
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: isCurrent ? '1px solid' : 'none',
                  outlineColor: 'primary.main',
                  ...statusStyles[status],
                }}
              >
                {idx + 1}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/**
 * Barra de información del material - Sticky bajo el header
 */
function MaterialInfoBar({ item, solicitud, mostrarMrp, setMostrarMrp }) {
  const cantidadSolicitada = Number(item?.cantidad || 0);
  const mrpStatus = getMrpStatus(item);

  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        {/* Código y descripción */}
        <Typography variant="body1" sx={{ fontWeight: 900 }}>
          {item.codigo} — {item.descripcion || "Sin descripción"}
        </Typography>

        {/* Info adicional inline */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.875rem' }}>
          {/* Consumo anual */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'help' }}
            title={`Consumo promedio anual del centro ${solicitud?.centro || "N/D"}`}
          >
            <TrendingUpIcon sx={{ width: 16, height: 16, color: 'info.main' }} />
            <Typography variant="caption" color="text.secondary">Consumo:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {item.consumo_promedio_anual != null
                ? `${Math.round(item.consumo_promedio_anual)} un/año`
                : item.consumo_promedio != null
                  ? `${Math.round(Number(item.consumo_promedio) * 12)} un/año`
                  : "N/D"}
            </Typography>
          </Box>

          {/* Separador */}
          <Typography variant="caption" sx={{ color: 'divider' }}>|</Typography>

          {/* MRP inline */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LayersIcon sx={{ width: 16, height: 16, color: 'secondary.main' }} />
            <Typography variant="caption" color="text.secondary">MRP:</Typography>
            {!mrpStatus.planificado ? (
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'error.main' }}>No planificado</Typography>
            ) : mrpStatus.warn ? (
              <Typography
                component="button"
                variant="caption"
                onClick={() => setMostrarMrp?.(!mostrarMrp)}
                sx={{ fontWeight: 700, color: 'error.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, background: 'none', border: 'none', p: 0 }}
              >
                ⚠ Bajo punto pedido
              </Typography>
            ) : (
              <Typography
                component="button"
                variant="caption"
                onClick={() => setMostrarMrp?.(!mostrarMrp)}
                sx={{ fontWeight: 700, color: 'success.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, background: 'none', border: 'none', p: 0 }}
              >
                Planificado
              </Typography>
            )}
          </Box>

          {/* Separador */}
          <Typography variant="caption" sx={{ color: 'divider' }}>|</Typography>

          {/* Cantidad solicitada */}
          <Typography variant="body2" sx={{ fontWeight: 900 }}>
            CANT. SOLICITADA: {cantidadSolicitada}
          </Typography>
        </Box>
      </Box>

      {/* Detalle MRP expandido */}
      {mostrarMrp && mrpStatus.planificado && (
        <Paper variant="outlined" sx={{ mt: 1.5, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Detalle MRP</Typography>
            <Typography
              component="button"
              variant="caption"
              color="text.secondary"
              onClick={() => setMostrarMrp(false)}
              sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' }, background: 'none', border: 'none', p: 0 }}
            >
              Cerrar
            </Typography>
          </Box>
          {mrpStatus.warn && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              Alerta: stock actual + pedidos ({mrpStatus.total}) está por debajo del punto de pedido ({mrpStatus.detalle.punto_pedido ?? "N/D"}).
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', fontSize: '0.625rem' }}>
                Stock seguridad
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{mrpStatus.detalle.stock_seguridad ?? "N/D"}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', fontSize: '0.625rem' }}>
                Punto pedido
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{mrpStatus.detalle.punto_pedido ?? "N/D"}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', fontSize: '0.625rem' }}>
                Stock actual
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{mrpStatus.detalle.stock_actual ?? "N/D"}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary', fontSize: '0.625rem' }}>
                Pedidos curso
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{mrpStatus.detalle.pedidos_en_curso ?? "N/D"}</Typography>
            </Paper>
          </Box>
        </Paper>
      )}
    </Box>
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
