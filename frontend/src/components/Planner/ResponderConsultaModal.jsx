import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  CheckCircle,
  XCircle,
  Package,
  Calendar,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Send,
} from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";

/**
 * Opciones de respuesta a consulta de stock
 */
const OPCIONES_RESPUESTA = {
  CONFIRMAR_TOTAL: "confirmar_total",
  CONFIRMAR_PARCIAL: "confirmar_parcial",
  CEDER_CON_DEVOLUCION: "ceder_con_devolucion",
  ENVIAR_MENSAJE: "enviar_mensaje",
  NO_DISPONIBLE: "no_disponible",
};

/**
 * Modal para responder consultas de disponibilidad de stock.
 * Permite confirmar total/parcial, ceder con devolucion, negociar o rechazar.
 */
export default function ResponderConsultaModal({ consulta, onClose, onSuccess }) {
  const { t } = useI18n();
  const [opcionSeleccionada, setOpcionSeleccionada] = useState(null);
  const [cantidadConfirmada, setCantidadConfirmada] = useState(
    consulta?.cantidad_asignada || 0
  );
  const [fechaDisponibilidad, setFechaDisponibilidad] = useState("");
  const [fechaDevolucion, setFechaDevolucion] = useState("");
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!consulta) return null;

  const cantidadSolicitada = consulta.cantidad_asignada || 0;

  const handleSubmit = async () => {
    if (!opcionSeleccionada) {
      setError(t("consulta_seleccionar_opcion", "Selecciona una opcion"));
      return;
    }

    // Validaciones segun opcion
    if (opcionSeleccionada === OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL) {
      if (!cantidadConfirmada || Number(cantidadConfirmada) <= 0) {
        setError("Indica la cantidad que puedes ceder");
        return;
      }
      if (Number(cantidadConfirmada) >= cantidadSolicitada) {
        setError("Para cantidad completa, usa 'Confirmar Total'");
        return;
      }
    }

    if (opcionSeleccionada === OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION) {
      if (!fechaDevolucion) {
        setError("Indica la fecha esperada de devolucion");
        return;
      }
    }

    if (opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE) {
      if (!comentario.trim()) {
        setError("Escribe el mensaje que deseas enviar");
        return;
      }
    }

    if (opcionSeleccionada === OPCIONES_RESPUESTA.NO_DISPONIBLE) {
      if (!comentario.trim()) {
        setError("Indica el motivo por el cual no esta disponible");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      // Determinar valores segun opcion
      let acepta = true;
      let cantidad = cantidadSolicitada;
      let notas = comentario;

      switch (opcionSeleccionada) {
        case OPCIONES_RESPUESTA.CONFIRMAR_TOTAL:
          acepta = true;
          cantidad = cantidadSolicitada;
          break;
        case OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL:
          acepta = true;
          cantidad = Number(cantidadConfirmada);
          break;
        case OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION:
          acepta = true;
          cantidad = Number(cantidadConfirmada) || cantidadSolicitada;
          notas = `[DEVOLUCION REQUERIDA para ${fechaDevolucion}] ${comentario}`.trim();
          break;
        case OPCIONES_RESPUESTA.ENVIAR_MENSAJE:
          // Enviar mensaje sin confirmar/rechazar
          const msgRes = await api.post("/mensajes/enviar", {
            destinatario_id: consulta.planner_id,
            asunto: `Consulta Stock Solicitud #${consulta.solicitud_id}`,
            contenido: comentario,
            solicitud_id: consulta.solicitud_id,
          });
          if (msgRes.data?.ok) {
            onSuccess?.();
          } else {
            setError(msgRes.data?.error || "Error al enviar mensaje");
          }
          setLoading(false);
          return;
        case OPCIONES_RESPUESTA.NO_DISPONIBLE:
          acepta = false;
          cantidad = 0;
          break;
        default:
          break;
      }

      const res = await api.post(`/planificador/responder-consulta/${consulta.fuente_id}`, {
        acepta,
        cantidad_confirmada: cantidad,
        fecha_disponibilidad: fechaDisponibilidad || null,
        comentario: notas,
      });

      if (res.data?.ok) {
        onSuccess?.();
      } else {
        setError(res.data?.error || "Error al enviar respuesta");
      }
    } catch (err) {
      console.error("Error respondiendo consulta:", err);
      setError(err.response?.data?.error || "Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  // Parse material info from data_json if available
  let materialInfo = null;
  try {
    if (consulta.data_json) {
      const data = typeof consulta.data_json === "string"
        ? JSON.parse(consulta.data_json)
        : consulta.data_json;
      materialInfo = data.items?.[consulta.item_index || 0] || data.items?.[0] || null;
    }
  } catch {
    // Ignore parse errors
  }

  // Configuracion de opciones
  const opciones = [
    {
      id: OPCIONES_RESPUESTA.CONFIRMAR_TOTAL,
      icon: CheckCircle,
      label: "Confirmar Total",
      desc: `Cedo las ${cantidadSolicitada} unidades solicitadas`,
      color: "emerald",
    },
    {
      id: OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL,
      icon: AlertCircle,
      label: "Confirmar Parcial",
      desc: "Puedo ceder una cantidad menor",
      color: "amber",
    },
    {
      id: OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION,
      icon: RefreshCw,
      label: "Ceder con Devolucion",
      desc: "Cedo temporalmente, requiero devolucion",
      color: "blue",
    },
    {
      id: OPCIONES_RESPUESTA.ENVIAR_MENSAJE,
      icon: MessageSquare,
      label: "Enviar Mensaje",
      desc: "Negociar o consultar antes de decidir",
      color: "purple",
    },
    {
      id: OPCIONES_RESPUESTA.NO_DISPONIBLE,
      icon: XCircle,
      label: "No Disponible",
      desc: "No puedo ceder el material",
      color: "red",
    },
  ];

  const getColorClasses = (color, isSelected) => {
    const colors = {
      emerald: isSelected
        ? "bg-emerald-600 text-white border-emerald-600"
        : "border-[var(--border)] hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
      amber: isSelected
        ? "bg-amber-600 text-white border-amber-600"
        : "border-[var(--border)] hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20",
      blue: isSelected
        ? "bg-blue-600 text-white border-blue-600"
        : "border-[var(--border)] hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
      purple: isSelected
        ? "bg-purple-600 text-white border-purple-600"
        : "border-[var(--border)] hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20",
      red: isSelected
        ? "bg-red-600 text-white border-red-600"
        : "border-[var(--border)] hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
    };
    return colors[color] || colors.emerald;
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t("consulta_responder_titulo", "Responder Consulta de Stock")}
      size="lg"
    >
      <div className="space-y-5">
        {/* Info de la consulta */}
        <div className="bg-[var(--bg-soft)] p-4 rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-[var(--primary)]" />
            <span className="font-semibold text-[var(--fg)]">
              {t("consulta_solicitud", "Solicitud")} #{consulta.solicitud_id}
            </span>
            {consulta.criticidad && (
              <Badge variant={consulta.criticidad === "alta" ? "danger" : "secondary"}>
                {consulta.criticidad}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[var(--fg-muted)]">Centro/Almacen:</span>
              <span className="ml-2 font-medium text-[var(--fg)]">
                {consulta.centro_origen}/{consulta.almacen_origen}
              </span>
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">Cantidad Solicitada:</span>
              <span className="ml-2 font-medium text-[var(--fg)]">
                {cantidadSolicitada} uds
              </span>
            </div>
            {(consulta.material_id || materialInfo) && (
              <div className="col-span-2">
                <span className="text-[var(--fg-muted)]">Material:</span>
                <span className="ml-2 font-medium text-[var(--fg)]">
                  {consulta.material_id || materialInfo?.codigo} - {consulta.material_descripcion || materialInfo?.descripcion}
                </span>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-[var(--fg-muted)]">Solicitado por:</span>
              <span className="ml-2 font-medium text-[var(--fg)]">
                {consulta.planner_nombre || `Planificador #${consulta.planner_id}`}
              </span>
            </div>
          </div>
        </div>

        {/* Opciones de respuesta */}
        <div>
          <label className="block text-sm font-medium text-[var(--fg)] mb-3">
            Selecciona tu respuesta:
          </label>
          <div className="grid grid-cols-1 gap-2">
            {opciones.map((opcion) => {
              const Icon = opcion.icon;
              const isSelected = opcionSeleccionada === opcion.id;
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => {
                    setOpcionSeleccionada(opcion.id);
                    setError("");
                    // Reset cantidad al cambiar opcion
                    if (opcion.id === OPCIONES_RESPUESTA.CONFIRMAR_TOTAL) {
                      setCantidadConfirmada(cantidadSolicitada);
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${getColorClasses(opcion.color, isSelected)}`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? "" : `text-${opcion.color}-600`}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${isSelected ? "" : "text-[var(--fg)]"}`}>
                      {opcion.label}
                    </div>
                    <div className={`text-xs ${isSelected ? "opacity-80" : "text-[var(--fg-muted)]"}`}>
                      {opcion.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Campos adicionales segun opcion */}
        {opcionSeleccionada === OPCIONES_RESPUESTA.CONFIRMAR_PARCIAL && (
          <div className="space-y-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <div>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                Cantidad que puedo ceder *
              </label>
              <Input
                type="number"
                min="1"
                max={cantidadSolicitada - 1}
                value={cantidadConfirmada}
                onChange={(e) => setCantidadConfirmada(e.target.value)}
                placeholder={`Maximo ${cantidadSolicitada - 1}`}
              />
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Se solicitaron {cantidadSolicitada} unidades
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha disponibilidad (opcional)
              </label>
              <Input
                type="date"
                value={fechaDisponibilidad}
                onChange={(e) => setFechaDisponibilidad(e.target.value)}
              />
            </div>
          </div>
        )}

        {opcionSeleccionada === OPCIONES_RESPUESTA.CEDER_CON_DEVOLUCION && (
          <div className="space-y-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <div>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                Cantidad a ceder temporalmente
              </label>
              <Input
                type="number"
                min="1"
                max={cantidadSolicitada}
                value={cantidadConfirmada}
                onChange={(e) => setCantidadConfirmada(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha esperada de devolucion *
              </label>
              <Input
                type="date"
                value={fechaDevolucion}
                onChange={(e) => setFechaDevolucion(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              El solicitante sera notificado del compromiso de devolucion
            </p>
          </div>
        )}

        {opcionSeleccionada === OPCIONES_RESPUESTA.CONFIRMAR_TOTAL && (
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
            <div>
              <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha disponibilidad (opcional)
              </label>
              <Input
                type="date"
                value={fechaDisponibilidad}
                onChange={(e) => setFechaDisponibilidad(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Indica cuando estara listo para ser retirado/transferido
              </p>
            </div>
          </div>
        )}

        {/* Comentario/Mensaje */}
        {opcionSeleccionada && (
          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              {opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE
                ? "Mensaje para el planificador *"
                : opcionSeleccionada === OPCIONES_RESPUESTA.NO_DISPONIBLE
                  ? "Motivo del rechazo *"
                  : "Notas adicionales (opcional)"}
            </label>
            <textarea
              className="w-full bg-[var(--card)] rounded-xl px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] border border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none transition-all duration-200 resize-none"
              placeholder={
                opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE
                  ? "Escribe tu consulta o propuesta..."
                  : opcionSeleccionada === OPCIONES_RESPUESTA.NO_DISPONIBLE
                    ? "Indica el motivo (material comprometido, stock critico, etc.)..."
                    : "Notas adicionales sobre la disponibilidad..."
              }
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Submit button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t("common_cancel", "Cancelar")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!opcionSeleccionada || loading}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : opcionSeleccionada === OPCIONES_RESPUESTA.ENVIAR_MENSAJE ? (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensaje
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar Respuesta
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

ResponderConsultaModal.propTypes = {
  consulta: PropTypes.shape({
    fuente_id: PropTypes.number.isRequired,
    decision_id: PropTypes.number,
    solicitud_id: PropTypes.number.isRequired,
    item_index: PropTypes.number,
    centro_origen: PropTypes.string,
    almacen_origen: PropTypes.string,
    cantidad_asignada: PropTypes.number,
    estado_consulta: PropTypes.string,
    criticidad: PropTypes.string,
    data_json: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    planner_id: PropTypes.string,
    planner_nombre: PropTypes.string,
    material_id: PropTypes.string,
    material_descripcion: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
