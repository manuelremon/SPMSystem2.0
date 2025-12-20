import React from "react";
import StatusBadge from "../components/ui/StatusBadge";
import { formatCurrency, formatAlmacen } from "../utils/formatters";
import { withSpmAlignments } from "../utils/tableAlignments";
import { getCriticidadConfig } from "../utils/styleConfig";

/**
 * Componentes y utilidades compartidas entre todos los dashboards
 * Solo se exportan las funciones esenciales utilizadas
 */

// Configuración de columnas de tabla estándar para solicitudes
export function getTableColumns(t) {
  return withSpmAlignments([
    {
      key: "id",
      header: "ID",
      sortAccessor: (row) => Number(row.id) || 0,
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-slate-700">{row.id}</span>
      ),
    },
    {
      key: "solicitante",
      header: t("dash_table_solicitante", "Solicitante"),
      render: (row) => {
        const nombre = [row.solicitante_nombre, row.solicitante_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <span className="text-xs text-slate-600 font-medium">
            {nombre || "-"}
          </span>
        );
      },
    },
    {
      key: "fecha_creacion",
      header: t("dash_table_fecha", "Fecha"),
      sortAccessor: (row) => new Date(row.created_at).getTime() || 0,
      render: (row) => {
        if (!row.created_at) return <span className="text-xs text-slate-400">-</span>;
        const date = new Date(row.created_at);
        return (
          <span className="text-xs text-slate-500 tabular-nums">
            {date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        );
      },
    },
    {
      key: "estado",
      header: t("dash_table_estado", "Estado"),
      render: (row) => {
        const aprobadorNombre = [row.aprobador_nombre, row.aprobador_apellido]
          .filter(Boolean).join(" ").trim() || null;
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim() || null;

        return (
          <StatusBadge
            estado={row.estado || row.status || "Desconocido"}
            tooltipInfo={{
              aprobador: aprobadorNombre,
              planificador: plannerNombre,
              fechaAprobacion: row.updated_at,
              fechaEnvio: row.created_at,
            }}
          />
        );
      },
    },
    {
      key: "criticidad",
      header: "Criticidad",
      render: (row) => {
        const criticidad = row.criticidad || "Normal";
        const config = getCriticidadConfig(criticidad);
        const Icon = config.icon;
        return (
          <div className="inline-flex items-center gap-1">
            {Icon && <Icon className="w-4 h-4" style={{ color: config.color }} />}
            <span className="text-[11px] font-medium" style={{ color: config.color }}>
              {config.label}
            </span>
          </div>
        );
      },
    },
    {
      key: "items",
      header: "Items",
      render: (row) => {
        const items = row.items || [];
        return <span className="font-mono text-xs tabular-nums">{items.length}</span>;
      },
    },
    {
      key: "monto",
      header: "Monto",
      className: "text-right",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums font-medium text-right block">
          {formatCurrency(row.total_monto || 0)}
        </span>
      ),
    },
    {
      key: "sector",
      header: "Sector",
      render: (row) => (
        <span className="text-xs text-slate-500">{row.sector_nombre || row.sector || "-"}</span>
      ),
    },
    {
      key: "centro",
      header: "Centro",
      render: (row) => (
        <span className="text-xs text-slate-500">{row.centro || "-"}</span>
      ),
    },
    {
      key: "almacen",
      header: "Almacén",
      render: (row) => (
        <span className="text-xs text-slate-500">{formatAlmacen(row.almacen_virtual)}</span>
      ),
    },
    {
      key: "planificador",
      header: "Planificador",
      render: (row) => {
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <span className="text-xs text-slate-500">
            {plannerNombre || "-"}
          </span>
        );
      },
    },
  ]);
}
