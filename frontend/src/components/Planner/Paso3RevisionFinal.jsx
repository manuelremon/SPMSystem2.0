import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import StatusBadge from "../ui/StatusBadge";

export default function Paso3RevisionFinal({ solicitud, items = [], decisiones = {}, totalItems = 0, onBack, onConfirm, loading }) {
  const rows = useMemo(() => {
    return Object.entries(decisiones).map(([idx, op]) => {
      const item = items.find((it) => Number(it.idx) === Number(idx)) || {};
      const cantidad = op?.cantidad_solicitada ?? item.cantidad ?? 0;
      const costo = cantidad * (op?.precio_unitario || item.precio_unitario || 0);
      return { idx: Number(idx), op, item, cantidad, costo };
    });
  }, [decisiones, items]);

  const total = rows.reduce((acc, r) => acc + r.costo, 0);
  const maxPlazo = Math.max(...rows.map((r) => Number(r.op?.plazo_dias ?? 0)), 0);
  const proveedores = Array.from(new Set(rows.map((r) => r.op?.id_proveedor).filter(Boolean)));

  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle>Revision final</CardTitle>
        <CardDescription className="text-sm text-[var(--fg-muted)]">
          Confirma antes de guardar el tratamiento
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-1 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Info label="Estado" value={<StatusBadge estado={solicitud?.estado || solicitud?.status || "En progreso"} />} />
          <Info label="Items decididos" value={`${rows.length}/${totalItems}`} />
          <Info label="Costo total" value={formatMonto(total)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Info label="Plazo maximo" value={`${maxPlazo || "N/D"} dias`} />
          <Info label="Proveedores" value={proveedores.join(", ") || "N/D"} />
          <Info label="Centro / Sector" value={`${solicitud?.centro || "N/D"} / ${solicitud?.sector || "N/D"}`} />
        </div>

        <div className="overflow-auto border border-[var(--border)] rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-soft)] text-[var(--fg-muted)] uppercase text-xs tracking-[0.08em]">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">Codigo</th>
                <th className="text-left px-3 py-2">Opcion</th>
                <th className="text-left px-3 py-2">Cantidad</th>
                <th className="text-left px-3 py-2">P.U.</th>
                <th className="text-left px-3 py-2">Subtotal</th>
                <th className="text-left px-3 py-2">Plazo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-[var(--fg-muted)]" colSpan={7}>
                    Sin decisiones cargadas.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.idx} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-semibold text-[var(--fg)]">#{r.idx + 1}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">{r.item.codigo}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">{r.op?.nombre || r.op?.tipo}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">{r.cantidad}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">{formatMonto(r.op?.precio_unitario || 0)}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">{formatMonto(r.costo)}</td>
                  <td className="px-3 py-2 text-[var(--fg)]">{r.op?.plazo_dias ?? "N/D"} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" type="button" onClick={onBack}>
            Volver
          </Button>
          <Button variant="primary" type="button" onClick={onConfirm} disabled={loading || rows.length < totalItems}>
            {loading ? "Guardando..." : "Confirmar y guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }) {
  return (
    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]">
      <p className="text-xs uppercase font-bold tracking-[0.06em] text-[var(--fg-muted)]">{label}</p>
      <div className="text-sm font-semibold text-[var(--fg)] mt-1">{value}</div>
    </div>
  );
}

function formatMonto(val) {
  const num = Number(val || 0);
  return `USD ${num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
