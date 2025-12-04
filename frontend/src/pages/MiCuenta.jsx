import { useEffect, useState } from "react";
import * as account from "../services/account";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Alert } from "../components/ui/Alert";
import { FormSkeleton } from "../components/ui/Skeleton";
import { X, MessageSquare, Send } from "lucide-react";

const initialPending = {
  sector_nuevo: "",
  centros_nuevos: [],
  almacenes_nuevos: [],
  jefe_nuevo: "",
  gerente1_nuevo: "",
  gerente2_nuevo: "",
};

export default function MiCuenta() {
  const [profile, setProfile] = useState({});
  const [catalogos, setCatalogos] = useState({ sectores: [], centros: [], almacenes: [], usuarios: [] });
  const [pendingChanges, setPendingChanges] = useState(initialPending);
  const [solicitudes, setSolicitudes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [mailBackup, setMailBackup] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");

  const [passwordForm, setPasswordForm] = useState({ nueva: "", repetir: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const [savingRequest, setSavingRequest] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [messageToAdmin, setMessageToAdmin] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [cancelingRequest, setCancelingRequest] = useState(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([loadProfile(), loadCatalogs(), loadSolicitudes()]);
      } catch (err) {
        console.error("MiCuenta init error:", err);
        setError("No se pudo cargar Mi Cuenta. Intenta recargar.");
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    const res = await account.getProfile();
    const data = res.data || {};
    setProfile(data);
    setPhone(data.telefono || "");
    setMailBackup(data.mail_respaldo || "");
  };

  const loadCatalogs = async () => {
    try {
      const [sectores, centros, almacenes, usuarios] = await Promise.all([
        account.catalogs.sectores(),
        account.catalogs.centros(),
        account.catalogs.almacenes(),
        account.catalogs.usuarios().catch(() => ({ data: [] })), // opcional
      ]);
      setCatalogos({
        sectores: sectores.data || [],
        centros: centros.data || [],
        almacenes: almacenes.data || [],
        usuarios: usuarios.data || [],
      });
    } catch (err) {
      console.error("Catalogos Mi Cuenta:", err);
      setError("No se pudieron cargar catalogos.");
    }
  };

  const loadSolicitudes = async () => {
    try {
      const res = await account.getProfileChanges();
      setSolicitudes(res.data || []);
    } catch (err) {
      console.error("Solicitudes perfil:", err);
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordMessage("");
  };

  const submitSecurity = async () => {
    const hasPassword = passwordForm.nueva || passwordForm.repetir;
    const backupChanged = mailBackup.trim() !== (profile.mail_respaldo || "");

    if (!hasPassword && !backupChanged) {
      setPasswordMessage("Completa una nueva contrasena o mail de respaldo.");
      return;
    }

    if (hasPassword && (passwordForm.nueva || "").length < 8) {
      setPasswordMessage("La contrasena debe tener al menos 8 caracteres.");
      return;
    }
    if (hasPassword && passwordForm.nueva !== passwordForm.repetir) {
      setPasswordMessage("Las contrasenas no coinciden.");
      return;
    }

    setSavingPassword(true);
    setPasswordMessage("");
    try {
      if (hasPassword) {
        await account.updatePassword({
          password_nueva: passwordForm.nueva,
          password_nueva_repetida: passwordForm.repetir,
        });
        setPasswordForm({ nueva: "", repetir: "" });
      }

      if (backupChanged) {
        await account.updateContact({ mail_respaldo: mailBackup.trim() });
        setProfile((prev) => ({ ...prev, mail_respaldo: mailBackup.trim() }));
      }

      const successMsgs = [];
      if (hasPassword) successMsgs.push("Contrasena actualizada");
      if (backupChanged) successMsgs.push("Mail de respaldo actualizado");
      setPasswordMessage(`${successMsgs.join(" | ")}.`);
    } catch (err) {
      console.error("Security update:", err);
      setPasswordMessage(err.response?.data?.error?.message || "No se pudo actualizar.");
    } finally {
      setSavingPassword(false);
    }
  };

  const submitPhone = async () => {
    const phoneClean = phone.trim();
    if (!/^[0-9+\s-]{6,}$/.test(phoneClean)) {
      setPhoneMessage("Telefono invalido.");
      return;
    }
    setSavingPhone(true);
    setPhoneMessage("");
    try {
      await account.updateContact({ telefono: phoneClean });
      setPhoneMessage("Telefono actualizado.");
    } catch (err) {
      console.error("Phone update:", err);
      setPhoneMessage(err.response?.data?.error?.message || "No se pudo actualizar.");
    } finally {
      setSavingPhone(false);
    }
  };

  const onMultiSelect = (e, field) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    setPendingChanges((prev) => ({ ...prev, [field]: values }));
    setRequestMessage("");
  };

  const submitProfileRequest = async () => {
    setSavingRequest(true);
    setRequestMessage("");
    try {
      await account.requestProfileChange(pendingChanges);
      setRequestMessage("Solicitud enviada para aprobacion.");
      setPendingChanges(initialPending);
      await loadSolicitudes();
    } catch (err) {
      console.error("Solicitud cambio perfil:", err);
      setRequestMessage(err.response?.data?.error?.message || "No se pudo enviar la solicitud.");
    } finally {
      setSavingRequest(false);
    }
  };

  const handleCancelRequest = async (solicitud) => {
    if (!confirm(`¿Cancelar solicitud de cambio de perfil del ${solicitud.fecha}?`)) return;

    setCancelingRequest(solicitud.id);
    try {
      await account.cancelProfileRequest(solicitud.id);
      setRequestMessage("Solicitud cancelada exitosamente.");
      await loadSolicitudes();
      setTimeout(() => setRequestMessage(""), 3000);
    } catch (err) {
      console.error("Error cancelando solicitud:", err);
      setRequestMessage(err.response?.data?.error?.message || "No se pudo cancelar la solicitud.");
    } finally {
      setCancelingRequest(null);
    }
  };

  const handleOpenMessageModal = (solicitud) => {
    setSelectedSolicitud(solicitud);
    setMessageToAdmin("");
    setMessageModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageToAdmin.trim()) {
      alert("Escribe un mensaje antes de enviar.");
      return;
    }

    setSendingMessage(true);
    try {
      await account.sendMessageToAdmin(selectedSolicitud.id, { mensaje: messageToAdmin.trim() });
      setRequestMessage("Mensaje enviado al administrador.");
      setMessageModalOpen(false);
      setMessageToAdmin("");
      setTimeout(() => setRequestMessage(""), 3000);
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      alert(err.response?.data?.error?.message || "No se pudo enviar el mensaje.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="MI CUENTA" />
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">Datos de identidad</CardTitle>
            </CardHeader>
            <CardContent><FormSkeleton rows={3} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">Datos de contacto</CardTitle>
            </CardHeader>
            <CardContent><FormSkeleton rows={3} /></CardContent>
          </Card>
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">Seguridad</CardTitle>
            </CardHeader>
            <CardContent><FormSkeleton rows={4} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">Configuracion sujeta a aprobacion</CardTitle>
            </CardHeader>
            <CardContent><FormSkeleton rows={8} /></CardContent>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="MI CUENTA" />
      {error && <Alert variant="danger" onDismiss={() => setError("")}>{error}</Alert>}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-black">Datos de identidad</CardTitle>
              <CardDescription className="text-sm text-[var(--fg-muted)]">Informacion personal y de cuenta</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <ReadOnlyField label="Nombre y Apellido" value={profile.nombre_apellido || "-"} />
              <ReadOnlyField label="ID Usuario SPM" value={profile.id_usuario_spm || "-"} />
              <ReadOnlyField label="Nombre Usuario" value={profile.nombre_usuario || "-"} />
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-black">Datos de contacto</CardTitle>
              <CardDescription className="text-sm text-[var(--fg-muted)]">Mail y telefono</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <ReadOnlyField label="Mail" value={profile.mail || "-"} />
              <Field label="Telefono">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                  placeholder="+34 600 000 000"
                />
              </Field>
              {phoneMessage && <p className="text-sm text-[var(--fg-muted)]">{phoneMessage}</p>}
              <div className="flex justify-end">
                <Button className="px-5 py-3" disabled={savingPhone} onClick={submitPhone} type="button">
                  {savingPhone ? "Guardando..." : "Guardar contacto"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-black">Seguridad</CardTitle>
              <CardDescription className="text-sm text-[var(--fg-muted)]">Contrasena y mail de respaldo</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <Field label="Nueva contrasena">
                <input
                  type="password"
                  value={passwordForm.nueva}
                  onChange={(e) => handlePasswordChange("nueva", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                  placeholder="Min 8 caracteres"
                />
              </Field>
              <Field label="Repetir nueva contrasena">
                <input
                  type="password"
                  value={passwordForm.repetir}
                  onChange={(e) => handlePasswordChange("repetir", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                  placeholder="Repite la contrasena"
                />
              </Field>
              <Field label="Mail de respaldo">
                <input
                  type="email"
                  value={mailBackup}
                  onChange={(e) => setMailBackup(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                  placeholder="ejemplo@respaldo.com"
                />
              </Field>
              {passwordMessage && <p className="text-sm text-[var(--fg-muted)]">{passwordMessage}</p>}
              <div className="flex justify-end">
                <Button className="px-5 py-3" disabled={savingPassword} onClick={submitSecurity} type="button">
                  {savingPassword ? "Guardando..." : "Guardar seguridad"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-black">Configuracion sujeta a aprobacion</CardTitle>
              <CardDescription className="text-sm text-[var(--fg-muted)]">Solicita cambios de sector, centros y responsables</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <Field label="Rol SPM">
                <ReadOnlyField label="" value={profile.rol_spm || "-"} />
              </Field>
              <Field label="Sector actual">
                <input
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-sm text-[var(--fg)]"
                  value={profile.sector_actual || "-"}
                  readOnly
                />
              </Field>
              <Field label="Solicitar cambio de Sector">
                <Select value={pendingChanges.sector_nuevo} onChange={(e) => setPendingChanges((prev) => ({ ...prev, sector_nuevo: e.target.value }))}>
                  <option value="">Sin cambio</option>
                  {(catalogos.sectores || []).map((s) => (
                    <option key={s.id} value={s.id}>{`${s.id} - ${s.nombre || s.descripcion || ""}`}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Centros actuales">
                <ReadOnlyField label="" value={(profile.centros_actuales || []).join(", ") || "-"} />
              </Field>
              <Field label="Solicitar acceso a nuevos Centros">
                <select
                  multiple
                  value={pendingChanges.centros_nuevos}
                  onChange={(e) => onMultiSelect(e, "centros_nuevos")}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none h-28"
                >
                  {(catalogos.centros || []).map((c) => (
                    <option key={c.id} value={c.id}>{`${c.id} - ${c.nombre || c.descripcion || ""}`}</option>
                  ))}
                </select>
              </Field>

              <Field label="Almacenes actuales">
                <ReadOnlyField label="" value={(profile.almacenes_actuales || []).join(", ") || "-"} />
              </Field>
              <Field label="Solicitar acceso a nuevos Almacenes">
                <select
                  multiple
                  value={pendingChanges.almacenes_nuevos}
                  onChange={(e) => onMultiSelect(e, "almacenes_nuevos")}
                  className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none h-28"
                >
                  {(catalogos.almacenes || []).map((a) => (
                    <option key={a.id} value={a.id}>{`${a.id} - ${a.nombre || a.descripcion || ""}`}</option>
                  ))}
                </select>
              </Field>

              <Field label="Jefe actual">
                <ReadOnlyField label="" value={profile.jefe_actual || "-"} />
              </Field>
              <Field label="Solicitar cambio de Jefe">
                <Select value={pendingChanges.jefe_nuevo} onChange={(e) => setPendingChanges((prev) => ({ ...prev, jefe_nuevo: e.target.value }))}>
                  <option value="">Sin cambio</option>
                  {(catalogos.usuarios || []).map((u) => (
                    <option key={u.id} value={u.id}>{`${u.nombre || u.username || u.id}`}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Gerente 1 actual">
                <ReadOnlyField label="" value={profile.gerente1_actual || "-"} />
              </Field>
              <Field label="Solicitar cambio Gerente 1">
                <Select value={pendingChanges.gerente1_nuevo} onChange={(e) => setPendingChanges((prev) => ({ ...prev, gerente1_nuevo: e.target.value }))}>
                  <option value="">Sin cambio</option>
                  {(catalogos.usuarios || []).map((u) => (
                    <option key={u.id} value={u.id}>{`${u.nombre || u.username || u.id}`}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Gerente 2 actual">
                <ReadOnlyField label="" value={profile.gerente2_actual || "-"} />
              </Field>
              <Field label="Solicitar cambio Gerente 2">
                <Select value={pendingChanges.gerente2_nuevo} onChange={(e) => setPendingChanges((prev) => ({ ...prev, gerente2_nuevo: e.target.value }))}>
                  <option value="">Sin cambio</option>
                  {(catalogos.usuarios || []).map((u) => (
                    <option key={u.id} value={u.id}>{`${u.nombre || u.username || u.id}`}</option>
                  ))}
                </Select>
              </Field>

              {requestMessage && <p className="text-sm text-[var(--fg-muted)]">{requestMessage}</p>}
              <div className="flex justify-end">
                <Button className="px-5 py-3" disabled={savingRequest} onClick={submitProfileRequest} type="button">
                  {savingRequest ? "Enviando..." : "Solicitar actualizacion de datos de perfil"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg font-black">Solicitudes de actualizacion de perfil</CardTitle>
              <CardDescription className="text-sm text-[var(--fg-muted)]">Historial de cambios solicitados</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              {solicitudes.length === 0 && <p className="text-sm text-[var(--fg-muted)]">Sin solicitudes pendientes.</p>}
              {solicitudes.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--bg-soft)] text-[var(--fg)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-black uppercase tracking-[0.04em] text-[var(--fg-muted)]">Fecha</th>
                        <th className="px-3 py-2 text-left font-black uppercase tracking-[0.04em] text-[var(--fg-muted)]">Campos</th>
                        <th className="px-3 py-2 text-left font-black uppercase tracking-[0.04em] text-[var(--fg-muted)]">Estado</th>
                        <th className="px-3 py-2 text-left font-black uppercase tracking-[0.04em] text-[var(--fg-muted)]">Comentario</th>
                        <th className="px-3 py-2 text-center font-black uppercase tracking-[0.04em] text-[var(--fg-muted)]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitudes.map((s, idx) => (
                        <tr key={s.id || s.fecha} className={idx % 2 ? "bg-[var(--bg-soft)]" : "bg-[var(--card)]"}>
                          <td className="px-3 py-2 text-[var(--fg)] border-b border-[var(--border)]">{s.fecha || "-"}</td>
                          <td className="px-3 py-2 text-[var(--fg)] border-b border-[var(--border)]">{(s.campos || []).join(", ") || "-"}</td>
                          <td className="px-3 py-2 border-b border-[var(--border)]">{renderEstadoBadge(s.estado)}</td>
                          <td className="px-3 py-2 text-[var(--fg)] border-b border-[var(--border)]">{s.comentario || "-"}</td>
                          <td className="px-3 py-2 border-b border-[var(--border)]">
                            <div className="flex items-center justify-center gap-2">
                              {s.estado === "pendiente" && (
                                <button
                                  onClick={() => handleCancelRequest(s)}
                                  disabled={cancelingRequest === s.id}
                                  className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                                  title="Cancelar solicitud"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenMessageModal(s)}
                                className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--primary)] transition-colors"
                                title="Enviar mensaje al admin"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      {/* Modal para enviar mensaje al admin */}
      {messageModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[var(--fg)]">Mensaje al Administrador</h3>
              <button
                onClick={() => setMessageModalOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-[var(--fg-muted)]">
                Solicitud del {selectedSolicitud?.fecha || "-"}
              </p>
              <p className="text-sm text-[var(--fg-muted)]">
                Estado: <StatusBadge estado={selectedSolicitud?.estado || "pendiente"} className="px-2 py-1 ml-1" />
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase font-bold tracking-[0.06em] text-[var(--fg-muted)]">
                Tu mensaje
              </label>
              <textarea
                value={messageToAdmin}
                onChange={(e) => setMessageToAdmin(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none resize-none"
                rows={4}
                placeholder="Escribe tu mensaje al administrador..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setMessageModalOpen(false)}
                disabled={sendingMessage}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageToAdmin.trim()}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sendingMessage ? "Enviando..." : "Enviar mensaje"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs uppercase font-bold tracking-[0.06em] text-[var(--fg-muted)]">{label}</p>}
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <p className="text-sm text-[var(--fg-muted)]">{label}</p>}
      <input className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] text-sm text-[var(--fg)]" value={value} readOnly />
    </div>
  );
}

function renderEstadoBadge(estado) {
  return <StatusBadge estado={estado || "pendiente"} className="px-2 py-1" />;
}
