import React, { useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle, XCircle, Package, Calendar, MessageSquare } from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";

/**
 * Modal para responder consultas de disponibilidad de stock.
 * Permite confirmar/rechazar con cantidad, fecha y comentarios.
 */
export default function ResponderConsultaModal({ consulta, onClose, onSuccess }) {
  const { t } = useI18n();
  const [acepta, setAcepta] = useState(null);
  const [cantidadConfirmada, setCantidadConfirmada] = useState(
    consulta?.cantidad_asignada || 0
  );
  const [fechaDisponibilidad, setFechaDisponibilidad] = useState("");
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!consulta) return null;

  const handleSubmit = async () => {
    if (acepta === null) {
      setError(t("consulta_seleccionar_opcion", "Selecciona una opcion"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post(`/planificador/responder-consulta/${consulta.fuente_id}`, {
        acepta,
        cantidad_confirmada: acepta ? Number(cantidadConfirmada) : 0,
        fecha_disponibilidad: fechaDisponibilidad || null,
        comentario,
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
      materialInfo = data.items?.[0] || null;
    }
  } catch {
    // Ignore parse errors
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t("consulta_responder_titulo", "Responder Consulta de Stock")}
      size="lg"
    >
      <div className="space-y-5">
        {/* Info de la consulta */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
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
              <span className="text-slate-500">{t("consulta_centro_almacen", "Centro/Almacen")}:</span>
              <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                {consulta.centro_origen}/{consulta.almacen_origen}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t("consulta_cantidad_solicitada", "Cantidad Solicitada")}:</span>
              <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                {consulta.cantidad_asignada}
              </span>
            </div>
            {materialInfo && (
              <>
                <div className="col-span-2">
                  <span className="text-slate-500">{t("common_material", "Material")}:</span>
                  <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                    {materialInfo.codigo} - {materialInfo.descripcion}
                  </span>
                </div>
              </>
            )}
            <div className="col-span-2">
              <span className="text-slate-500">{t("consulta_solicitado_por", "Solicitado por")}:</span>
              <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                {consulta.planner_nombre || `Planificador #${consulta.planner_id}`}
              </span>
            </div>
          </div>
        </div>

        {/* Botones Confirmar/Rechazar */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setAcepta(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              acepta === true
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300"
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {t("consulta_confirmar", "Confirmar Disponibilidad")}
          </button>
          <button
            type="button"
            onClick={() => setAcepta(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              acepta === false
                ? "bg-red-600 text-white shadow-lg"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300"
            }`}
          >
            <XCircle className="w-5 h-5" />
            {t("consulta_rechazar", "No Disponible")}
          </button>
        </div>

        {/* Campos adicionales si confirma */}
        {acepta === true && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t("consulta_cantidad_disponible", "Cantidad Disponible")}
              </label>
              <Input
                type="number"
                min="0"
                max={consulta.cantidad_asignada}
                value={cantidadConfirmada}
                onChange={(e) => setCantidadConfirmada(e.target.value)}
              />
              {Number(cantidadConfirmada) < consulta.cantidad_asignada && (
                <p className="mt-1 text-xs text-amber-600">
                  {t("consulta_confirmacion_parcial", "Confirmacion parcial: se confirman menos unidades de las solicitadas")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                {t("consulta_fecha_disponibilidad", "Fecha Disponibilidad")} ({t("common_optional", "opcional")})
              </label>
              <Input
                type="date"
                value={fechaDisponibilidad}
                onChange={(e) => setFechaDisponibilidad(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Comentario - siempre visible */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            <MessageSquare className="w-4 h-4 inline mr-1" />
            {acepta === false
              ? t("consulta_motivo_rechazo", "Motivo del rechazo")
              : t("consulta_comentarios", "Comentarios adicionales")}
          </label>
          <textarea
            className="w-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 border border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900/30 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all duration-200"
            placeholder={
              acepta === false
                ? t("consulta_placeholder_rechazo", "Indica el motivo por el cual no esta disponible...")
                : t("consulta_placeholder_comentario", "Notas adicionales sobre la disponibilidad...")
            }
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
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
            disabled={acepta === null || loading}
          >
            {loading ? t("common_sending", "Enviando...") : t("consulta_enviar_respuesta", "Enviar Respuesta")}
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
    centro_origen: PropTypes.string,
    almacen_origen: PropTypes.string,
    cantidad_asignada: PropTypes.number,
    estado_consulta: PropTypes.string,
    criticidad: PropTypes.string,
    data_json: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    planner_id: PropTypes.string,
    planner_nombre: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
