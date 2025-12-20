import React, { useState } from "react";
import { X, Check, MapPin } from "../ui/Icons";
import { Button } from "../ui/Button";

export default function StockDetalleModal({
  isOpen,
  onClose,
  detalleStock = [],
  almacenSolicitud,
  codigoMaterial,
  descripcionMaterial,
  onSelectStock,
  cantidadSolicitada = 1,
}) {
  const [selectedStock, setSelectedStock] = useState(null);
  const [cantidadAAsignar, setCantidadAAsignar] = useState(cantidadSolicitada);
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
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="max-w-lg w-full max-h-[80vh] overflow-hidden rounded-2xl border border-white/50"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.6)',
        }}
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
          {onSelectStock && (
            <p className="text-xs text-slate-600 mb-2">
              <MapPin className="w-3 h-3 inline mr-1" />
              Selecciona la ubicación desde donde deseas abastecer
            </p>
          )}
          {stockFiltrado.map((stock, idx) => (
            <StockLocationCard
              key={idx}
              stock={stock}
              almacenSolicitud={almacenSolicitud}
              selectable={!!onSelectStock}
              selected={selectedStock === idx}
              onSelect={() => {
                setSelectedStock(idx);
                setCantidadAAsignar(Math.min(cantidadSolicitada, Number(stock.cantidad || 0)));
              }}
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
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-soft)] space-y-3">
          {/* Cantidad a asignar - solo si hay selección */}
          {onSelectStock && selectedStock !== null && (
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-sm text-slate-700">
                <span className="font-semibold">Cantidad a asignar:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCantidadAAsignar(Math.max(1, cantidadAAsignar - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  value={cantidadAAsignar}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(Number(stockFiltrado[selectedStock]?.cantidad || 0), Number(e.target.value) || 1));
                    setCantidadAAsignar(val);
                  }}
                  className="w-16 h-8 text-center rounded-lg border border-slate-300 text-sm font-bold"
                  min={1}
                  max={stockFiltrado[selectedStock]?.cantidad || 1}
                />
                <button
                  type="button"
                  onClick={() => setCantidadAAsignar(Math.min(stockFiltrado[selectedStock]?.cantidad || 1, cantidadAAsignar + 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center justify-center"
                >
                  +
                </button>
                <span className="text-xs text-slate-500">
                  / {stockFiltrado[selectedStock]?.cantidad || 0} disp.
                </span>
              </div>
            </div>
          )}

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
            {onSelectStock ? (
              <Button
                variant="primary"
                disabled={selectedStock === null}
                onClick={() => {
                  if (selectedStock !== null) {
                    onSelectStock(stockFiltrado[selectedStock], cantidadAAsignar);
                    onClose();
                  }
                }}
              >
                <Check className="w-4 h-4 mr-1" />
                Usar esta ubicación
              </Button>
            ) : (
              <div className="text-sm font-semibold text-[var(--fg)]">
                Total: {totalStock} un.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StockLocationCard({ stock, almacenSolicitud, selectable, selected, onSelect }) {
  const alm = String(stock.almacen || "").padStart(4, "0");
  const esLibre = stock.libre_disponibilidad === true;

  // Determinar politica: directo si es libre, o si 0001 coincide con solicitud
  const esDirecto =
    esLibre || (alm === "0001" && alm === almacenSolicitud);

  const baseClasses = selectable
    ? "cursor-pointer hover:shadow-md"
    : "";

  const selectedClasses = selected
    ? "border-[var(--primary)] bg-blue-50 ring-2 ring-[var(--primary)] ring-offset-1"
    : esDirecto
    ? "border-[var(--success)] bg-[rgba(16,185,129,0.08)]"
    : "border-[var(--warning)] bg-[rgba(245,158,11,0.08)]";

  return (
    <div
      className={`p-4 rounded-lg border-2 transition ${baseClasses} ${selectedClasses}`}
      onClick={selectable ? onSelect : undefined}
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
            selected
              ? "bg-blue-100 text-blue-700"
              : esDirecto
              ? "bg-[rgba(16,185,129,0.15)] text-[var(--success)]"
              : "bg-[rgba(245,158,11,0.15)] text-[var(--warning)]"
          }`}
        >
          {selected ? (
            <>
              <Check className="w-3 h-3" />
              Seleccionado
            </>
          ) : esDirecto ? (
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

        {!esDirecto && stock.responsable && !selected && (
          <span className="text-xs text-[var(--fg-muted)]">
            Contactar: {stock.responsable}
          </span>
        )}
      </div>
    </div>
  );
}
