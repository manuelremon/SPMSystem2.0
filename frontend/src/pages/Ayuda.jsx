import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import {
  Send,
  Book,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  Workflow,
  Settings,
  Package,
} from "../components/ui/Icons";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

export default function Ayuda() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("contacto");
  const [formData, setFormData] = useState({
    asunto: "",
    mensaje: "",
    tipo: "consulta",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      // Enviar mensaje al administrador
      await api.post("/mensajes/send", {
        destinatario_id: "admin", // El admin recibirá el mensaje
        asunto: `[Ayuda - ${formData.tipo.toUpperCase()}] ${formData.asunto}`,
        cuerpo: `
Usuario: ${user?.nombre || user?.username}
Email: ${user?.email}
Tipo: ${formData.tipo}

Mensaje:
${formData.mensaje}
        `.trim(),
      });

      setSent(true);
      setFormData({ asunto: "", mensaje: "", tipo: "consulta" });
    } catch (err) {
      setError("No se pudo enviar el mensaje. Intenta de nuevo.");
      console.error("Error enviando ayuda:", err);
    } finally {
      setSending(false);
    }
  };

  const tabs = [
    { id: "contacto", label: "Contactar Administrador", icon: Send },
    { id: "instrucciones", label: "Instrucciones de Uso", icon: Book },
    { id: "urgente", label: "Ayuda Urgente", icon: AlertTriangle },
  ];

  const instrucciones = [
    {
      titulo: "Crear una Nueva Solicitud",
      icon: FileText,
      pasos: [
        "Ve a 'Solicitudes' > 'Nueva Solicitud' en el menú superior",
        "Completa los datos del formulario: centro, sector, justificación",
        "Agrega los materiales que necesitas usando el buscador",
        "Revisa el resumen y haz clic en 'Enviar Solicitud'",
        "La solicitud pasará a estado 'Enviada' para aprobación",
      ],
    },
    {
      titulo: "Ver Mis Solicitudes",
      icon: Package,
      pasos: [
        "Ve a 'Solicitudes' > 'Mis Solicitudes'",
        "Filtra por estado: Borradores, Enviadas, Aprobadas, etc.",
        "Haz clic en 'Ver' para ver los detalles de una solicitud",
        "Puedes editar o eliminar solicitudes en estado 'Borrador'",
      ],
    },
    {
      titulo: "Aprobar Solicitudes",
      icon: CheckCircle,
      pasos: [
        "Ve a 'Aprobaciones' en el menú superior",
        "Verás las solicitudes pendientes de tu aprobación",
        "Revisa los detalles, materiales y montos",
        "Haz clic en 'Aprobar' o 'Rechazar' según corresponda",
        "Si rechazas, debes indicar el motivo",
      ],
    },
    {
      titulo: "Panel de Planificación",
      icon: Workflow,
      pasos: [
        "Accede a 'Planificador' en el menú (solo planificadores)",
        "Verás las solicitudes aprobadas asignadas a ti",
        "Trata cada solicitud: asigna materiales, cantidades y almacenes",
        "Finaliza el tratamiento para completar el proceso",
      ],
    },
    {
      titulo: "Configurar Mi Cuenta",
      icon: Settings,
      pasos: [
        "Haz clic en tu nombre en la esquina superior derecha",
        "Selecciona 'Mi Cuenta'",
        "Aquí puedes actualizar tu información personal",
        "Cambiar tu contraseña o preferencias",
      ],
    },
  ];

  const faqs = [
    {
      pregunta: "¿Cómo puedo editar una solicitud ya enviada?",
      respuesta: "Las solicitudes enviadas no pueden editarse. Si necesitas hacer cambios, solicita al aprobador que la rechace para que vuelva a estado Borrador, o crea una nueva solicitud.",
    },
    {
      pregunta: "¿Por qué no veo el botón de aprobar en las solicitudes?",
      respuesta: "El botón de aprobar solo aparece si tienes rol de aprobador y la solicitud está asignada a ti. Contacta al administrador si crees que deberías poder aprobar.",
    },
    {
      pregunta: "¿Cómo agrego materiales que no aparecen en el buscador?",
      respuesta: "Si un material no aparece, puede que no esté en el catálogo del sistema. Contacta al administrador para que lo agregue.",
    },
    {
      pregunta: "¿Qué significa cada estado de solicitud?",
      respuesta: "Borrador: aún no enviada. Enviada: esperando aprobación. Aprobada: lista para planificación. Rechazada: requiere revisión. En Proceso: siendo planificada. Completada: entregada.",
    },
    {
      pregunta: "¿Puedo cancelar una solicitud después de enviarla?",
      respuesta: "No puedes cancelar directamente. Debes solicitar al aprobador que la rechace, o contactar al administrador para casos especiales.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="CENTRO DE AYUDA"
        description="Obtén asistencia, aprende a usar el sistema o contacta al administrador"
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Contacto */}
        {activeTab === "contacto" && (
          <>
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-violet-500" />
                    Enviar Mensaje al Administrador
                  </CardTitle>
                  <CardDescription>
                    Completa el formulario para enviar tu consulta o reporte
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sent ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Mensaje Enviado
                      </h3>
                      <p className="text-slate-500 mb-4">
                        Tu mensaje ha sido enviado al administrador. Recibirás una respuesta pronto.
                      </p>
                      <Button onClick={() => setSent(false)}>
                        Enviar otro mensaje
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">
                          Tipo de Consulta
                        </label>
                        <Select
                          value={formData.tipo}
                          onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        >
                          <option value="consulta">Consulta General</option>
                          <option value="problema">Reportar Problema</option>
                          <option value="sugerencia">Sugerencia</option>
                          <option value="acceso">Problema de Acceso</option>
                          <option value="otro">Otro</option>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">
                          Asunto
                        </label>
                        <Input
                          type="text"
                          value={formData.asunto}
                          onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                          placeholder="Describe brevemente tu consulta"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">
                          Mensaje
                        </label>
                        <Textarea
                          value={formData.mensaje}
                          onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                          placeholder="Describe tu consulta o problema en detalle..."
                          required
                          rows={6}
                          className="resize-none"
                        />
                      </div>

                      {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
                          {error}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={sending}
                        className="w-full"
                      >
                        {sending ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 text-blue-600" />
                            Enviar Mensaje
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Información de Contacto */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Información de Contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-violet-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Email</p>
                      <p className="text-sm text-slate-500">solicitudespuntualesmateriales@gmail.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Teléfono</p>
                      <p className="text-sm text-slate-500">+54 11 1234-5678</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-cyan-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">Horario de Atención</p>
                      <p className="text-sm text-slate-500">Lun - Vie: 8:00 - 18:00</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Preguntas Frecuentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {faqs.slice(0, 3).map((faq, idx) => (
                    <button
                      key={idx}
                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      className="w-full text-left p-3 rounded-lg bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">{faq.pregunta}</span>
                        {expandedFaq === idx ? (
                          <ChevronDown className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        )}
                      </div>
                      {expandedFaq === idx && (
                        <p className="mt-2 text-sm text-slate-500">{faq.respuesta}</p>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Instrucciones de Uso */}
        {activeTab === "instrucciones" && (
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {instrucciones.map((instruccion, idx) => {
                const Icon = instruccion.icon;
                return (
                  <Card key={idx}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-blue-500" />
                        {instruccion.titulo}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-2">
                        {instruccion.pasos.map((paso, pasoIdx) => (
                          <li key={pasoIdx} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-600 text-xs font-bold flex items-center justify-center">
                              {pasoIdx + 1}
                            </span>
                            <span className="text-sm text-slate-500">{paso}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* FAQs Completas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  Preguntas Frecuentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {faqs.map((faq, idx) => (
                  <button
                    key={idx}
                    onClick={() => setExpandedFaq(expandedFaq === `faq-${idx}` ? null : `faq-${idx}`)}
                    className="w-full text-left p-4 rounded-lg bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-slate-800">{faq.pregunta}</span>
                      {expandedFaq === `faq-${idx}` ? (
                        <ChevronDown className="w-5 h-5 text-slate-600 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                    {expandedFaq === `faq-${idx}` && (
                      <p className="mt-3 text-slate-500 border-t border-white/30 pt-3">
                        {faq.respuesta}
                      </p>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ayuda Urgente */}
        {activeTab === "urgente" && (
          <div className="lg:col-span-3">
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="w-6 h-6" />
                  Ayuda Urgente
                </CardTitle>
                <CardDescription>
                  Para situaciones críticas que requieren atención inmediata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contacto de Emergencia */}
                  <div className="p-6 rounded-xl bg-white border border-white/30">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-blue-500" />
                      Contacto de Emergencia
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-slate-50/70">
                        <p className="text-sm text-slate-500">Línea directa soporte:</p>
                        <p className="text-lg font-mono font-bold text-blue-500">+54 11 1234-5678</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50/70">
                        <p className="text-sm text-slate-500">WhatsApp urgencias:</p>
                        <p className="text-lg font-mono font-bold text-emerald-500">+54 9 11 9876-5432</p>
                      </div>
                    </div>
                  </div>

                  {/* Situaciones Urgentes */}
                  <div className="p-6 rounded-xl bg-white border border-white/30">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      ¿Cuándo usar Ayuda Urgente?
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm text-slate-500">
                        <span className="text-amber-500">•</span>
                        No puedes acceder al sistema y tienes una solicitud crítica
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-500">
                        <span className="text-amber-500">•</span>
                        Error que bloquea operaciones de producción
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-500">
                        <span className="text-amber-500">•</span>
                        Problema de seguridad o acceso no autorizado
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-500">
                        <span className="text-amber-500">•</span>
                        Pérdida de datos o información crítica
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Administradores del Sistema */}
                <div className="p-6 rounded-xl bg-white border border-white/30">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-500" />
                    Administradores del Sistema
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50/70">
                      <p className="font-medium text-slate-900">Admin Principal</p>
                      <p className="text-sm text-slate-500">solicitudespuntualesmateriales@gmail.com</p>
                      <p className="text-xs text-slate-400">Horario: 24/7</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50/70">
                      <p className="font-medium text-slate-900">Soporte Técnico</p>
                      <p className="text-sm text-slate-500">solicitudespuntualesmateriales@gmail.com</p>
                      <p className="text-xs text-slate-400">Horario: 8:00 - 20:00</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50/70">
                      <p className="font-medium text-slate-900">Mesa de Ayuda</p>
                      <p className="text-sm text-slate-500">solicitudespuntualesmateriales@gmail.com</p>
                      <p className="text-xs text-slate-400">Horario: 8:00 - 18:00</p>
                    </div>
                  </div>
                </div>

                {/* Botón de Contacto Urgente */}
                <div className="flex justify-center">
                  <a
                    href="tel:+541112345678"
                    className="flex items-center gap-3 px-8 py-4 bg-amber-500 text-black rounded-xl font-semibold text-lg hover:bg-amber-500/90 transition-colors shadow-lg"
                  >
                    <Phone className="w-6 h-6 text-blue-500" />
                    Llamar Ahora
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
