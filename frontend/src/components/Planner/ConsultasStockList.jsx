import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Package,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  MessageSquare,
} from "../ui/Icons";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useI18n } from "../../context/i18n";
import api from "../../services/api";
import ResponderConsultaModal from "./ResponderConsultaModal";

/**
 * Lista de consultas de stock pendientes para el usuario actual.
 * Muestra consultas donde el usuario es responsable o referente del almacen.
 */
export default function ConsultasStockList({ onRespond }) {
  const { t } = useI18n();
  const [consultas, setConsultas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadConsultas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/planificador/mis-consultas-pendientes");
      if (res.data?.ok) {
        setConsultas(res.data.data || []);
      } else {
        setError(res.data?.error || "Error al cargar consultas");
      }
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConsultas();
  }, [loadConsultas]);

  const handleResponder = (consulta) => {
    setSelectedConsulta(consulta);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedConsulta(null);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setSelectedConsulta(null);
    loadConsultas();
    onRespond?.();
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("time_now", "Ahora");
    if (diffMins < 60) return `${t("time_ago", "Hace")} ${diffMins} min`;
    if (diffHours < 24) return `${t("time_ago", "Hace")} ${diffHours}h`;
    if (diffDays < 7) return `${t("time_ago", "Hace")} ${diffDays}d`;
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  const getCriticidadBadge = (criticidad) => {
    const variants = {
      alta: "danger",
      media: "warning",
      baja: "secondary",
    };
    return variants[criticidad] || "secondary";
  };

  // Parse material from data_json
  const getMaterialInfo = (consulta) => {
    try {
      if (consulta.data_json) {
        const data = typeof consulta.data_json === "string"
          ? JSON.parse(consulta.data_json)
          : consulta.data_json;
        const item = data.items?.[0];
        if (item) {
          return {
            codigo: item.codigo || item.material_codigo,
            descripcion: item.descripcion || item.material_descripcion,
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-500">{t("common_loading", "Cargando...")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadConsultas}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t("common_retry", "Reintentar")}
        </Button>
      </div>
    );
  }

  if (consultas.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          {t("consulta_sin_pendientes", "No tienes consultas pendientes")}
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
          {t("consulta_sin_pendientes_desc", "Las nuevas consultas apareceran aqui")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header con contador */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {consultas.length} {t("consulta_pendientes_count", "consultas pendientes")}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadConsultas}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Lista de consultas */}
      {consultas.map((consulta) => {
        const materialInfo = getMaterialInfo(consulta);

        return (
          <div
            key={consulta.fuente_id}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Info principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {t("consulta_solicitud", "Solicitud")} #{consulta.solicitud_id}
                  </span>
                  {consulta.criticidad && (
                    <Badge variant={getCriticidadBadge(consulta.criticidad)}>
                      {consulta.criticidad}
                    </Badge>
                  )}
                </div>

                {/* Material info */}
                {materialInfo && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 truncate">
                    {materialInfo.codigo} - {materialInfo.descripcion}
                  </p>
                )}

                {/* Detalles */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {consulta.cantidad_asignada} uds
                  </span>
                  <span>
                    {consulta.centro_origen}/{consulta.almacen_origen}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTimeAgo(consulta.created_at)}
                  </span>
                </div>

                {/* Planificador */}
                <p className="text-xs text-slate-400 mt-2">
                  {t("consulta_de", "De")}: {consulta.planner_nombre || `Planificador #${consulta.planner_id}`}
                </p>
              </div>

              {/* Boton responder */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleResponder(consulta)}
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                {t("consulta_responder", "Responder")}
              </Button>
            </div>
          </div>
        );
      })}

      {/* Modal de respuesta */}
      {modalOpen && selectedConsulta && (
        <ResponderConsultaModal
          consulta={selectedConsulta}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

ConsultasStockList.propTypes = {
  onRespond: PropTypes.func,
};
