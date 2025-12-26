import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Package,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  FileText,
} from "../components/ui/Icons";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { useAuthStore } from "../store/authStore";
import { useI18n } from "../context/i18n";
import api from "../services/api";
import ConsultasStockList from "../components/Planner/ConsultasStockList";
import NotificacionesInline from "../components/Centro/NotificacionesInline";
import MensajesInline from "../components/Centro/MensajesInline";
import TimelineDetailModal from "../components/Centro/TimelineDetailModal";

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

// Iconos para el timeline
const timelineIcons = {
  notificacion: Bell,
  mensaje: MessageSquare,
  stock_consulta: Package,
  solicitud_approved: CheckCircle,
  solicitud_rejected: XCircle,
  solicitud_planned: Clock,
  warning: AlertCircle,
  info: FileText,
};

export default function CentroInteraccion() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("notificaciones");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTimelineItem, setSelectedTimelineItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notificaciones/centro-interaccion");
      if (res.data?.ok) {
        setData(res.data.data);
      } else {
        setError("Error al cargar datos");
      }
    } catch (err) {
      console.error("Error loading centro-interaccion:", err);
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tabs = [
    {
      id: "notificaciones",
      label: t("centro_notificaciones", "Notificaciones"),
      icon: Bell,
      count: data?.notificaciones_count || 0,
    },
    {
      id: "consultas",
      label: t("centro_consultas", "Consultas Stock"),
      icon: Package,
      count: data?.consultas_count || 0,
    },
    {
      id: "mensajes",
      label: t("centro_mensajes", "Mensajes"),
      icon: MessageSquare,
      count: data?.mensajes_count || 0,
    },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    // Todo se muestra inline, no navegamos
  };

  const getTimelineIcon = (item) => {
    const subtipo = item.subtipo || item.tipo;
    const IconComponent = timelineIcons[subtipo] || timelineIcons[item.tipo] || FileText;
    return IconComponent;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={t("centro_titulo", "Centro de Interaccion")}
        subtitle={t("centro_subtitulo", "Gestiona tus notificaciones, consultas y mensajes")}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("common_refresh", "Actualizar")}
          </Button>
        }
      />

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabs con contadores */}
      <div className="flex items-center gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30 w-fit">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <Badge
                  variant={isActive ? "primary" : "danger"}
                  className="ml-1 text-xs"
                >
                  {tab.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido segun tab */}
      <div className="min-h-[300px]">
        {activeTab === "consultas" && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4">
                {t("consulta_pendientes", "Consultas de Stock Pendientes")}
              </h3>
              <ConsultasStockList onRespond={loadData} />
            </CardContent>
          </Card>
        )}
        {activeTab === "notificaciones" && (
          <NotificacionesInline onUpdate={loadData} />
        )}
        {activeTab === "mensajes" && (
          <MensajesInline onUpdate={loadData} />
        )}
      </div>

      {/* Timeline de actividad */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-4">
            {t("centro_timeline", "Timeline de Actividad")}
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : data?.timeline?.length > 0 ? (
            <div className="space-y-3">
              {data.timeline.map((item, idx) => {
                const IconComponent = getTimelineIcon(item);
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedTimelineItem(item)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50
                               cursor-pointer transition-colors border border-transparent
                               hover:border-gray-200 hover:shadow-sm"
                  >
                    <div className="p-2 bg-gray-100 rounded-full">
                      <IconComponent className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">
                        {item.descripcion}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(item.created_at)}
                        {item.solicitud_id && (
                          <span className="ml-2 text-blue-600">
                            #{item.solicitud_id}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t("centro_sin_actividad", "No hay actividad reciente")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle del timeline */}
      {selectedTimelineItem && (
        <TimelineDetailModal
          item={selectedTimelineItem}
          onClose={() => setSelectedTimelineItem(null)}
        />
      )}
    </div>
  );
}
