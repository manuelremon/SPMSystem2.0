import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { ModernDataTable as DataTable } from "../features/DataTable";
import { withSpmAlignments } from "../../utils/tableAlignments";
import { DollarSign, Package, ChevronDown, ChevronUp, Send, X, AlertOctagon, Info, Lightbulb } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../services/api";
import { ensureCsrfToken } from "../../services/csrf";

export default function Paso1AnalisisInicial({ analisis = {}, solicitud = {}, onNext, onReject, onRequestInfo }) {
  const resumen = analisis.resumen || {};
  const conflictos = analisis.conflictos || [];
  const avisos = analisis.avisos || [];
  const recomendaciones = analisis.recomendaciones || [];
  const materiales = analisis.materiales_por_criticidad || {};
  const presupuestoOk = (resumen.diferencia_presupuesto || 0) >= 0;
  const [showPresupuestoModal, setShowPresupuestoModal] = useState(false);

  const tieneConflictosCriticos = conflictos.some(c => c.impacto_critico);
  const tieneConflictos = conflictos.length > 0;

  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle>Análisis Inicial</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-1 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Columna izquierda: Análisis y alertas */}
          <div className="space-y-3">
            <PresupuestoCard
              resumen={resumen}
              solicitud={solicitud}
              onPresupuestoInsuficiente={() => setShowPresupuestoModal(true)}
            />
            {/* Conflictos, Avisos y Recomendaciones en 3 columnas */}
            <div className="grid grid-cols-3 gap-2">
              <BadgeListCompact
                icon={<AlertOctagon className="w-4 h-4 text-red-600" />}
                title="Conflictos"
                emptyLabel="Sin conflictos"
                count={conflictos.length}
                items={conflictos.map((c) => ({
                  label: c.impacto_critico ? `⚠️ ${c.tipo}` : c.tipo,
                  detail: c.descripcion || `Item ${c.item_idx}`,
                  tone: c.impacto_critico ? "danger" : "warning",
                }))}
                colorBg="bg-red-50"
                colorBorder="border-red-200"
                colorBadge="bg-red-100 text-red-700"
              />
              <BadgeListCompact
                icon={<Info className="w-4 h-4 text-amber-600" />}
                title="Avisos"
                emptyLabel="Sin avisos"
                count={avisos.length}
                items={avisos.map((a) => ({
                  label: a.nivel || "info",
                  detail: a.mensaje || "",
                  tone: a.nivel === "warning" ? "warning" : "info",
                }))}
                colorBg="bg-amber-50"
                colorBorder="border-amber-200"
                colorBadge="bg-amber-100 text-amber-700"
              />
              <BadgeListCompact
                icon={<Lightbulb className="w-4 h-4 text-blue-600" />}
                title="Recomendaciones"
                emptyLabel="Sin recomendaciones"
                count={recomendaciones.length}
                items={recomendaciones.map((r) => ({
                  label: r.accion,
                  detail: r.razon,
                  tone: r.prioridad === "muy_alta" ? "danger" : r.prioridad === "alta" ? "warning" : "info",
                }))}
                colorBg="bg-blue-50"
                colorBorder="border-blue-200"
                colorBadge="bg-blue-100 text-blue-700"
              />
            </div>
          </div>

          {/* Columna derecha: Materiales solicitados */}
          <div className="min-w-0">
            <MaterialesList materiales={materiales} solicitud={solicitud} />
          </div>
        </div>

        {/* Acciones especiales (solo si hay conflictos) */}
        {(tieneConflictosCriticos || tieneConflictos) && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
            {tieneConflictosCriticos && onReject && (
              <Button variant="danger" onClick={onReject} type="button">
                Rechazar solicitud
              </Button>
            )}
            {tieneConflictos && onRequestInfo && (
              <Button variant="ghost" onClick={onRequestInfo} type="button">
                Solicitar información
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Modal de presupuesto insuficiente */}
      {showPresupuestoModal && (
        <PresupuestoInsuficienteModal
          solicitud={solicitud}
          isOpen={showPresupuestoModal}
          onClose={() => setShowPresupuestoModal(false)}
        />
      )}
    </Card>
  );
}

function PresupuestoCard({ resumen, solicitud, onPresupuestoInsuficiente }) {
  const disponible = resumen.presupuesto_disponible || 0;

  // Calcular costo total desde los items de la solicitud (PU × cantidad)
  const items = solicitud.items || solicitud.data_json?.items || [];
  const costoCalculado = items.reduce((total, item) => {
    const precio = Number(item.precio_unitario || 0);
    const cantidad = Number(item.cantidad || 0);
    return total + (precio * cantidad);
  }, 0);

  // Usar el costo calculado si está disponible, sino usar el del backend
  const costoTotal = costoCalculado > 0 ? costoCalculado : (resumen.presupuesto_real_necesario || resumen.costo_total_solicitud || 0);
  const diferencia = disponible - costoTotal;
  const alcanza = diferencia >= 0;

  return (
    <div className="p-4 md:p-5 rounded-xl border border-slate-200 bg-white space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-[var(--primary)]" />
        <p
          className="text-xs uppercase font-bold tracking-[0.08em] text-slate-700"
          title="Análisis del presupuesto disponible vs costo de la solicitud"
        >
          Balance Presupuesto
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-slate-700" title="Presupuesto disponible en el centro/sector">
            Presupuesto Disponible
          </span>
          <span className="text-base font-bold text-slate-900">{formatCurrency(disponible)}</span>
        </div>

        <div className="flex justify-between items-baseline gap-2">
          <span className="text-sm text-slate-700" title={`Suma de (Precio Unitario × Cantidad) de ${items.length} ${items.length === 1 ? 'item' : 'items'}`}>
            Costo de la Solicitud
          </span>
          <span className="text-base font-bold text-slate-900">{formatCurrency(costoTotal)}</span>
        </div>

        <div
          className={`p-3 rounded-lg border-2 ${alcanza ? 'border-[var(--success)] bg-[rgba(52,211,153,0.06)]' : 'border-[var(--danger)] bg-[rgba(239,68,68,0.06)] cursor-pointer hover:bg-[rgba(239,68,68,0.12)] transition-all'}`}
          title={alcanza ? "El presupuesto disponible es suficiente" : "Click para notificar al solicitante sobre presupuesto insuficiente"}
          onClick={() => !alcanza && onPresupuestoInsuficiente && onPresupuestoInsuficiente()}
        >
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">Balance</span>
            <span className={`text-lg font-black ${alcanza ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {diferencia >= 0 ? '+' : ''}{formatCurrency(diferencia)} {alcanza ? '✓' : '⚠️'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgeListCompact({ title, items, emptyLabel, count, icon, colorBg, colorBorder, colorBadge }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`p-3 rounded-lg border ${colorBorder} ${colorBg}`}>
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[10px] uppercase font-bold tracking-wide text-slate-700">{title}</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${colorBadge}`}>
          {count}
        </span>
      </div>

      {count === 0 ? (
        <p className="text-[11px] text-slate-500">{emptyLabel}</p>
      ) : (
        <>
          <div className="space-y-1.5 max-h-24 overflow-y-auto">
            {(expanded ? items : items.slice(0, 2)).map((it, idx) => (
              <div key={idx} className="text-[11px] text-slate-700 leading-tight">
                <span className="font-semibold">{it.label}</span>
                {it.detail && <span className="block text-slate-600 truncate">{it.detail}</span>}
              </div>
            ))}
          </div>
          {items.length > 2 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 text-[10px] font-semibold text-blue-600 hover:text-blue-700"
            >
              {expanded ? "Ver menos" : `+${items.length - 2} más`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function BadgeList({ title, items, emptyLabel, tone = "info", collapsed = false, onToggle, icon }) {
  const palettes = {
    danger: {
      border: "border-[var(--danger)]",
      bg: "bg-[rgba(239,68,68,0.08)]",
      text: "text-[var(--danger)]",
    },
    warning: {
      border: "border-blue-300",
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    info: {
      border: "border-slate-200",
      bg: "bg-slate-50",
      text: "text-slate-800",
    },
    muted: {
      border: "border-slate-200",
      bg: "bg-slate-50",
      text: "text-slate-700",
    },
  };

  const palette = palettes[tone] || palettes.info;
  const count = items.length;

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs uppercase font-bold tracking-[0.08em] text-slate-700">{title}</p>
          {count > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-slate-100 text-xs font-bold text-slate-900"
              title={`${count} ${count === 1 ? 'item' : 'items'}`}
            >
              {count}
            </span>
          )}
        </div>
        {onToggle ? (
          <button
            type="button"
            className="p-1 rounded hover:bg-slate-100 text-[var(--primary)] hover:text-[var(--primary-hover)] transition-all"
            onClick={onToggle}
            title={collapsed ? "Expandir sección" : "Contraer sección"}
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <p className="text-sm text-slate-700">
          {count === 0 ? emptyLabel : `${count} ${count === 1 ? 'item' : 'items'} - Haz clic para expandir`}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-700">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={idx} className={`px-3 py-2.5 rounded-lg border ${palette.border} ${palette.bg}`}>
              <div className={`text-xs font-semibold uppercase tracking-[0.1em] ${palette.text} mb-1`}>{it.label}</div>
              <div className="text-sm text-slate-900 leading-relaxed">{it.detail}</div>
              {it.sugerencia && (
                <div className="text-xs text-slate-700 mt-2 italic pl-2 border-l-2 border-slate-200">
                  {it.sugerencia}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MaterialesList({ materiales, solicitud }) {
  // Combinar todos los materiales de todas las criticidades
  const todosLosMateriales = [
    ...(materiales.Critico || []),
    ...(materiales.Normal || []),
    ...(materiales.Bajo || []),
  ];

  // Si no hay materiales del análisis, usar los items de la solicitud
  const items = todosLosMateriales.length > 0
    ? todosLosMateriales
    : (solicitud.items || solicitud.data_json?.items || []).map((item, idx) => ({
        idx,
        codigo: item.codigo,
        descripcion: item.descripcion || 'Sin descripción',
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        stock_disponible: item.stock_disponible,
        criticidad: item.criticidad || 'Normal',
      }));

  return (
    <div className="p-4 md:p-5 rounded-xl border border-slate-200 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[var(--primary)]" />
          <p className="text-xs uppercase font-bold tracking-[0.08em] text-slate-700">
            Materiales Solicitados
          </p>
        </div>
        <span
          className="text-sm font-bold text-slate-900"
          title={`Total de materiales en la solicitud`}
        >
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-700 text-center py-8">Sin materiales en la solicitud</p>
      ) : (
        <MaterialesTable items={items} />
      )}
    </div>
  );
}

function MaterialesTable({ items }) {
  // Columnas con alineación automática SPM (código=center, descripción=left, cantidad=center, precio=right)
  const columns = withSpmAlignments([
    {
      key: "codigo",
      header: "Código",
      render: (row) => row.codigo,
      sortAccessor: (row) => row.codigo || "",
    },
    {
      key: "descripcion",
      header: "Descripción",
      align: "left", // Forzar left para descripciones
      render: (row) => {
        const desc = row.descripcion || "Sin descripción";
        const truncated = desc.length > 50 ? desc.substring(0, 50) + "..." : desc;
        return <span title={desc}>{truncated}</span>;
      },
      sortAccessor: (row) => row.descripcion || "",
    },
    {
      key: "cantidad",
      header: "Cant.",
      render: (row) => <span className="font-semibold">{row.cantidad}</span>,
      sortAccessor: (row) => Number(row.cantidad || 0),
    },
    {
      key: "precio_unitario",
      header: "P. Unit.",
      render: (row) => formatCurrency(row.precio_unitario || 0),
      sortAccessor: (row) => Number(row.precio_unitario || 0),
    },
  ]);

  return (
    <div className="max-h-[600px] overflow-auto">
      <DataTable columns={columns} rows={items} emptyMessage="Sin materiales" />
    </div>
  );
}

function PresupuestoInsuficienteModal({ solicitud, isOpen, onClose }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Obtener nombre del sector
  const sectorMap = {
    "1": "Almacenes",
    "2": "Compras",
    "3": "Mantenimiento",
    "4": "Planificación",
    "5": "Operaciones",
    "6": "Logística",
    "7": "Producción",
    "8": "Calidad",
  };

  const sectorNombre = solicitud.sector_nombre || sectorMap[solicitud.sector] || solicitud.sector;

  // Obtener nombre completo del solicitante
  const solicitanteNombre = solicitud.solicitante_nombre || solicitud.usuario_nombre || "";
  const solicitanteApellido = solicitud.solicitante_apellido || solicitud.usuario_apellido || "";
  const nombreCompleto = `${solicitanteNombre} ${solicitanteApellido}`.trim() || solicitud.id_usuario;

  const mensajeDefault = `La solicitud #${solicitud.id} no podrá ser procesada hasta tanto no se incorpore saldo al Centro ${solicitud.centro} Sector "${sectorNombre}".`;

  const handleEnviar = async () => {
    setSending(true);
    setError("");

    try {
      await ensureCsrfToken();

      // 1. Enviar mensaje al solicitante
      await api.post("/mensajes", {
        destinatario_id: solicitud.id_usuario,
        asunto: `Presupuesto insuficiente - Solicitud #${solicitud.id}`,
        mensaje: mensajeDefault,
        solicitud_id: solicitud.id,
        tipo: "presupuesto_insuficiente",
        metadata: {
          origen: "planificador",
          centro: solicitud.centro,
          sector: solicitud.sector,
        },
      });

      // 2. Enviar mensaje al jefe (si existe)
      if (solicitud.jefe || solicitud.usuario_jefe) {
        const jefeId = solicitud.jefe || solicitud.usuario_jefe;
        await api.post("/mensajes", {
          destinatario_id: jefeId,
          asunto: `[COPIA] Presupuesto insuficiente - Solicitud #${solicitud.id}`,
          mensaje: `${mensajeDefault}\n\n(Este mensaje es una copia del aviso enviado al solicitante ${solicitud.id_usuario})`,
          solicitud_id: solicitud.id,
          tipo: "presupuesto_insuficiente",
          metadata: {
            origen: "planificador",
            centro: solicitud.centro,
            sector: solicitud.sector,
            es_copia: true,
          },
        });
      }

      // 3. Cambiar el estado de la solicitud a "PRESUPUESTO (-)"
      await api.patch(`/solicitudes/${solicitud.id}`, {
        estado: "presupuesto_insuficiente",
        observaciones: mensajeDefault,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Recargar la página para reflejar el cambio de estado
        window.location.reload();
      }, 2000);
    } catch (err) {
      const mensaje = err.response?.data?.error?.message || err.message || "Error al enviar notificación";
      setError(mensaje);
      console.error("Error al notificar presupuesto insuficiente:", err);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/50"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[var(--fg-strong)] mb-1">
              Presupuesto Insuficiente
            </h2>
            <p className="text-sm text-[var(--fg-muted)]">
              Notificar al solicitante sobre falta de presupuesto
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-4 p-2 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[var(--bg-elevated)] transition-all"
            disabled={sending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--danger)] text-[var(--danger)] text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-lg bg-[var(--status-success-bg)] border border-[var(--success)] text-[var(--success)] text-sm">
              ✓ Notificación enviada exitosamente. El estado de la solicitud ha sido actualizado.
            </div>
          )}

          {!success && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--fg)]">Mensaje a enviar:</label>
                <div className="p-4 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--fg)]">
                  {mensajeDefault}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-[var(--fg-muted)]">
                  <strong>Destinatarios:</strong>
                </p>
                <ul className="text-sm text-[var(--fg-muted)] space-y-1 ml-4">
                  <li>• Solicitante: <strong className="text-[var(--fg)]">{nombreCompleto}</strong></li>
                  {(solicitud.jefe || solicitud.usuario_jefe) && (
                    <li>• Jefe (copia): <strong className="text-[var(--fg)]">{solicitud.jefe || solicitud.usuario_jefe}</strong></li>
                  )}
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                <p className="text-sm text-[var(--fg-muted)]">
                  Al enviar esta notificación:
                </p>
                <ul className="text-sm text-[var(--fg-muted)] space-y-1 ml-4 mt-2">
                  <li>• Se notificará al solicitante y su jefe</li>
                  <li>• El estado cambiará a <strong className="text-[var(--danger)]">PRESUPUESTO (-)</strong></li>
                  <li>• La solicitud quedará en espera hasta que se incorpore presupuesto</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-3 p-6 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleEnviar} disabled={sending}>
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--on-primary)]" />
                  <span className="ml-2">Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="ml-2">Enviar Notificación</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
