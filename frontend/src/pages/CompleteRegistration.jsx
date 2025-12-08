import React, { useState } from "react";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { CheckCircle, Send } from "lucide-react";

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
      <PageHeader
        title="Completar Registro"
        subtitle="Completa los campos requeridos; el administrador validará la información antes de habilitar el acceso total."
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos para aprobación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Sector</label>
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
              <label className="text-sm font-medium text-slate-700">Centro</label>
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
              <label className="text-sm font-medium text-slate-700">Almacén</label>
              <Select
                name="almacen"
                value={form.almacen}
                onChange={handleChange}
                required
              >
                <option value="">Selecciona almacén</option>
                {almacenesEjemplo.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Jefe</label>
              <Input
                type="text"
                name="jefe"
                value={form.jefe}
                onChange={handleChange}
                placeholder="Nombre y apellido"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Gerente 1</label>
              <Input
                type="text"
                name="gerente1"
                value={form.gerente1}
                onChange={handleChange}
                placeholder="Nombre y apellido"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Gerente 2</label>
              <Input
                type="text"
                name="gerente2"
                value={form.gerente2}
                onChange={handleChange}
                placeholder="Nombre y apellido (opcional)"
              />
            </div>

            <div className="md:col-span-2 flex justify-end pt-4">
              <Button type="submit" disabled={status === "pending"}>
                <Send className="w-4 h-4" />
                {status === "pending" ? "Enviando..." : "Enviar para aprobación"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {status === "sent" && (
        <Alert variant="success" icon={CheckCircle}>
          Solicitud enviada. Un administrador revisará y aprobará tu alta.
        </Alert>
      )}
    </div>
  );
}
