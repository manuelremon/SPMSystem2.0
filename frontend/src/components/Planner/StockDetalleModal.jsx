import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Check, MapPin } from "../ui/Icons";

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

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedStock(null);
      setCantidadAAsignar(cantidadSolicitada);
    }
  }, [isOpen, cantidadSolicitada]);

  // Filtrar stock válido
  const stockFiltrado = detalleStock.filter((s) => {
    const cantidad = Number(s.cantidad || 0);
    return cantidad > 0;
  });

  const totalStock = stockFiltrado.reduce(
    (acc, s) => acc + Number(s.cantidad || 0),
    0
  );

  const modalTitle = codigoMaterial
    ? `Stock: ${codigoMaterial}${descripcionMaterial ? ` - ${descripcionMaterial}` : ''}`
    : 'Detalle de Stock por Ubicación';

  const footer = (
    <div className="flex items-center justify-between w-full">
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
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="lg"
      footer={footer}
    >
      <div className="space-y-3">
        {onSelectStock && (
          <p className="text-xs text-[var(--fg-muted)] mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
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
              No hay stock disponible en ubicaciones válidas
            </p>
          </div>
        )}

        {/* Cantidad a asignar - solo si hay selección */}
        {onSelectStock && selectedStock !== null && (
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-blue-50 border border-blue-200 mt-4">
            <div className="text-sm text-[var(--fg)]">
              <span className="font-semibold">Cantidad a asignar:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCantidadAAsignar(Math.max(1, cantidadAAsignar - 1))}
                className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--bg-soft)] flex items-center justify-center transition-colors"
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
                className="w-16 h-8 text-center rounded-lg border border-[var(--border)] text-sm font-bold bg-white"
                min={1}
                max={stockFiltrado[selectedStock]?.cantidad || 1}
              />
              <button
                type="button"
                onClick={() => setCantidadAAsignar(Math.min(stockFiltrado[selectedStock]?.cantidad || 1, cantidadAAsignar + 1))}
                className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--bg-soft)] flex items-center justify-center transition-colors"
              >
                +
              </button>
              <span className="text-xs text-[var(--fg-muted)]">
                / {stockFiltrado[selectedStock]?.cantidad || 0} disp.
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function StockLocationCard({ stock, almacenSolicitud, selectable, selected, onSelect }) {
  const alm = String(stock.almacen || "").padStart(4, "0");
  const esLibre = stock.libre_disponibilidad === true;

  // Determinar política: directo si es libre, o si 0001 coincide con solicitud
  const esDirecto = esLibre || (alm === "0001" && alm === almacenSolicitud);

  const baseClasses = selectable ? "cursor-pointer hover:shadow-md" : "";

  const selectedClasses = selected
    ? "border-[var(--primary)] bg-blue-50 ring-2 ring-[var(--primary)] ring-offset-1"
    : esDirecto
    ? "border-[var(--success)] bg-emerald-50"
    : "border-[var(--warning)] bg-amber-50";

  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${baseClasses} ${selectedClasses}`}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="font-bold text-[var(--fg)]">
            Centro {stock.centro} / Almacén {alm}
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
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
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
