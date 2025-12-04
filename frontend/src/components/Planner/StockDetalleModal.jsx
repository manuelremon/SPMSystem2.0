import React from "react";
import { X } from "lucide-react";

export default function StockDetalleModal({
  isOpen,
  onClose,
  detalleStock = [],
  almacenSolicitud,
  codigoMaterial,
  descripcionMaterial,
}) {
  if (!isOpen) return null;

  // Filtrar stock valido (ya viene filtrado del backend, pero doble check)
  const stockFiltrado = detalleStock.filter((s) => {
    const cantidad = Number(s.cantidad || 0);
    return cantidad > 0;
  });

  const totalStock = stockFiltrado.reduce(
    (acc, s) => acc + Number(s.cantidad || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-soft)]">
          <div>
            <h3 className="text-lg font-bold text-[var(--fg)]">
              Detalle de Stock por Ubicacion
            </h3>
            {codigoMaterial && (
              <p className="text-sm text-[var(--fg-muted)]">
                {codigoMaterial}
                {descripcionMaterial && ` - ${descripcionMaterial}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3 overflow-y-auto max-h-96">
          {stockFiltrado.map((stock, idx) => (
            <StockLocationCard
              key={idx}
              stock={stock}
              almacenSolicitud={almacenSolicitud}
            />
          ))}
          {stockFiltrado.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[var(--fg-muted)]">
                No hay stock disponible en ubicaciones validas
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-soft)]">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 text-xs text-[var(--fg-muted)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--success)]"></span>
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)]"></span>
                Requiere consulta
              </span>
            </div>
            <div className="text-sm font-semibold text-[var(--fg)]">
              Total: {totalStock} un.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockLocationCard({ stock, almacenSolicitud }) {
  const alm = String(stock.almacen || "").padStart(4, "0");
  const esLibre = stock.libre_disponibilidad === true;

  // Determinar politica: directo si es libre, o si 0001 coincide con solicitud
  const esDirecto =
    esLibre || (alm === "0001" && alm === almacenSolicitud);

  return (
    <div
      className={`p-4 rounded-lg border-2 transition ${
        esDirecto
          ? "border-[var(--success)] bg-[rgba(16,185,129,0.08)]"
          : "border-[var(--warning)] bg-[rgba(245,158,11,0.08)]"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="font-bold text-[var(--fg)]">
            Centro {stock.centro} / Almacen {alm}
          </p>
          {stock.nombre_almacen && (
            <p className="text-xs text-[var(--fg-muted)]">
              {stock.nombre_almacen}
            </p>
          )}
          {stock.lote && (
            <p className="text-xs text-[var(--fg-muted)]">Lote: {stock.lote}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-[var(--fg)]">
            {stock.cantidad || 0}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">unidades</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
            esDirecto
              ? "bg-[rgba(16,185,129,0.15)] text-[var(--success)]"
              : "bg-[rgba(245,158,11,0.15)] text-[var(--warning)]"
          }`}
        >
          {esDirecto ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              Disponible
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              Requiere consulta
            </>
          )}
        </span>

        {!esDirecto && stock.responsable && (
          <span className="text-xs text-[var(--fg-muted)]">
            Contactar: {stock.responsable}
          </span>
        )}
      </div>
    </div>
  );
}
