import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "../components/ui/Card";
import { ModernDataTable as DataTable } from "../components/features/DataTable";
import { TableSkeleton } from "../components/ui/Skeleton";
import { solicitudes } from "../services/spm";
import { CheckCircle, Plus, ArrowLeft } from "../components/ui/Icons";
import { useI18n } from "../context/i18n";
import { useAuthStore } from "../store/authStore";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { getTableColumns } from "./DashboardShared";
import { Button } from "../components/ui/Button";
import clsx from "clsx";

export default function TodasLasSolicitudes() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  // Obtener tab inicial de la URL
  const initialTab = searchParams.get("tab") || "todas";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [stats, setStats] = useState({
    todas: 0,
    pendientes: 0,
    en_proceso: 0,
    completadas: 0,
    rechazadas: 0,
  });
  const [allData, setAllData] = useState({
    todas: [],
    pendientes: [],
    en_proceso: [],
    completadas: [],
    rechazadas: [],
  });
  const [loading, setLoading] = useState(true);

  // Fetch solicitudes
  useEffect(() => {
    setLoading(true);

    const pendientesCall = solicitudes.listar({ estado: "Enviada", page_size: 500 }).catch(() => null);
    const enProcesoCall = solicitudes.listar({ estado: "En Progreso", page_size: 500 }).catch(() => null);
    const completadasCall = solicitudes.listar({ estado: "Aprobada", page_size: 500 }).catch(() => null);
    const rechazadasCall = solicitudes.listar({ estado: "Rechazada", page_size: 500 }).catch(() => null);

    Promise.all([pendientesCall, enProcesoCall, completadasCall, rechazadasCall])
      .then(([pendientesRes, enProcesoRes, completadasRes, rechazadasRes]) => {
        const pendientesLista = pendientesRes?.data?.solicitudes || pendientesRes?.data?.items || [];
        const enProcesoLista = enProcesoRes?.data?.solicitudes || enProcesoRes?.data?.items || [];
        const completadasLista = completadasRes?.data?.solicitudes || completadasRes?.data?.items || [];
        const rechazadasLista = rechazadasRes?.data?.solicitudes || rechazadasRes?.data?.items || [];

        // Combinar todas las solicitudes y ordenar por fecha descendente
        const todasLista = [...pendientesLista, ...enProcesoLista, ...completadasLista, ...rechazadasLista]
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0) - new Date(a.fecha_creacion || a.created_at || 0));

        setStats({
          todas: todasLista.length,
          pendientes: pendientesLista.length,
          en_proceso: enProcesoLista.length,
          completadas: completadasLista.length,
          rechazadas: rechazadasLista.length,
        });

        setAllData({
          todas: todasLista,
          pendientes: pendientesLista,
          en_proceso: enProcesoLista,
          completadas: completadasLista,
          rechazadas: rechazadasLista,
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  const columns = useMemo(() => getTableColumns(t), [t]);

  const tabs = [
    { key: "todas", label: t("dash_todas", "Todas"), count: stats.todas },
    { key: "pendientes", label: t("dash_pendientes", "Pendientes"), count: stats.pendientes },
    { key: "en_proceso", label: t("dash_en_proceso", "En Proceso"), count: stats.en_proceso },
    { key: "completadas", label: t("dash_completadas", "Completadas"), count: stats.completadas },
    { key: "rechazadas", label: t("dash_rechazadas", "Rechazadas"), count: stats.rechazadas },
  ];

  const currentData = allData[activeTab] || [];

  const getTableTitle = () => {
    switch (activeTab) {
      case "todas":
        return t("dash_all_requests", "Todas las Solicitudes");
      case "pendientes":
        return t("dash_pending_review", "Solicitudes Pendientes de Revision");
      case "en_proceso":
        return t("dash_in_progress", "Solicitudes En Proceso");
      case "completadas":
        return t("dash_completed", "Solicitudes Completadas");
      case "rechazadas":
        return t("dash_rejected", "Solicitudes Rechazadas");
      default:
        return t("dash_solicitudes", "Solicitudes");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800 uppercase">Todas las Solicitudes</h1>
        </div>

        <Button as={Link} to="/solicitudes/nueva">
          <Plus className="w-4 h-4" />
          {t("dash_new_request", "Nueva Solicitud")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === tab.key
                ? "bg-white shadow-sm text-blue-600"
                : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
            )}
          >
            <span>{tab.label}</span>
            <span
              className={clsx(
                "px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums",
                activeTab === tab.key
                  ? "bg-blue-100 text-blue-600"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">
              {getTableTitle()}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {currentData.length} {t("dash_items", "items")}
            </span>
          </div>

          <div className="p-4">
            {loading ? (
              <TableSkeleton rows={10} columns={7} />
            ) : currentData.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4 opacity-60" />
                <p className="text-slate-500 text-sm">
                  {activeTab === "pendientes"
                    ? t("dash_no_pending", "No hay solicitudes pendientes de revision")
                    : t("dash_no_requests_category", "No hay solicitudes en esta categoria")}
                </p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                rows={currentData}
                emptyMessage={t("dash_no_requests", "No hay solicitudes")}
                onRowClick={(row) => navigate(`/solicitudes/${row.id}`)}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
