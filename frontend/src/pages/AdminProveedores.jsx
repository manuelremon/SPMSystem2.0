import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Warehouse, Truck, Plus, Edit2, Trash2, Check, X, Building } from "lucide-react";
import { formatAlmacen } from "../utils/formatters";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function AdminProveedores() {
  const { token } = useAuthStore();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "externos" ? "externos" : "internos";
  const [tab, setTab] = useState(initialTab);

  // Update tab when URL param changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "externos" || tabParam === "internos") {
      setTab(tabParam);
    }
  }, [searchParams]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--fg)]">Proveedores</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Gestiona proveedores internos (almacenes) y externos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setTab("internos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-sm transition ${
            tab === "internos"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          }`}
        >
          <Warehouse className="w-4 h-4" />
          Internos (Almacenes)
        </button>
        <button
          onClick={() => setTab("externos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-sm transition ${
            tab === "externos"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          }`}
        >
          <Truck className="w-4 h-4" />
          Externos
        </button>
      </div>

      {tab === "internos" ? (
        <ProveedoresInternos token={token} />
      ) : (
        <ProveedoresExternos token={token} />
      )}
    </div>
  );
}

function ProveedoresInternos({ token }) {
  const [almacenes, setAlmacenes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ centro: "", almacen: "", nombre: "", libre_disponibilidad: false, responsable_id: "", excluido: false });

  const fetchData = useCallback(async () => {
    try {
      const [almRes, usrRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/proveedores/internos`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
        fetch(`${API_BASE}/api/admin/usuarios`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
      ]);
      if (almRes.ok) setAlmacenes(await almRes.json());
      if (usrRes.ok) setUsuarios(await usrRes.json());
    } catch (e) {
      console.error("Error fetching:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (centro, almacen, data) => {
    const res = await fetch(`${API_BASE}/api/admin/proveedores/internos/${centro}/${almacen}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditingId(null);
      fetchData();
    }
  };

  const handleAdd = async () => {
    if (!newForm.centro || !newForm.almacen) return;
    const res = await fetch(`${API_BASE}/api/admin/proveedores/internos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify(newForm),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewForm({ centro: "", almacen: "", nombre: "", libre_disponibilidad: false, responsable_id: "", excluido: false });
      fetchData();
    }
  };

  const handleDelete = async (centro, almacen) => {
    if (!confirm("Eliminar esta configuracion?")) return;
    await fetch(`${API_BASE}/api/admin/proveedores/internos/${centro}/${almacen}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    fetchData();
  };

  if (loading) return <div className="text-[var(--fg-muted)]">Cargando...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Configuracion de Almacenes</CardTitle>
          <CardDescription>Define politicas de disponibilidad por almacen</CardDescription>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar
        </Button>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                placeholder="Centro"
                value={newForm.centro}
                onChange={(e) => setNewForm({ ...newForm, centro: e.target.value })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
              />
              <input
                placeholder="Almacen"
                value={newForm.almacen}
                onChange={(e) => setNewForm({ ...newForm, almacen: e.target.value })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
              />
              <input
                placeholder="Nombre"
                value={newForm.nombre}
                onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
              />
              <select
                value={newForm.responsable_id}
                onChange={(e) => setNewForm({ ...newForm, responsable_id: e.target.value })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
              >
                <option value="">Sin responsable</option>
                {usuarios.map((u) => (
                  <option key={u.id_spm} value={u.id_spm}>
                    {u.nombre} {u.apellido}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
                <input
                  type="checkbox"
                  checked={newForm.libre_disponibilidad}
                  onChange={(e) => setNewForm({ ...newForm, libre_disponibilidad: e.target.checked })}
                  className="w-4 h-4"
                />
                Libre disponibilidad
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
                <input
                  type="checkbox"
                  checked={newForm.excluido}
                  onChange={(e) => setNewForm({ ...newForm, excluido: e.target.checked })}
                  className="w-4 h-4"
                />
                Excluido (no mostrar)
              </label>
              <Button onClick={handleAdd}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Centro</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Almacen</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Nombre</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)] text-center">Libre Disp.</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Responsable</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)] text-center">Excluido</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {almacenes.map((alm) => {
                const key = `${alm.centro}_${alm.almacen}`;
                const isEditing = editingId === key;

                return (
                  <tr key={key} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3 text-[var(--fg)]">{alm.centro}</td>
                    <td className="px-4 py-3 text-[var(--fg)] font-mono">{formatAlmacen(alm.almacen)}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm w-full"
                        />
                      ) : (
                        <span className="text-[var(--fg)]">{alm.nombre || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editForm.libre_disponibilidad}
                          onChange={(e) => setEditForm({ ...editForm, libre_disponibilidad: e.target.checked })}
                          className="w-4 h-4"
                        />
                      ) : alm.libre_disponibilidad ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[var(--success)] text-xs font-semibold">
                          <Check className="w-3 h-3" /> Si
                        </span>
                      ) : (
                        <span className="text-[var(--fg-muted)]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.responsable_id || ""}
                          onChange={(e) => setEditForm({ ...editForm, responsable_id: e.target.value })}
                          className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
                        >
                          <option value="">Sin responsable</option>
                          {usuarios.map((u) => (
                            <option key={u.id_spm} value={u.id_spm}>
                              {u.nombre} {u.apellido}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[var(--fg)]">{alm.responsable_display || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editForm.excluido}
                          onChange={(e) => setEditForm({ ...editForm, excluido: e.target.checked })}
                          className="w-4 h-4"
                        />
                      ) : alm.excluido ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-[var(--danger)] text-xs font-semibold">
                          <X className="w-3 h-3" /> Si
                        </span>
                      ) : (
                        <span className="text-[var(--fg-muted)]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(alm.centro, alm.almacen, editForm)}
                            className="p-1.5 rounded-lg bg-[var(--success)] text-white hover:opacity-80"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
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
                                nombre: alm.nombre,
                                libre_disponibilidad: !!alm.libre_disponibilidad,
                                responsable_id: alm.responsable_id || "",
                                excluido: !!alm.excluido,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(alm.centro, alm.almacen)}
                            className="p-1.5 rounded-lg bg-[var(--bg-soft)] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.15)]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProveedoresExternos({ token }) {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ nombre: "", plazo_entrega_dias: 7, rating: 3 });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/proveedores/externos`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) setProveedores(await res.json());
    } catch (e) {
      console.error("Error fetching:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (id, data) => {
    const res = await fetch(`${API_BASE}/api/admin/proveedores/externos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditingId(null);
      fetchData();
    }
  };

  const handleAdd = async () => {
    if (!newForm.nombre) return;
    const res = await fetch(`${API_BASE}/api/admin/proveedores/externos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify(newForm),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewForm({ nombre: "", plazo_entrega_dias: 7, rating: 3 });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Desactivar este proveedor?")) return;
    await fetch(`${API_BASE}/api/admin/proveedores/externos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    fetchData();
  };

  if (loading) return <div className="text-[var(--fg-muted)]">Cargando...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Proveedores Externos</CardTitle>
          <CardDescription>Gestiona proveedores de compra externa</CardDescription>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar
        </Button>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                placeholder="Nombre del proveedor"
                value={newForm.nombre}
                onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
              />
              <input
                type="number"
                placeholder="Plazo (dias)"
                value={newForm.plazo_entrega_dias}
                onChange={(e) => setNewForm({ ...newForm, plazo_entrega_dias: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
              />
              <input
                type="number"
                placeholder="Rating (1-5)"
                min="1"
                max="5"
                step="0.5"
                value={newForm.rating}
                onChange={(e) => setNewForm({ ...newForm, rating: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm"
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
              <tr className="border-b border-[var(--border)] text-left">
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">ID</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Nombre</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)] text-center">Plazo (dias)</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)] text-center">Rating</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)] text-center">Activo</th>
                <th className="px-4 py-3 font-semibold text-[var(--fg)]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((prov) => {
                const isEditing = editingId === prov.id_proveedor;

                return (
                  <tr key={prov.id_proveedor} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-3 text-[var(--fg)] font-mono">{prov.id_proveedor}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editForm.nombre || ""}
                          onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm w-full"
                        />
                      ) : (
                        <span className="text-[var(--fg)]">{prov.nombre}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.plazo_entrega_dias}
                          onChange={(e) => setEditForm({ ...editForm, plazo_entrega_dias: Number(e.target.value) })}
                          className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm w-20 text-center"
                        />
                      ) : (
                        <span className="text-[var(--fg)]">{prov.plazo_entrega_dias}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          max="5"
                          step="0.5"
                          value={editForm.rating}
                          onChange={(e) => setEditForm({ ...editForm, rating: Number(e.target.value) })}
                          className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] text-sm w-16 text-center"
                        />
                      ) : (
                        <span className="text-[var(--fg)]">{prov.rating}/5</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prov.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[var(--success)] text-xs font-semibold">
                          <Check className="w-3 h-3" /> Si
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-[var(--danger)] text-xs font-semibold">
                          <X className="w-3 h-3" /> No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(prov.id_proveedor, editForm)}
                            className="p-1.5 rounded-lg bg-[var(--success)] text-white hover:opacity-80"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(prov.id_proveedor);
                              setEditForm({
                                nombre: prov.nombre,
                                plazo_entrega_dias: prov.plazo_entrega_dias,
                                rating: prov.rating,
                                activo: prov.activo,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-[var(--bg-soft)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(prov.id_proveedor)}
                            className="p-1.5 rounded-lg bg-[var(--bg-soft)] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.15)]"
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
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--fg-muted)]">
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
