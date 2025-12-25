import React, { useMemo } from "react";
import { Package, ShoppingCart, DollarSign } from "../ui/Icons";

export default function Paso3RevisionFinal({ items = [], decisiones = {} }) {
  // Agrupar fuentes por tipo: stock vs compra + calcular costos
  const { stockRows, compraRows, costoStock, costoCompra, costoTotal } = useMemo(() => {
    const stock = [];
    const compra = [];
    let totalStock = 0;
    let totalCompra = 0;

    Object.entries(decisiones).forEach(([idx, decision]) => {
      const item = items.find((it) => Number(it.idx) === Number(idx)) || {};

      decision.fuentes?.forEach((fuente) => {
        const tipo = fuente.opcion?.tipo;

        const cantidadSolicitada = Number(item.cantidad || 0);
        const cantidadAsignada = Number(fuente.cantidad_asignada || 0);
        const precioUnitario = Number(fuente.opcion?.precio_unitario || item.precio_unitario || 0);
        const costoFuente = cantidadAsignada * precioUnitario;
        const porcentaje = cantidadSolicitada > 0
          ? Math.round((cantidadAsignada / cantidadSolicitada) * 100)
          : 0;

        if (tipo === "stock" || tipo === "transferencia") {
          totalStock += costoFuente;
          stock.push({
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidadSolicitada,
            cantidadAsignada,
            precioUnitario,
            costo: costoFuente,
            porcentaje,
            centro: fuente.opcion?.centro_origen || fuente.opcion?.centro,
            almacen: fuente.opcion?.almacen_origen || fuente.opcion?.almacen,
            nombre_almacen: fuente.opcion?.nombre_almacen,
            plazo: fuente.opcion?.plazo_dias,
          });
        } else if (tipo === "proveedor" || tipo === "equivalencia") {
          totalCompra += costoFuente;
          compra.push({
            codigo: item.codigo,
            descripcion: item.descripcion,
            cantidadSolicitada,
            cantidadAsignada,
            precioUnitario,
            costo: costoFuente,
            porcentaje,
            proveedor: fuente.opcion?.nombre_proveedor || fuente.opcion?.nombre,
            plazo: fuente.opcion?.plazo_dias,
            esEquivalencia: tipo === "equivalencia",
            esNegociado: fuente.opcion?.precio_es_negociado,
          });
        }
      });
    });

    return {
      stockRows: stock,
      compraRows: compra,
      costoStock: totalStock,
      costoCompra: totalCompra,
      costoTotal: totalStock + totalCompra,
    };
  }, [decisiones, items]);

  return (
    <div className="space-y-6">
      {/* Sección Stock */}
      {stockRows.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            icon={Package}
            title="DESDE STOCK"
            variant="success"
          />
          <StockTable rows={stockRows} />
        </div>
      )}

      {/* Sección Compra */}
      {compraRows.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            icon={ShoppingCart}
            title="POR COMPRA"
            variant="info"
          />
          <CompraTable rows={compraRows} />
        </div>
      )}

      {/* Estado vacío */}
      {stockRows.length === 0 && compraRows.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--fg-muted)]">
            No hay decisiones de abastecimiento registradas.
          </p>
        </div>
      )}

      {/* G4: Sumario de Costos */}
      {(stockRows.length > 0 || compraRows.length > 0) && (
        <div className="mt-8">
          <SectionHeader
            icon={DollarSign}
            title="RESUMEN DE COSTOS"
            variant="warning"
          />
          <div
            className="mt-3 p-4 rounded-2xl"
            style={{
              backgroundColor: "var(--card)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            <div className="grid grid-cols-3 gap-4">
              {/* Costo Stock */}
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}>
                <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-1">Desde Stock</p>
                <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>
                  ${costoStock.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--fg-muted)] mt-1">{stockRows.length} líneas</p>
              </div>

              {/* Costo Compra */}
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(59, 130, 246, 0.08)" }}>
                <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-1">Por Compra</p>
                <p className="text-2xl font-bold" style={{ color: "var(--info)" }}>
                  ${costoCompra.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--fg-muted)] mt-1">{compraRows.length} líneas</p>
              </div>

              {/* Costo Total */}
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: "rgba(139, 92, 246, 0.08)" }}>
                <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-1">Costo Total</p>
                <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
                  ${costoTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--fg-muted)] mt-1">{stockRows.length + compraRows.length} líneas</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, variant }) {
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
      bg: "rgba(139, 92, 246, 0.12)",
      text: "var(--primary)",
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
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--fg)]">
        {title}
      </h3>
    </div>
  );
}

function StockTable({ rows }) {
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
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Código SAP</th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Descripción</th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Solicitado</th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Asignado</th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Ubicación</th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Plazo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <td className="px-4 py-3.5 font-mono text-[var(--fg)]">{row.codigo}</td>
              <td className="px-4 py-3.5 text-[var(--fg)]">{row.descripcion}</td>
              <td className="px-4 py-3.5 text-right text-[var(--fg-muted)]">
                {row.cantidadSolicitada}
              </td>
              <td className="px-4 py-3.5 text-right">
                <span className="font-semibold text-[var(--fg)]">{row.cantidadAsignada}</span>
                <span
                  className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    color: "var(--success)",
                  }}
                >
                  {row.porcentaje}%
                </span>
              </td>
              <td className="px-4 py-3.5 text-[var(--fg-muted)]">
                {row.centro} / Alm {String(row.almacen || "").padStart(4, "0")}
                {row.nombre_almacen && (
                  <span className="block text-xs text-[var(--fg-muted)] opacity-70">
                    {row.nombre_almacen}
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5 text-right text-[var(--fg-muted)]">
                {row.plazo ? `${row.plazo} días` : "Inmediato"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompraTable({ rows }) {
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
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Código SAP</th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Descripción</th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Solicitado</th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Asignado</th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Proveedor</th>
            <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Plazo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <td className="px-4 py-3.5 font-mono text-[var(--fg)]">{row.codigo}</td>
              <td className="px-4 py-3.5 text-[var(--fg)]">{row.descripcion}</td>
              <td className="px-4 py-3.5 text-right text-[var(--fg-muted)]">
                {row.cantidadSolicitada}
              </td>
              <td className="px-4 py-3.5 text-right">
                <span className="font-semibold text-[var(--fg)]">{row.cantidadAsignada}</span>
                <span
                  className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                    color: "var(--info)",
                  }}
                >
                  {row.porcentaje}%
                </span>
              </td>
              <td className="px-4 py-3.5 text-[var(--fg)]">{row.proveedor || "N/D"}</td>
              <td className="px-4 py-3.5 text-right text-[var(--fg-muted)]">
                {row.plazo ? `${row.plazo} días` : "N/D"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
