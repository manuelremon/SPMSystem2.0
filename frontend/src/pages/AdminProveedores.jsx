import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ScrollReveal } from "../components/ui/ScrollReveal";
import { Warehouse, Truck, Plus, Edit2, Trash2, Check, X, MapPin, Phone, Mail, Star, Clock, User } from "../components/ui/Icons";
import { Tooltip } from "../components/ui/Tooltip";

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
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase">Proveedores</h1>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <div className="flex items-center gap-1 p-1 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-white/30 dark:border-slate-700/30 w-fit">
          <button
            onClick={() => setTab("internos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              tab === "internos"
                ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            <Warehouse className="w-4 h-4 text-indigo-500" />
            Internos (Almacenes)
          </button>
          <button
            onClick={() => setTab("externos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              tab === "externos"
                ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            <Truck className="w-4 h-4 text-indigo-500" />
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
    referente_nombre: "",
    referente_email: "",
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
        referente_nombre: "",
        referente_email: "",
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

  if (loading) return <div className="text-slate-500 dark:text-slate-400">Cargando...</div>;
  if (error) return <div className="text-red-500 dark:text-red-400">{error}</div>;

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
          <div className="mb-4 p-4 rounded-lg border border-white/30 dark:border-slate-700/30 bg-slate-100/70 dark:bg-slate-800/70 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Centro *"
                value={newForm.centro}
                onChange={(e) => setNewForm({ ...newForm, centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Almacen *"
                value={newForm.almacen}
                onChange={(e) => setNewForm({ ...newForm, almacen: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Nombre Centro"
                value={newForm.centro_nombre}
                onChange={(e) => setNewForm({ ...newForm, centro_nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Nombre Almacen"
                value={newForm.almacen_nombre}
                onChange={(e) => setNewForm({ ...newForm, almacen_nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Sector"
                value={newForm.sector}
                onChange={(e) => setNewForm({ ...newForm, sector: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Resp. Depósito"
                value={newForm.responsable_centro}
                onChange={(e) => setNewForm({ ...newForm, responsable_centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Contacto Centro (email)"
                type="email"
                value={newForm.contacto_centro}
                onChange={(e) => setNewForm({ ...newForm, contacto_centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Notas"
                value={newForm.notas}
                onChange={(e) => setNewForm({ ...newForm, notas: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
              <input
                placeholder="Referente (nombre)"
                value={newForm.referente_nombre}
                onChange={(e) => setNewForm({ ...newForm, referente_nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Referente (email)"
                type="email"
                value={newForm.referente_email}
                onChange={(e) => setNewForm({ ...newForm, referente_email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-white/30 dark:border-slate-700/30">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
              <tr>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '5%'}}>Centro</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '5%'}}>Almacén</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '14%'}}>Centro</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '11%'}}>Almacén</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '11%'}}>Sector</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '13%'}}>Resp. Depósito</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '12%'}}>Referente</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '16%'}}>Contacto</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700" style={{width: '5%'}}>Activo</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]" style={{width: '8%'}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((prov) => {
                const key = `${prov.centro}_${prov.almacen}`;
                const isEditing = editingId === key;

                return (
                  <tr key={key} className="border-b border-white/30 dark:border-slate-700/30 hover:bg-white/50 dark:hover:bg-slate-700/50">
                    <td className="px-2 py-2 text-center text-slate-800 dark:text-slate-200 font-mono text-xs overflow-hidden">{prov.centro}</td>
                    <td className="px-2 py-2 text-center text-slate-800 dark:text-slate-200 font-mono text-xs overflow-hidden">{prov.almacen}</td>
                    <td className="px-2 py-2 overflow-hidden">
                      {isEditing ? (
                        <input
                          value={editForm.centro_nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, centro_nombre: e.target.value })}
                          className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 text-xs block truncate">{prov.centro_nombre || "-"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      {isEditing ? (
                        <input
                          value={editForm.almacen_nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, almacen_nombre: e.target.value })}
                          className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 text-xs block truncate">{prov.almacen_nombre || "-"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      {isEditing ? (
                        <input
                          value={editForm.sector || ""}
                          onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                          className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 text-xs block truncate">{prov.sector || "-"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      {isEditing ? (
                        <input
                          value={editForm.responsable_centro || ""}
                          onChange={(e) => setEditForm({ ...editForm, responsable_centro: e.target.value })}
                          className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 text-xs block truncate">{prov.responsable_centro || "-"}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            value={editForm.referente_nombre || ""}
                            onChange={(e) => setEditForm({ ...editForm, referente_nombre: e.target.value })}
                            placeholder="Nombre"
                            className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                          />
                          <input
                            value={editForm.referente_email || ""}
                            onChange={(e) => setEditForm({ ...editForm, referente_email: e.target.value })}
                            placeholder="Email"
                            type="email"
                            className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                          />
                        </div>
                      ) : prov.referente_nombre ? (
                        <Tooltip content={prov.referente_email || "Sin email"} position="top">
                          <span className="text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1 cursor-help">
                            <User className="w-3 h-3 text-blue-500 flex-shrink-0" />
                            <span className="truncate">{prov.referente_nombre}</span>
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      {isEditing ? (
                        <input
                          value={editForm.contacto_centro || ""}
                          onChange={(e) => setEditForm({ ...editForm, contacto_centro: e.target.value })}
                          type="email"
                          className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs w-full"
                        />
                      ) : prov.contacto_centro ? (
                        <span className="text-slate-600 dark:text-slate-400 text-xs flex items-center gap-1">
                          <Mail className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                          <span className="truncate">{prov.contacto_centro}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {prov.activo ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-medium">
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <Button variant="success" size="icon-sm" onClick={() => handleSave(prov.centro, prov.almacen, editForm)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="icon" size="icon-sm" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="icon"
                            size="icon-sm"
                            onClick={() => {
                              setEditingId(key);
                              setEditForm({
                                centro_nombre: prov.centro_nombre,
                                almacen_nombre: prov.almacen_nombre,
                                sector: prov.sector,
                                responsable_centro: prov.responsable_centro,
                                referente_nombre: prov.referente_nombre,
                                referente_email: prov.referente_email,
                                contacto_centro: prov.contacto_centro,
                              });
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="icon-danger" size="icon-sm" onClick={() => handleDelete(prov.centro, prov.almacen)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
    { value: "sin_calificar", label: "Sin calificar", color: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400" },
    { value: "cumplidor", label: "Cumplidor", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" },
    { value: "muy_cumplidor", label: "Muy cumplidor", color: "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" },
    { value: "incumplidor", label: "Incumplidor", color: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" },
    { value: "muy_incumplidor", label: "Muy incumplidor", color: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" },
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

  if (loading) return <div className="text-slate-500 dark:text-slate-400">Cargando...</div>;
  if (error) return <div className="text-red-500 dark:text-red-400">{error}</div>;

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
          <div className="mb-4 p-4 rounded-lg border border-white/30 dark:border-slate-700/30 bg-slate-100/70 dark:bg-slate-800/70 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="CUIT *"
                value={newForm.cuit}
                onChange={(e) => setNewForm({ ...newForm, cuit: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Nombre *"
                value={newForm.nombre}
                onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Rubro"
                value={newForm.rubro}
                onChange={(e) => setNewForm({ ...newForm, rubro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                type="number"
                placeholder="Lead Time (dias)"
                value={newForm.lead_time_dias}
                onChange={(e) => setNewForm({ ...newForm, lead_time_dias: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Direccion"
                value={newForm.direccion}
                onChange={(e) => setNewForm({ ...newForm, direccion: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <input
                placeholder="Localidad"
                value={newForm.localidad}
                onChange={(e) => setNewForm({ ...newForm, localidad: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              />
              <select
                value={newForm.origen}
                onChange={(e) => setNewForm({ ...newForm, origen: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
              >
                <option value="local">Local</option>
                <option value="importado">Importado</option>
              </select>
              <select
                value={newForm.calificacion}
                onChange={(e) => setNewForm({ ...newForm, calificacion: e.target.value })}
                className="px-3 py-2 rounded-lg border border-white/30 dark:border-slate-700/30 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-sm"
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

        <div className="overflow-x-auto rounded-xl border border-white/30 dark:border-slate-700/30">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">CUIT</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">Nombre</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">Localidad</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">Rubro</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">Lead Time</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">Calificacion</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200 dark:border-slate-700">Activo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((prov) => {
                const isEditing = editingId === prov.cuit;

                return (
                  <tr key={prov.cuit} className="border-b border-white/30 dark:border-slate-700/30 hover:bg-white/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-mono text-xs">{prov.cuit}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{prov.nombre}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.localidad || ""}
                          onChange={(e) => setEditForm({ ...editForm, localidad: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-500" /> {prov.localidad || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.rubro || ""}
                          onChange={(e) => setEditForm({ ...editForm, rubro: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 text-sm w-full"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200">{prov.rubro || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.lead_time_dias}
                          onChange={(e) => setEditForm({ ...editForm, lead_time_dias: Number(e.target.value) })}
                          className="px-2 py-1 rounded border border-white/30 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 text-sm w-20 text-center"
                        />
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-500" /> {prov.lead_time_dias || "-"} dias
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.calificacion}
                          onChange={(e) => setEditForm({ ...editForm, calificacion: e.target.value })}
                          className="px-2 py-1 rounded border border-white/30 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 text-sm"
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
                        <div className="flex gap-1">
                          <Button
                            variant="success"
                            size="icon-sm"
                            onClick={() => handleSave(prov.cuit, editForm)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="icon"
                            size="icon-sm"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            variant="icon"
                            size="icon-sm"
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
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="icon-danger"
                            size="icon-sm"
                            onClick={() => handleDelete(prov.cuit)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
