import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Package, TrendingUp, DollarSign, MapPin, Check } from "lucide-react";
import StockDetalleModal from "./StockDetalleModal";

export default function Paso2DecisionAbastecimiento({
  solicitud,
  analisis,
  items = [],
  totalItems = 0,
  currentIdx = 0,
  onChangeIdx,
  opciones = {},
  decisiones = {},
  onSelectDecision,
  onFetchOpciones,
  loadingOpciones,
  onPrev,
  onNext,
}) {
  const itemActual = items[currentIdx] || {};
  const dataOpciones = opciones[currentIdx]?.opciones || [];
  const selected = decisiones[currentIdx];
  const progress = totalItems > 0 ? ((currentIdx + 1) / totalItems) * 100 : 0;
  const [vistaTabla, setVistaTabla] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const stockInfo = useMemo(() => getStockDisplay(itemActual), [itemActual]);
  const [mostrarMrp, setMostrarMrp] = useState(false);

  // Filtrar opciones según el tipo seleccionado
  const opcionesFiltradas = useMemo(() => {
    if (filtroTipo === "todos") return dataOpciones;
    return dataOpciones.filter((op) => op.tipo === filtroTipo);
  }, [dataOpciones, filtroTipo]);

  // Contar opciones por tipo
  const conteoTipos = useMemo(() => {
    const conteo = {
      todos: dataOpciones.length,
      stock: 0,
      proveedor: 0,
      equivalencia: 0,
      mix: 0,
    };
    dataOpciones.forEach((op) => {
      const tipo = op.tipo || "otros";
      if (conteo[tipo] !== undefined) {
        conteo[tipo]++;
      }
    });
    return conteo;
  }, [dataOpciones]);

  useEffect(() => {
    if (currentIdx != null) {
      onFetchOpciones?.(currentIdx);
    }
  }, [currentIdx, onFetchOpciones]);

  const resumenDecisiones = useMemo(() => {
    return Object.entries(decisiones).map(([idx, op]) => ({
      idx: Number(idx),
      opcion: op,
      item: items.find((it) => Number(it.idx) === Number(idx)) || {},
    }));
  }, [decisiones, items]);

  // Validar completitud: todos los items deben tener decisión
  const itemsPendientes = totalItems - Object.keys(decisiones).length;
  const puedeAvanzar = itemsPendientes === 0;
  const porcentajeCompleto = totalItems > 0 ? (Object.keys(decisiones).length / totalItems) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle>Decision de abastecimiento</CardTitle>
          <CardDescription className="text-sm text-[var(--fg-muted)]">
            Selecciona la mejor opcion para cada material
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-1 space-y-4">
          <div>
            <div className="flex justify-between text-xs uppercase font-bold tracking-[0.1em] text-[var(--fg-muted)] mb-1">
              <span>Item {currentIdx + 1} de {totalItems}</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-[var(--bg-soft)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--primary)]" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] space-y-2">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="flex-1">
                <p className="text-lg font-black text-[var(--fg)]">
                  {[itemActual.codigo, itemActual.descripcion, formatMonto(itemActual.precio_unitario || 0)]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
                <p className="text-sm text-[var(--fg-muted)]">
                  {`Cantidad solicitada: ${itemActual.cantidad ?? "N/D"}`}
                </p>
              </div>
            </div>

            {/* Info adicional: Stock y Consumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(16,185,129,0.12)] flex items-center justify-center">
                  <Package className="w-4 h-4 text-[var(--success)]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-[var(--fg-muted)]">Stock disponible</p>
                    {itemActual.detalle_stock && itemActual.detalle_stock.length > 0 && (
                      <StockDetalleTooltip detalle={itemActual.detalle_stock} />
                    )}
                  </div>
                  <p className="text-sm font-bold text-[var(--fg)]">
                    {stockInfo.texto}
                    {stockInfo.valor !== null && stockInfo.valor < (itemActual.cantidad || 0) && (
                      <span className="ml-1 text-[var(--danger)] text-xs">Insuficiente</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(59,130,246,0.12)] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[var(--info)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--fg-muted)]">Consumo promedio Anual</p>
                  <p className="text-sm font-bold text-[var(--fg)]">
                    {itemActual.consumo_promedio_anual != null
                      ? Math.round(itemActual.consumo_promedio_anual)
                      : itemActual.consumo_promedio != null
                        ? Math.round(Number(itemActual.consumo_promedio) * 12)
                        : "N/D"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[rgba(251,146,60,0.12)] flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[var(--primary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--fg-muted)]">Costo total</p>
                  <p className="text-sm font-bold text-[var(--fg)]">
                    {formatMonto((itemActual.cantidad || 0) * (itemActual.precio_unitario || 0))}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {renderMrpBadge({ item: itemActual, mostrarMrp, setMostrarMrp })}
              </div>
            </div>
            {mostrarMrp && isMrpPlanificado(itemActual) && (
              <MrpDetalle item={itemActual} solicitud={solicitud} onClose={() => setMostrarMrp(false)} />
            )}
          </div>

          {/* Filtros por tipo */}
          {dataOpciones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroTipo("todos")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  filtroTipo === "todos"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Todas ({conteoTipos.todos})
              </button>
              {conteoTipos.stock > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("stock")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    filtroTipo === "stock"
                      ? "bg-green-600 text-white"
                      : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  Stock Interno ({conteoTipos.stock})
                </button>
              )}
              {conteoTipos.proveedor > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("proveedor")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    filtroTipo === "proveedor"
                      ? "bg-blue-600 text-white"
                      : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  Proveedores ({conteoTipos.proveedor})
                </button>
              )}
              {conteoTipos.equivalencia > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("equivalencia")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    filtroTipo === "equivalencia"
                      ? "bg-purple-600 text-white"
                      : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  Equivalencias ({conteoTipos.equivalencia})
                </button>
              )}
              {conteoTipos.mix > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("mix")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    filtroTipo === "mix"
                      ? "bg-orange-600 text-white"
                      : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  Mix ({conteoTipos.mix})
                </button>
              )}
            </div>
          )}

          {/* Toggle Vista Grid/Tabla */}
          {opcionesFiltradas.length > 0 && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVistaTabla(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  !vistaTabla
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Vista Grid
              </button>
              <button
                type="button"
                onClick={() => setVistaTabla(true)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  vistaTabla
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                Vista Tabla
              </button>
            </div>
          )}

          {loadingOpciones && dataOpciones.length === 0 ? (
            <div className="text-sm text-[var(--fg-muted)]">Cargando opciones...</div>
          ) : vistaTabla ? (
            <OpcionesTabla
              opciones={opcionesFiltradas}
              selected={selected}
              onSelect={(op) => onSelectDecision?.(currentIdx, op)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {opcionesFiltradas.map((op) => (
                <OpcionCard
                  key={op.opcion_id}
                  opcion={op}
                  selected={selected?.opcion_id === op.opcion_id}
                  onSelect={() => onSelectDecision?.(currentIdx, op)}
                  almacenSolicitud={solicitud?.almacen_virtual || solicitud?.almacen}
                  codigoMaterial={itemActual?.codigo}
                  descripcionMaterial={itemActual?.descripcion}
                />
              ))}
              {opcionesFiltradas.length === 0 && dataOpciones.length > 0 && (
                <div className="text-sm text-[var(--fg-muted)] col-span-2">
                  No hay opciones del tipo "{filtroTipo}". Intenta con otro filtro.
                </div>
              )}
              {dataOpciones.length === 0 && (
                <div className="text-sm text-[var(--fg-muted)] col-span-2">Sin opciones disponibles para este item.</div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={onPrev}>
              Volver
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => onChangeIdx?.(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  // Si hay más items, ir al siguiente item
                  if (currentIdx < totalItems - 1) {
                    onChangeIdx?.(currentIdx + 1);
                  }
                  // Si es el último item y todos decididos, ir al siguiente paso
                  else if (puedeAvanzar) {
                    onNext?.();
                  }
                }}
                disabled={currentIdx >= totalItems - 1 && !puedeAvanzar}
                title={
                  currentIdx < totalItems - 1
                    ? "Ir al siguiente item"
                    : !puedeAvanzar
                      ? `Faltan ${itemsPendientes} items por decidir`
                      : "Continuar al siguiente paso"
                }
              >
                {currentIdx < totalItems - 1
                  ? "Siguiente"
                  : puedeAvanzar
                    ? "Continuar"
                    : `Faltan ${itemsPendientes}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle>Resumen de decisiones</CardTitle>
          <CardDescription className="text-sm text-[var(--fg-muted)]">
            Seleccionadas {resumenDecisiones.length}/{totalItems}
          </CardDescription>

          {/* Barra de progreso global */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-[var(--fg-muted)] mb-1">
              <span>Progreso total</span>
              <span className="font-semibold">{porcentajeCompleto.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-[var(--bg-soft)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${porcentajeCompleto}%`,
                  backgroundColor: puedeAvanzar ? "var(--success)" : "var(--info)"
                }}
              />
            </div>
          </div>

          {/* Alerta si faltan items */}
          {!puedeAvanzar && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[var(--warning)]">
              <p className="text-xs font-semibold text-[var(--warning)]">
                Faltan {itemsPendientes} items por decidir
              </p>
            </div>
          )}

          {/* Éxito si está completo */}
          {puedeAvanzar && resumenDecisiones.length > 0 && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[rgba(16,185,129,0.12)] border border-[var(--success)]">
              <p className="text-xs font-semibold text-[var(--success)]">
                Todos los items decididos
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-1 space-y-3 max-h-96 overflow-y-auto">
          {resumenDecisiones.length === 0 && (
            <p className="text-sm text-[var(--fg-muted)]">Aun no seleccionaste opciones.</p>
          )}
          {resumenDecisiones.map((r) => (
            <div
              key={r.idx}
              className="p-3 rounded-lg border-2 border-[var(--success)] bg-[rgba(16,185,129,0.08)]"
            >
              <div className="flex justify-between text-sm font-semibold text-[var(--fg)]">
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[var(--success)]" />
                  Item {r.idx + 1}
                </span>
                <span>{r.item.codigo || "N/D"}</span>
              </div>
              <p className="text-xs text-[var(--fg-muted)]">{r.item.descripcion}</p>
              <p className="text-sm mt-2 font-medium text-[var(--success)]">
                {r.opcion?.nombre || r.opcion?.tipo} — {formatMonto(r.opcion?.precio_unitario || 0)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OpcionCard({ opcion, selected, onSelect, almacenSolicitud, codigoMaterial, descripcionMaterial }) {
  const [showStockModal, setShowStockModal] = useState(false);
  const isRecomendada = opcion.is_recomendada === true;
  const score = opcion.score_recomendacion || 0;
  const esStock = opcion.tipo === "stock" || opcion.tipo === "mix";
  const detalleStock = opcion.detalle_stock || [];

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={`text-left p-4 rounded-xl border-2 transition shadow-sm relative ${
          selected
            ? "border-[var(--primary)] bg-[rgba(59,130,246,0.1)]"
            : isRecomendada
            ? "border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 hover:border-amber-600"
            : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]"
        }`}
      >
        {/* Badge Recomendada */}
        {isRecomendada && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold shadow-md flex items-center gap-1">
            <span>⭐</span>
            <span>RECOMENDADA</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <div>
            <p className="text-sm uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">{opcion.tipo}</p>
            <p className="text-lg font-black text-[var(--fg)]">{opcion.nombre}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--fg)]">{formatMonto(opcion.precio_unitario || 0)}</p>
            <p className="text-xs text-[var(--fg-muted)]">Plazo {opcion.plazo_dias ?? "N/D"} d</p>
          </div>
        </div>

        <p className="text-sm text-[var(--fg-muted)] mt-2">{opcion.descripcion}</p>

        <div className="flex flex-wrap gap-3 text-xs text-[var(--fg-muted)] mt-3">
          <span>Disp: {opcion.cantidad_disponible ?? opcion.cantidad_solicitada ?? "N/D"}</span>
          <span>Compat: {opcion.compatibilidad_pct ?? 0}%</span>
          {opcion.rating ? <span>Rating: {opcion.rating}</span> : null}
          {score > 0 && (
            <span className={`font-semibold ${isRecomendada ? "text-amber-700 dark:text-amber-400" : "text-[var(--fg)]"}`}>
              Score: {score.toFixed(1)}/100
            </span>
          )}
        </div>

        {opcion.observaciones ? (
          <p className="text-xs text-[var(--fg)] mt-2">Nota: {opcion.observaciones}</p>
        ) : null}

        {/* Indicador visual de score */}
        {score > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${score}%`,
                  backgroundColor: isRecomendada ? "var(--warning)" : "var(--info)"
                }}
              />
            </div>
          </div>
        )}

        {/* Boton ver detalle de stock */}
        {esStock && detalleStock.length > 0 && (
          <div
            className="mt-3 pt-3 border-t border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStockModal(true);
              }}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--info)] hover:text-[var(--primary)] transition"
            >
              <MapPin className="w-3.5 h-3.5" />
              Ver detalle de ubicaciones ({detalleStock.length})
            </button>
          </div>
        )}
      </button>

      {/* Modal de detalle de stock */}
      <StockDetalleModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        detalleStock={detalleStock}
        almacenSolicitud={almacenSolicitud}
        codigoMaterial={codigoMaterial}
        descripcionMaterial={descripcionMaterial}
      />
    </>
  );
}

function OpcionesTabla({ opciones, selected, onSelect }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
            <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Seleccionar</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Opción</th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--fg)]">Precio U.</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Plazo</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Rating</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Compat.</th>
            <th className="px-4 py-3 text-center font-semibold text-[var(--fg)]">Score</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Disponibilidad</th>
          </tr>
        </thead>
        <tbody>
          {opciones.map((op) => {
            const isRecomendada = op.is_recomendada === true;
            const score = op.score_recomendacion || 0;
            const isSelected = selected?.opcion_id === op.opcion_id;

            return (
              <tr
                key={op.opcion_id}
                className={`border-b border-[var(--border)] transition hover:bg-[var(--bg-hover)] cursor-pointer ${
                  isSelected
                    ? "bg-[rgba(59,130,246,0.1)]"
                    : isRecomendada
                    ? "bg-[rgba(245,158,11,0.08)]"
                    : ""
                }`}
                onClick={() => onSelect(op)}
              >
                <td className="px-4 py-3">
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => onSelect(op)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isRecomendada && <span className="text-amber-600">⭐</span>}
                    <div>
                      <p className="font-semibold text-[var(--fg)]">{op.nombre}</p>
                      <p className="text-xs text-[var(--fg-muted)] uppercase">{op.tipo}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[var(--fg)]">
                  {formatMonto(op.precio_unitario || 0)}
                </td>
                <td className="px-4 py-3 text-center text-[var(--fg)]">
                  <span className={op.plazo_dias === 1 ? "text-green-600 font-semibold" : ""}>
                    {op.plazo_dias ?? "N/D"} días
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-[var(--fg)]">
                  {op.rating ? `${op.rating}/5` : "N/D"}
                </td>
                <td className="px-4 py-3 text-center text-[var(--fg)]">
                  {op.compatibilidad_pct ?? 0}%
                </td>
                <td className="px-4 py-3 text-center">
                  {score > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="font-bold"
                        style={{ color: isRecomendada ? "var(--warning)" : "var(--fg)" }}
                      >
                        {score.toFixed(1)}
                      </span>
                      <div className="w-16 h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${score}%`,
                            backgroundColor: isRecomendada ? "var(--warning)" : "var(--info)"
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    "N/D"
                  )}
                </td>
                <td className="px-4 py-3 text-left text-[var(--fg-muted)]">
                  {op.cantidad_disponible ?? op.cantidad_solicitada ?? "N/D"} unidades
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {opciones.length === 0 && (
        <div className="p-4 text-center text-sm text-[var(--fg-muted)]">
          No hay opciones disponibles
        </div>
      )}
    </div>
  );
}

function renderMrpBadge({ item, mostrarMrp, setMostrarMrp }) {
  const status = getMrpStatus(item);
  if (!status.planificado) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.12)] text-[var(--danger)] font-semibold text-xs uppercase tracking-[0.08em]">
        MRP: NO
      </span>
    );
  }

  const tone = status.warn ? "bg-amber-100 text-amber-800 animate-pulse" : "bg-[rgba(16,185,129,0.15)] text-green-700";
  return (
    <button
      type="button"
      onClick={() => setMostrarMrp?.(!mostrarMrp)}
      className={`w-full text-left px-3 py-2 rounded-lg border border-[var(--border)] ${tone} font-semibold text-xs uppercase tracking-[0.08em]`}
    >
      MRP: SI
      {status.warn ? (
        <span className="block normal-case text-[var(--fg)] font-normal text-xs mt-1">
          Stock + pedidos bajo punto de pedido
        </span>
      ) : null}
    </button>
  );
}

function MrpDetalle({ item, solicitud, onClose }) {
  const status = getMrpStatus(item);
  const d = status.detalle;
  const total = status.total;

  return (
    <div className="mt-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--fg)]">Detalle MRP</p>
        <button type="button" className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {status.warn ? (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm font-semibold">
          Alerta: stock actual + pedidos ({total}) esta por debajo del punto de pedido ({d.punto_pedido ?? "N/D"}). Revisar gestion MRP.
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MrpField label="Centro/Almacen" value={`${solicitud?.centro || "N/D"} / ${solicitud?.almacen_virtual || "N/D"}`} />
        <MrpField label="Stock de seguridad" value={d.stock_seguridad ?? "N/D"} />
        <MrpField label="Punto de pedido" value={d.punto_pedido ?? "N/D"} />
        <MrpField label="Stock maximo" value={d.stock_maximo ?? "N/D"} />
        <MrpField label="Stock actual (centro)" value={d.stock_actual ?? "N/D"} />
        <MrpField label="Pedidos en curso" value={d.pedidos_en_curso ?? "N/D"} />
        <MrpField label="Total stock + pedidos" value={total} />
      </div>
    </div>
  );
}

function MrpField({ label, value }) {
  return (
    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <p className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--fg-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--fg)]">{value}</p>
    </div>
  );
}

function getMrpStatus(item) {
  const detalle = item?.mrp_detalle || item?.mrp || {};
  const planificado =
    isTrueish(item?.mrp_planificado) ||
    isTrueish(detalle.planificado) ||
    isTrueish(detalle.estado) ||
    Object.keys(detalle).length > 0; // si hay parametros, asumimos planificado
  const stockActual = Number(detalle.stock_actual || 0);
  const pedidos = Number(detalle.pedidos_en_curso || 0);
  const punto = Number(detalle.punto_pedido || 0);
  const warn = planificado && punto > 0 && stockActual + pedidos < punto;
  return {
    planificado,
    warn,
    detalle,
    total: stockActual + pedidos,
  };
}

function isMrpPlanificado(item) {
  return getMrpStatus(item).planificado;
}

function isTrueish(val) {
  if (val === true) return true;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    return ["si", "sí", "true", "1", "planificado", "yes"].includes(normalized);
  }
  if (typeof val === "number") return val === 1;
  return false;
}

function StockDetalleTooltip({ detalle }) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setMostrar(true)}
        onMouseLeave={() => setMostrar(false)}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-help"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {mostrar && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-xl">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
            Stock por Almacén
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {detalle.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-1"
              >
                <span className="font-medium">
                  {item.almacen || item.centro || "Almacén"}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {item.cantidad || 0} un.
                </span>
              </div>
            ))}
          </div>
          {detalle.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No hay detalle de stock disponible
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getStockDisplay(item) {
  const detalle = item?.detalle_stock;
  const allowed = ["0100", "9999"];
  if (Array.isArray(detalle) && detalle.length > 0) {
    const totalAllowed = detalle
      .filter((d) => allowed.includes(String(d.almacen || d.centro || "").padStart(4, "0")))
      .reduce((acc, d) => acc + Number(d.cantidad || 0), 0);
    if (totalAllowed > 0) {
      return { texto: `${totalAllowed} un.`, valor: totalAllowed };
    }
    return { texto: "Stock requiere autorización", valor: null };
  }
  return { texto: "Stock requiere autorización", valor: null };
}

function formatMonto(val) {
  const num = Number(val || 0);
  return `USD ${num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
