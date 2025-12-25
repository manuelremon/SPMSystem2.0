import React, { useEffect, useState, useMemo } from "react";
import {
  Package,
  ShoppingCart,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Mail,
  FileText,
  UserCheck,
} from "../ui/Icons";

const ESTADO_CONFIG = {
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    color: "var(--fg-muted)",
    bg: "rgba(100, 100, 100, 0.12)",
  },
  transferencia_solicitada: {
    label: "Traspaso Solicitado",
    icon: Send,
    color: "var(--success)",
    bg: "rgba(16, 185, 129, 0.12)",
  },
  esperando_confirmacion: {
    label: "Esperando Confirmacion",
    icon: Clock,
    color: "var(--warning)",
    bg: "rgba(245, 158, 11, 0.12)",
  },
  confirmado: {
    label: "Confirmado",
    icon: CheckCircle,
    color: "var(--success)",
    bg: "rgba(16, 185, 129, 0.12)",
  },
  rechazado: {
    label: "Rechazado",
    icon: XCircle,
    color: "var(--error)",
    bg: "rgba(239, 68, 68, 0.12)",
  },
  solped_pendiente: {
    label: "SOLPED Pendiente",
    icon: AlertTriangle,
    color: "var(--info)",
    bg: "rgba(59, 130, 246, 0.12)",
  },
};

const TIPO_ACCION_CONFIG = {
  traspaso_mismo_centro: {
    label: "Traspaso de Almacen",
    descripcion: "Notificar al almacen para traspaso interno",
    icon: Package,
    color: "var(--success)",
    bg: "rgba(16, 185, 129, 0.12)",
  },
  consulta_otro_centro: {
    label: "Consulta a Referente",
    descripcion: "Solicitar confirmacion de disponibilidad",
    icon: Mail,
    color: "var(--warning)",
    bg: "rgba(245, 158, 11, 0.12)",
  },
  solped_proveedor: {
    label: "Generar SOLPED",
    descripcion: "Pendiente generacion en SAP",
    icon: FileText,
    color: "var(--info)",
    bg: "rgba(59, 130, 246, 0.12)",
  },
};

export default function Paso4AccionesPendientes({
  solicitudId,
  solicitud,
  items = [],
  decisiones = {},
  acciones = null,
  loading = false,
  onEjecutarAcciones,
}) {
  const [ejecutando, setEjecutando] = useState(false);
  const [resultadoAcciones, setResultadoAcciones] = useState(acciones);
  const [enviarResumenSolicitante, setEnviarResumenSolicitante] = useState(false);

  useEffect(() => {
    if (acciones) {
      setResultadoAcciones(acciones);
    }
  }, [acciones]);

  // Generar preview de acciones basado en las decisiones
  const previewAcciones = useMemo(() => {
    const preview = {
      traspasos: [],
      consultas: [],
      solpeds: [],
    };

    const centroSolicitud = solicitud?.centro;

    Object.entries(decisiones).forEach(([idx, decision]) => {
      const itemIdx = Number(idx);
      const item = items[itemIdx] || {};

      (decision.fuentes || []).forEach((fuente) => {
        const opcion = fuente.opcion || {};
        const tipoFuente = opcion.tipo;
        const centroOrigen = opcion.centro_origen || opcion.centro;
        const almacenOrigen = opcion.almacen_origen || opcion.almacen;
        const cantidad = Number(fuente.cantidad_asignada || 0);

        const accionBase = {
          codigo: item.codigo,
          descripcion: item.descripcion,
          cantidad,
          centroOrigen,
          almacenOrigen,
        };

        if (tipoFuente === "stock" || tipoFuente === "transferencia") {
          // B5: Null check para centroOrigen - si no hay centro, asumir mismo centro
          const esMismoCentro = !centroOrigen || centroOrigen === centroSolicitud;

          if (esMismoCentro) {
            // Traspaso mismo centro
            preview.traspasos.push({
              ...accionBase,
              tipo: "traspaso_mismo_centro",
              destinatario: `Almacen ${centroOrigen || centroSolicitud}/${almacenOrigen || "0001"}`,
              accion: "Notificar traspaso al almacen",
            });
          } else {
            // Consulta a otro centro
            preview.consultas.push({
              ...accionBase,
              tipo: "consulta_otro_centro",
              destinatario: `Referente Centro ${centroOrigen}`,
              accion: "Enviar consulta de disponibilidad",
            });
          }
        } else if (tipoFuente === "equivalencia") {
          // Equivalencias - tratar según ubicación del stock
          const esMismoCentro = !centroOrigen || centroOrigen === centroSolicitud;
          if (esMismoCentro) {
            preview.traspasos.push({
              ...accionBase,
              tipo: "traspaso_mismo_centro",
              destinatario: `Almacen ${centroOrigen || centroSolicitud}/${almacenOrigen || "0001"}`,
              accion: "Notificar traspaso (equivalencia)",
              esEquivalencia: true,
            });
          } else {
            preview.consultas.push({
              ...accionBase,
              tipo: "consulta_otro_centro",
              destinatario: `Referente Centro ${centroOrigen}`,
              accion: "Consulta equivalencia disponible",
              esEquivalencia: true,
            });
          }
        } else if (tipoFuente === "proveedor") {
          // SOLPED a proveedor
          preview.solpeds.push({
            ...accionBase,
            tipo: "solped_proveedor",
            destinatario: opcion.nombre || opcion.nombre_proveedor || "Proveedor",
            accion: "Generar SOLPED en SAP",
            plazo: opcion.plazo_dias,
          });
        }
      });
    });

    return preview;
  }, [decisiones, items, solicitud?.centro]);

  const handleEjecutar = async () => {
    if (!onEjecutarAcciones) return;
    setEjecutando(true);
    try {
      const resultado = await onEjecutarAcciones({
        enviarResumenSolicitante,
      });
      setResultadoAcciones(resultado);
    } catch (error) {
      console.error("Error ejecutando acciones:", error);
    } finally {
      setEjecutando(false);
    }
  };

  const totalAccionesPendientes =
    previewAcciones.traspasos.length +
    previewAcciones.consultas.length +
    previewAcciones.solpeds.length;

  // Si ya se ejecutaron las acciones, mostrar resultados
  if (resultadoAcciones) {
    const accionesStock = (resultadoAcciones?.acciones || []).filter(
      (a) => a.tipo_fuente === "stock" || a.tipo_fuente === "transferencia"
    );
    const accionesCompra = (resultadoAcciones?.acciones || []).filter(
      (a) => a.tipo_fuente === "proveedor"
    );

    return (
      <div className="space-y-6">
        {/* Resumen de resultados */}
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: "var(--bg-soft)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" style={{ color: "var(--success)" }} />
              <span className="font-medium text-[var(--fg)]">
                Acciones Ejecutadas
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[var(--fg-muted)]">
                <span className="font-semibold text-[var(--success)]">
                  {resultadoAcciones?.traspasos_solicitados || 0}
                </span>{" "}
                traspasos
              </span>
              <span className="text-[var(--fg-muted)]">
                <span className="font-semibold text-[var(--warning)]">
                  {resultadoAcciones?.consultas_pendientes || 0}
                </span>{" "}
                consultas
              </span>
              <span className="text-[var(--fg-muted)]">
                <span className="font-semibold text-[var(--info)]">
                  {resultadoAcciones?.solped_pendientes || 0}
                </span>{" "}
                SOLPED
              </span>
            </div>
          </div>
        </div>

        {/* Confirmación de resumen enviado al solicitante */}
        {resultadoAcciones?.resumen_enviado_solicitante && (
          <div
            className="p-4 rounded-xl border flex items-center gap-3"
            style={{
              backgroundColor: "rgba(99, 102, 241, 0.08)",
              borderColor: "var(--primary)",
            }}
          >
            <UserCheck className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <div>
              <p className="font-medium text-[var(--fg)]">
                Resumen enviado al solicitante
              </p>
              <p className="text-sm text-[var(--fg-muted)]">
                El solicitante recibira una notificacion con el detalle del tratamiento para su revision y aceptacion.
              </p>
            </div>
          </div>
        )}

        {/* Seccion Stock/Traspasos */}
        {accionesStock.length > 0 && (
          <div className="space-y-3">
            <SectionHeader
              icon={Package}
              title="NOTIFICACIONES ENVIADAS"
              subtitle="Traspasos y consultas de stock"
              variant="success"
            />
            <AccionesTable acciones={accionesStock} />
          </div>
        )}

        {/* Seccion Compras/SOLPED */}
        {accionesCompra.length > 0 && (
          <div className="space-y-3">
            <SectionHeader
              icon={ShoppingCart}
              title="PENDIENTES SAP"
              subtitle="Materiales que requieren SOLPED"
              variant="info"
            />
            <AccionesTable acciones={accionesCompra} tipo="compra" />
          </div>
        )}

        {accionesStock.length === 0 && accionesCompra.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--fg-muted)]">
              No hay acciones pendientes para esta solicitud.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  // Mostrar preview de acciones pendientes
  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <div
        className="p-4 rounded-xl"
        style={{ backgroundColor: "var(--bg-soft)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <span className="font-medium text-[var(--fg)]">
              Acciones Pendientes de Ejecutar
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--fg-muted)]">
              <span className="font-semibold text-[var(--success)]">
                {previewAcciones.traspasos.length}
              </span>{" "}
              traspasos
            </span>
            <span className="text-[var(--fg-muted)]">
              <span className="font-semibold text-[var(--warning)]">
                {previewAcciones.consultas.length}
              </span>{" "}
              consultas
            </span>
            <span className="text-[var(--fg-muted)]">
              <span className="font-semibold text-[var(--info)]">
                {previewAcciones.solpeds.length}
              </span>{" "}
              SOLPED
            </span>
          </div>
        </div>
      </div>

      {/* Traspasos de almacen (mismo centro) */}
      {previewAcciones.traspasos.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            icon={Package}
            title="TRASPASOS DE ALMACEN"
            subtitle="Se notificara al almacen para realizar el traspaso"
            variant="success"
          />
          <PreviewTable acciones={previewAcciones.traspasos} tipo="traspaso" />
        </div>
      )}

      {/* Consultas a referentes (otro centro) */}
      {previewAcciones.consultas.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            icon={Mail}
            title="CONSULTAS A REFERENTES"
            subtitle="Se enviara consulta de disponibilidad a otros centros"
            variant="warning"
          />
          <PreviewTable acciones={previewAcciones.consultas} tipo="consulta" />
        </div>
      )}

      {/* SOLPED a proveedores */}
      {previewAcciones.solpeds.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            icon={FileText}
            title="SOLPED A GENERAR"
            subtitle="Pendiente generacion de pedido en SAP"
            variant="info"
          />
          <PreviewTable acciones={previewAcciones.solpeds} tipo="solped" />
        </div>
      )}

      {/* Estado vacio */}
      {totalAccionesPendientes === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--fg-muted)]">
            No hay acciones pendientes para ejecutar.
          </p>
        </div>
      )}

      {/* Opcion de enviar resumen al solicitante */}
      <div
        className="p-4 rounded-xl border"
        style={{
          backgroundColor: enviarResumenSolicitante ? "rgba(99, 102, 241, 0.08)" : "var(--card)",
          borderColor: enviarResumenSolicitante ? "var(--primary)" : "var(--border)",
        }}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="pt-0.5">
            <input
              type="checkbox"
              checked={enviarResumenSolicitante}
              onChange={(e) => setEnviarResumenSolicitante(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-[var(--border)] text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-0 cursor-pointer"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="font-semibold text-[var(--fg)]">
                Enviar resumen al solicitante para aceptacion
              </span>
              <span
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(100, 100, 100, 0.12)",
                  color: "var(--fg-muted)",
                }}
              >
                Opcional
              </span>
            </div>
            <p className="text-sm text-[var(--fg-muted)] mt-1">
              El solicitante recibira un mensaje con el detalle del tratamiento propuesto
              y podra aceptarlo o solicitar modificaciones antes de que se ejecuten las acciones.
            </p>
            {enviarResumenSolicitante && (
              <div
                className="mt-3 p-3 rounded-lg text-sm"
                style={{ backgroundColor: "rgba(99, 102, 241, 0.08)" }}
              >
                <p className="font-medium text-[var(--fg)]">
                  Se enviara notificacion a: {solicitud?.solicitante_nombre || solicitud?.nombre || "Solicitante"} {solicitud?.solicitante_apellido || solicitud?.apellido || ""}
                </p>
                <p className="text-[var(--fg-muted)] mt-1">
                  Las acciones quedaran en estado "Pendiente de aceptacion" hasta que el solicitante confirme.
                </p>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Boton de ejecutar */}
      {(totalAccionesPendientes > 0 || enviarResumenSolicitante) && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleEjecutar}
            disabled={ejecutando}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium text-white transition-all hover:opacity-90"
            style={{
              backgroundColor: ejecutando ? "var(--fg-muted)" : "var(--primary)",
            }}
          >
            {ejecutando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {enviarResumenSolicitante ? "Enviando resumen..." : "Ejecutando acciones..."}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {enviarResumenSolicitante
                  ? `Enviar resumen${totalAccionesPendientes > 0 ? ` y ejecutar ${totalAccionesPendientes} acciones` : ""}`
                  : `Ejecutar ${totalAccionesPendientes} acciones`}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, variant }) {
  const variantStyles = {
    success: {
      bg: "rgba(16, 185, 129, 0.12)",
      text: "var(--success)",
    },
    info: {
      bg: "rgba(59, 130, 246, 0.12)",
      text: "var(--info)",
    },
    warning: {
      bg: "rgba(245, 158, 11, 0.12)",
      text: "var(--warning)",
    },
  };

  const style = variantStyles[variant] || variantStyles.info;

  return (
    <div className="flex items-center gap-3">
      <div
        className="p-2 rounded-lg"
        style={{ backgroundColor: style.bg, color: style.text }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--fg)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--fg-muted)]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function PreviewTable({ acciones, tipo }) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--card)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            style={{
              backgroundColor: "var(--bg-soft)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Codigo SAP
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Descripcion
            </th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Cantidad
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              {tipo === "solped" ? "Proveedor" : "Destinatario"}
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Accion
            </th>
          </tr>
        </thead>
        <tbody>
          {acciones.map((accion, i) => {
            const config = TIPO_ACCION_CONFIG[accion.tipo] || {};
            const AccionIcon = config.icon || Clock;

            return (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i < acciones.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <td className="px-4 py-3.5 font-mono text-[var(--fg)]">
                  {accion.codigo}
                </td>
                <td className="px-4 py-3.5 text-[var(--fg)]">
                  {accion.descripcion}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-[var(--fg)]">
                  {accion.cantidad}
                </td>
                <td className="px-4 py-3.5 text-[var(--fg-muted)]">
                  {accion.destinatario}
                  {accion.plazo && (
                    <span className="block text-xs opacity-70">
                      Plazo: {accion.plazo} dias
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <AccionIcon
                      className="w-4 h-4"
                      style={{ color: config.color }}
                    />
                    <span className="text-[var(--fg-muted)]">
                      {accion.accion}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AccionesTable({ acciones, tipo = "stock" }) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "var(--card)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            style={{
              backgroundColor: "var(--bg-soft)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Codigo SAP
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Descripcion
            </th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Cantidad
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              {tipo === "compra" ? "Proveedor" : "Destinatario"}
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {acciones.map((accion, i) => {
            const estadoConfig = ESTADO_CONFIG[accion.estado] || ESTADO_CONFIG.pendiente;
            const EstadoIcon = estadoConfig.icon;

            return (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i < acciones.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <td className="px-4 py-3.5 font-mono text-[var(--fg)]">
                  {accion.codigo_material}
                </td>
                <td className="px-4 py-3.5 text-[var(--fg)]">
                  {accion.descripcion}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-[var(--fg)]">
                  {accion.cantidad}
                </td>
                <td className="px-4 py-3.5 text-[var(--fg-muted)]">
                  {accion.destinatario || "N/D"}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-center">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: estadoConfig.bg,
                        color: estadoConfig.color,
                      }}
                    >
                      <EstadoIcon className="w-3.5 h-3.5" />
                      {estadoConfig.label}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
