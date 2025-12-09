import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { Warehouse, Truck, Plus, Edit2, Trash2, Check, X, MapPin, Phone, Mail, Star, Clock } from "lucide-react";

export default function AdminProveedores() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "externos" ? "externos" : "internos";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "externos" || tabParam === "internos") {
      setTab(tabParam);
    }
  }, [searchParams]);

  return (
    <div className="p-6 space-y-6">
      <ScrollReveal>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase">Proveedores</h1>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <div className="flex gap-2 border-b border-white/30 pb-2">
          <button
            onClick={() => setTab("internos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-sm transition ${
              tab === "internos"
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
            }`}
          >
            <Warehouse className="w-4 h-4" />
            Internos (Almacenes)
          </button>
          <button
            onClick={() => setTab("externos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-sm transition ${
              tab === "externos"
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
            }`}
          >
            <Truck className="w-4 h-4" />
            Externos
          </button>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={200}>
        {tab === "internos" ? (
          <ProveedoresInternos />
        ) : (
          <ProveedoresExternos />
        )}
      </ScrollReveal>
    </div>
  );
}

function ProveedoresInternos() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    centro: "",
    almacen: "",
    centro_nombre: "",
    almacen_nombre: "",
    sector: "",
    contacto_centro: "",
    responsable_centro: "",
    notas: ""
  });

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/admin/proveedores/internos");
      setProveedores(res.data);
    } catch (e) {
      console.error("Error fetching:", e);
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (centro, almacen, data) => {
    try {
      await api.put(`/admin/proveedores/internos/${centro}/${almacen}`, data);
      setEditingId(null);
      fetchData();
    } catch (e) {
      console.error("Error saving:", e);
    }
  };

  const handleAdd = async () => {
    if (!newForm.centro || !newForm.almacen) return;
    try {
      await api.post("/admin/proveedores/internos", newForm);
      setShowAdd(false);
      setNewForm({
        centro: "",
        almacen: "",
        centro_nombre: "",
        almacen_nombre: "",
        sector: "",
        contacto_centro: "",
        responsable_centro: "",
        notas: ""
      });
      fetchData();
    } catch (e) {
      console.error("Error adding:", e);
    }
  };

  const handleDelete = async (centro, almacen) => {
    if (!confirm("Desactivar este proveedor interno?")) return;
    try {
      await api.delete(`/admin/proveedores/internos/${centro}/${almacen}`);
      fetchData();
    } catch (e) {
      console.error("Error deleting:", e);
    }
  };

  if (loading) return <div className="text-slate-500">Cargando...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Proveedores Internos (Almacenes)</CardTitle>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4" />
          Agregar
        </Button>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg border border-white/30 bg-slate-100/70 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Centro *"
                value={newForm.centro}
                onChange={(e) => setNewForm({ ...newForm, centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Almacen *"
                value={newForm.almacen}
                onChange={(e) => setNewForm({ ...newForm, almacen: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Nombre Centro"
                value={newForm.centro_nombre}
                onChange={(e) => setNewForm({ ...newForm, centro_nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Nombre Almacen"
                value={newForm.almacen_nombre}
                onChange={(e) => setNewForm({ ...newForm, almacen_nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <input
                placeholder="Sector"
                value={newForm.sector}
                onChange={(e) => setNewForm({ ...newForm, sector: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Contacto (email)"
                value={newForm.contacto_centro}
                onChange={(e) => setNewForm({ ...newForm, contacto_centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Responsable"
                value={newForm.responsable_centro}
                onChange={(e) => setNewForm({ ...newForm, responsable_centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/30 text-left">
                <th className="px-4 py-3 font-semibold text-slate-800">Centro</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Almacen</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Centro Nombre</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Almacen Nombre</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Sector</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Responsable</th>
                <th className="px-4 py-3 font-semibold text-slate-800 text-center">Activo</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((prov) => {
                const key = `${prov.centro}_${prov.almacen}`;
                const isEditing = editingId === key;

                return (
                  <tr key={key} className="border-b border-white/30 hover:bg-white/50">
                    <td className="px-4 py-3 text-slate-800 font-mono">{prov.centro}</td>
                    <td className="px-4 py-3 text-slate-800 font-mono">{prov.almacen}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.centro_nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, centro_nombre: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800">{prov.centro_nombre || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.almacen_nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, almacen_nombre: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800">{prov.almacen_nombre || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.sector || ""}
                          onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800">{prov.sector || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.responsable_centro || ""}
                          onChange={(e) => setEditForm({ ...editForm, responsable_centro: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800">{prov.responsable_centro || prov.referente_nombre || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prov.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-emerald-600 text-xs font-semibold">
                          <Check className="w-3 h-3" /> Si
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-red-600 text-xs font-semibold">
                          <X className="w-3 h-3" /> No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(prov.centro, prov.almacen, editForm)}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:opacity-80"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-slate-100/70 text-slate-500 hover:bg-white/50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(key);
                              setEditForm({
                                centro_nombre: prov.centro_nombre,
                                almacen_nombre: prov.almacen_nombre,
                                sector: prov.sector,
                                responsable_centro: prov.responsable_centro,
                                contacto_centro: prov.contacto_centro,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-slate-100/70 text-slate-500 hover:bg-white/50 hover:text-slate-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(prov.centro, prov.almacen)}
                            className="p-1.5 rounded-lg bg-slate-100/70 text-red-600 hover:bg-[rgba(239,68,68,0.15)]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No hay proveedores internos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProveedoresExternos() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    cuit: "",
    nombre: "",
    direccion: "",
    localidad: "",
    pais: "Argentina",
    origen: "local",
    lead_time_dias: 7,
    rubro: "",
    calificacion: "sin_calificar"
  });

  const calificacionOptions = [
    { value: "sin_calificar", label: "Sin calificar", color: "bg-slate-100 text-slate-600" },
    { value: "cumplidor", label: "Cumplidor", color: "bg-emerald-100 text-emerald-600" },
    { value: "muy_cumplidor", label: "Muy cumplidor", color: "bg-green-100 text-green-600" },
    { value: "incumplidor", label: "Incumplidor", color: "bg-amber-100 text-amber-600" },
    { value: "muy_incumplidor", label: "Muy incumplidor", color: "bg-red-100 text-red-600" },
  ];

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/admin/proveedores/externos");
      setProveedores(res.data);
    } catch (e) {
      console.error("Error fetching:", e);
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (cuit, data) => {
    try {
      await api.put(`/admin/proveedores/externos/${encodeURIComponent(cuit)}`, data);
      setEditingId(null);
      fetchData();
    } catch (e) {
      console.error("Error saving:", e);
    }
  };

  const handleAdd = async () => {
    if (!newForm.cuit || !newForm.nombre) return;
    try {
      await api.post("/admin/proveedores/externos", newForm);
      setShowAdd(false);
      setNewForm({
        cuit: "",
        nombre: "",
        direccion: "",
        localidad: "",
        pais: "Argentina",
        origen: "local",
        lead_time_dias: 7,
        rubro: "",
        calificacion: "sin_calificar"
      });
      fetchData();
    } catch (e) {
      console.error("Error adding:", e);
    }
  };

  const handleDelete = async (cuit) => {
    if (!confirm("Desactivar este proveedor externo?")) return;
    try {
      await api.delete(`/admin/proveedores/externos/${encodeURIComponent(cuit)}`);
      fetchData();
    } catch (e) {
      console.error("Error deleting:", e);
    }
  };

  const getCalificacionBadge = (calif) => {
    const opt = calificacionOptions.find(o => o.value === calif) || calificacionOptions[0];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${opt.color}`}>
        <Star className="w-3 h-3" /> {opt.label}
      </span>
    );
  };

  if (loading) return <div className="text-slate-500">Cargando...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Proveedores Externos</CardTitle>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4" />
          Agregar
        </Button>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg border border-white/30 bg-slate-100/70 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="CUIT *"
                value={newForm.cuit}
                onChange={(e) => setNewForm({ ...newForm, cuit: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Nombre *"
                value={newForm.nombre}
                onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Rubro"
                value={newForm.rubro}
                onChange={(e) => setNewForm({ ...newForm, rubro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                type="number"
                placeholder="Lead Time (dias)"
                value={newForm.lead_time_dias}
                onChange={(e) => setNewForm({ ...newForm, lead_time_dias: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Direccion"
                value={newForm.direccion}
                onChange={(e) => setNewForm({ ...newForm, direccion: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <input
                placeholder="Localidad"
                value={newForm.localidad}
                onChange={(e) => setNewForm({ ...newForm, localidad: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              />
              <select
                value={newForm.origen}
                onChange={(e) => setNewForm({ ...newForm, origen: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              >
                <option value="local">Local</option>
                <option value="importado">Importado</option>
              </select>
              <select
                value={newForm.calificacion}
                onChange={(e) => setNewForm({ ...newForm, calificacion: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 bg-white/50 text-slate-800 text-sm"
              >
                {calificacionOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/30 text-left">
                <th className="px-4 py-3 font-semibold text-slate-800">CUIT</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Nombre</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Localidad</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Rubro</th>
                <th className="px-4 py-3 font-semibold text-slate-800 text-center">Lead Time</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Calificacion</th>
                <th className="px-4 py-3 font-semibold text-slate-800 text-center">Activo</th>
                <th className="px-4 py-3 font-semibold text-slate-800">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((prov) => {
                const isEditing = editingId === prov.cuit;

                return (
                  <tr key={prov.cuit} className="border-b border-white/30 hover:bg-white/50">
                    <td className="px-4 py-3 text-slate-800 font-mono text-xs">{prov.cuit}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800 font-medium">{prov.nombre}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.localidad || ""}
                          onChange={(e) => setEditForm({ ...editForm, localidad: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {prov.localidad || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.rubro || ""}
                          onChange={(e) => setEditForm({ ...editForm, rubro: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800">{prov.rubro || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.lead_time_dias}
                          onChange={(e) => setEditForm({ ...editForm, lead_time_dias: Number(e.target.value) })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm w-20 text-center"
                        />
                      ) : (
                        <span className="text-slate-800 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> {prov.lead_time_dias || "-"} dias
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.calificacion}
                          onChange={(e) => setEditForm({ ...editForm, calificacion: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 bg-white/50 text-slate-800 text-sm"
                        >
                          {calificacionOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        getCalificacionBadge(prov.calificacion)
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prov.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-emerald-600 text-xs font-semibold">
                          <Check className="w-3 h-3" /> Si
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-red-600 text-xs font-semibold">
                          <X className="w-3 h-3" /> No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(prov.cuit, editForm)}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:opacity-80"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-slate-100/70 text-slate-500 hover:bg-white/50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(prov.cuit);
                              setEditForm({
                                nombre: prov.nombre,
                                direccion: prov.direccion,
                                localidad: prov.localidad,
                                lead_time_dias: prov.lead_time_dias,
                                rubro: prov.rubro,
                                calificacion: prov.calificacion,
                                activo: prov.activo,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-slate-100/70 text-slate-500 hover:bg-white/50 hover:text-slate-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(prov.cuit)}
                            className="p-1.5 rounded-lg bg-slate-100/70 text-red-600 hover:bg-[rgba(239,68,68,0.15)]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No hay proveedores externos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
