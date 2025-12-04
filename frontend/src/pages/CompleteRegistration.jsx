import React, { useState } from "react";
import { Select } from "../components/ui/Select";

const sectoresEjemplo = ["Operaciones", "Logística", "Compras", "Mantenimiento"];
const centrosEjemplo = ["Centro A", "Centro B", "Centro C"];
const almacenesEjemplo = ["Almacén 1", "Almacén 2", "Almacén 3"];

export default function CompleteRegistration() {
  const [form, setForm] = useState({
    sector: "",
    centro: "",
    almacen: "",
    jefe: "",
    gerente1: "",
    gerente2: "",
  });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("pending");
    // Aquí se enviaría al backend para aprobación del administrador
    setTimeout(() => setStatus("sent"), 800);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] font-black text-primary-700">
          Completar registro de usuario
        </p>
        <h1 className="text-2xl font-black">Datos para aprobación</h1>
        <p className="text-sm text-slate-600">
          Completa los campos requeridos; el administrador validará la información antes de habilitar el acceso total.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs uppercase font-bold tracking-[0.08em]">Sector</label>
          <Select
            name="sector"
            value={form.sector}
            onChange={handleChange}
            required
          >
            <option value="">Selecciona sector</option>
            {sectoresEjemplo.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase font-bold tracking-[0.08em]">Centro</label>
          <Select
            name="centro"
            value={form.centro}
            onChange={handleChange}
            required
          >
            <option value="">Selecciona centro</option>
            {centrosEjemplo.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase font-bold tracking-[0.08em]">Almacen</label>
          <Select
            name="almacen"
            value={form.almacen}
            onChange={handleChange}
            required
          >
            <option value="">Selecciona almacen</option>
            {almacenesEjemplo.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase font-bold tracking-[0.08em]">Jefe</label>
          <input
            type="text"
            name="jefe"
            value={form.jefe}
            onChange={handleChange}
            className="w-full border-2 border-black px-3 py-3 text-sm rounded-none focus:ring-4 focus:ring-warning-500 focus:border-black outline-none"
            placeholder="Nombre y apellido"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase font-bold tracking-[0.08em]">Gerente 1</label>
          <input
            type="text"
            name="gerente1"
            value={form.gerente1}
            onChange={handleChange}
            className="w-full border-2 border-black px-3 py-3 text-sm rounded-none focus:ring-4 focus:ring-warning-500 focus:border-black outline-none"
            placeholder="Nombre y apellido"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase font-bold tracking-[0.08em]">Gerente 2</label>
          <input
            type="text"
            name="gerente2"
            value={form.gerente2}
            onChange={handleChange}
            className="w-full border-2 border-black px-3 py-3 text-sm rounded-none focus:ring-4 focus:ring-warning-500 focus:border-black outline-none"
            placeholder="Nombre y apellido"
          />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className="bg-warning-500 text-black px-5 py-3 border-2 border-black font-black uppercase tracking-[0.05em]"
            disabled={status === "pending"}
          >
            {status === "pending" ? "Enviando..." : "Enviar para aprobación"}
          </button>
        </div>
      </form>

      {status === "sent" && (
        <div className="border-2 border-black bg-primary-50 px-4 py-3 font-semibold text-black">
          Solicitud enviada. Un administrador revisará y aprobará tu alta.
        </div>
      )}
    </div>
  );
}
