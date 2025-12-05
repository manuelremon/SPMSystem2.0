import React from "react";
import { Clock, MessageSquare, ArrowRight, TrendingUp, Newspaper } from "lucide-react";

// === SHARED HELPER COMPONENTS ===

export function MessageItem({ msg, onClick }) {
  const isUnread = msg.leido === 0;
  const senderName = `${msg.remitente_nombre || ""} ${msg.remitente_apellido || ""}`.trim() || "Usuario";

  return (
    <button
      type="button"
      className={`
        w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer
        ${isUnread
          ? "bg-[var(--primary-muted)]/20 border-[var(--primary)]/30 hover:border-[var(--primary)]/50"
          : "bg-[var(--bg-soft)] border-[var(--border)] hover:border-[var(--border-hover)]"
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isUnread ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isUnread ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>
            {senderName}
          </p>
          <p className={`text-xs truncate mt-0.5 ${isUnread ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}`}>
            {msg.asunto}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] text-[var(--fg-subtle)] ml-5 mt-1">
        <Clock className="w-2.5 h-2.5" />
        <span>
          {new Date(msg.created_at).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>
    </button>
  );
}

export function QuickAction({ icon, label, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200
        ${primary
          ? "bg-[var(--primary)] text-white border-[var(--primary)] hover:bg-[var(--primary-bright)]"
          : "bg-[var(--bg-soft)] border-[var(--border)] text-[var(--fg)] hover:border-[var(--primary)] hover:bg-[var(--primary-muted)]/10"
        }
      `}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export function StatusRow({ icon, label, value, total, color, onClick }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-soft)] transition-all group"
    >
      <span
        className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[var(--fg)]">{label}</span>
          <span className="text-sm font-bold" style={{ color }}>{value}</span>
        </div>
        <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export function PendingAction({ icon, title, description, actionLabel, onClick, color = "var(--primary)" }) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] hover:border-[var(--border-hover)] transition-all group cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span
        className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--fg)] leading-tight">{title}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5">{description}</p>
        <span className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 group-hover:gap-1.5 transition-all" style={{ color }}>
          {actionLabel}
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

export function NovedadItem({ title, description, date, type = "info" }) {
  const typeConfig = {
    update: { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "var(--success)" },
    maintenance: { icon: <Clock className="w-3.5 h-3.5" />, color: "var(--warning)" },
    info: { icon: <Newspaper className="w-3.5 h-3.5" />, color: "var(--accent)" },
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--bg-soft)] transition-colors">
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full grid place-items-center mt-0.5"
        style={{ backgroundColor: `${config.color}15`, color: config.color }}
      >
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--fg)] leading-tight">{title}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-0.5 line-clamp-2">{description}</p>
        <p className="text-[10px] text-[var(--fg-subtle)] mt-1">{date}</p>
      </div>
    </div>
  );
}

// === SHARED HOOKS & UTILITIES ===

export function getTableColumns(t) {
  return [
    { key: "id", header: "ID", sortAccessor: (row) => Number(row.id) || 0 },
    {
      key: "estado",
      header: t("dash_table_estado", "Estado"),
      render: (row) => {
        const StatusBadge = require("../components/ui/StatusBadge").default;
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
        const crit = (row.criticidad || "Normal").toLowerCase();
        const colors = {
          alta: "text-red-500",
          media: "text-yellow-500",
          normal: "text-[var(--fg-muted)]",
          baja: "text-green-500",
        };
        return (
          <span className={`text-xs font-medium ${colors[crit] || colors.normal}`}>
            {row.criticidad || "Normal"}
          </span>
        );
      },
    },
    {
      key: "items",
      header: "Items",
      render: (row) => {
        const items = row.items || [];
        return <span className="text-sm">{items.length}</span>;
      },
    },
    {
      key: "monto",
      header: "Monto",
      render: (row) => {
        const { formatCurrency } = require("../utils/formatters");
        return <span className="text-sm font-medium">{formatCurrency(row.total_monto || 0)}</span>;
      },
    },
    {
      key: "centro",
      header: "Centro",
      render: (row) => (
        <span className="text-xs text-[var(--fg-muted)]">{row.centro || "-"}</span>
      ),
    },
    {
      key: "almacen",
      header: "Almacen",
      render: (row) => {
        const { formatAlmacen } = require("../utils/formatters");
        return <span className="text-xs text-[var(--fg-muted)]">{formatAlmacen(row.almacen_virtual)}</span>;
      },
    },
    {
      key: "planificador",
      header: "Planificador",
      render: (row) => {
        const plannerNombre = [row.planner_nombre, row.planner_apellido]
          .filter(Boolean).join(" ").trim();
        return (
          <span className="text-xs text-[var(--fg-muted)]">
            {plannerNombre || "-"}
          </span>
        );
      },
    },
  ];
}
