import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
} from "@mui/material";
import {
  Send as SendIcon,
  MenuBook as BookIcon,
  Warning as AlertTriangleIcon,
  Phone as PhoneIcon,
  Email as MailIcon,
  Chat as MessageSquareIcon,
  Description as FileTextIcon,
  CheckCircle as CheckCircleIcon,
  HelpOutline as HelpCircleIcon,
  ExpandMore as ExpandMoreIcon,
  AccessTime as ClockIcon,
  People as UsersIcon,
  AccountTree as WorkflowIcon,
  Settings as SettingsIcon,
  Inventory as PackageIcon,
} from "@mui/icons-material";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

export default function Ayuda() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    asunto: "",
    mensaje: "",
    tipo: "consulta",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post("/mensajes/send", {
        destinatario_id: "admin",
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
    } finally {
      setSending(false);
    }
  };

  const instrucciones = [
    {
      titulo: "Crear una Nueva Solicitud",
      icon: FileTextIcon,
      pasos: [
        "Ve a 'Solicitudes' > 'Nueva Solicitud' en el menu superior",
        "Completa los datos del formulario: centro, sector, justificacion",
        "Agrega los materiales que necesitas usando el buscador",
        "Revisa el resumen y haz clic en 'Enviar Solicitud'",
        "La solicitud pasara a estado 'Enviada' para aprobacion",
      ],
    },
    {
      titulo: "Ver Mis Solicitudes",
      icon: PackageIcon,
      pasos: [
        "Ve a 'Solicitudes' > 'Mis Solicitudes'",
        "Filtra por estado: Borradores, Enviadas, Aprobadas, etc.",
        "Haz clic en 'Ver' para ver los detalles de una solicitud",
        "Puedes editar o eliminar solicitudes en estado 'Borrador'",
      ],
    },
    {
      titulo: "Aprobar Solicitudes",
      icon: CheckCircleIcon,
      pasos: [
        "Ve a 'Aprobaciones' en el menu superior",
        "Veras las solicitudes pendientes de tu aprobacion",
        "Revisa los detalles, materiales y montos",
        "Haz clic en 'Aprobar' o 'Rechazar' segun corresponda",
        "Si rechazas, debes indicar el motivo",
      ],
    },
    {
      titulo: "Panel de Planificacion",
      icon: WorkflowIcon,
      pasos: [
        "Accede a 'Planificador' en el menu (solo planificadores)",
        "Veras las solicitudes aprobadas asignadas a ti",
        "Trata cada solicitud: asigna materiales, cantidades y almacenes",
        "Finaliza el tratamiento para completar el proceso",
      ],
    },
    {
      titulo: "Configurar Mi Cuenta",
      icon: SettingsIcon,
      pasos: [
        "Haz clic en tu nombre en la esquina superior derecha",
        "Selecciona 'Mi Cuenta'",
        "Aqui puedes actualizar tu informacion personal",
        "Cambiar tu contrasena o preferencias",
      ],
    },
  ];

  const faqs = [
    {
      pregunta: "Como puedo editar una solicitud ya enviada?",
      respuesta: "Las solicitudes enviadas no pueden editarse. Si necesitas hacer cambios, solicita al aprobador que la rechace para que vuelva a estado Borrador, o crea una nueva solicitud.",
    },
    {
      pregunta: "Por que no veo el boton de aprobar en las solicitudes?",
      respuesta: "El boton de aprobar solo aparece si tienes rol de aprobador y la solicitud esta asignada a ti. Contacta al administrador si crees que deberias poder aprobar.",
    },
    {
      pregunta: "Como agrego materiales que no aparecen en el buscador?",
      respuesta: "Si un material no aparece, puede que no este en el catalogo del sistema. Contacta al administrador para que lo agregue.",
    },
    {
      pregunta: "Que significa cada estado de solicitud?",
      respuesta: "Borrador: aun no enviada. Enviada: esperando aprobacion. Aprobada: lista para planificacion. Rechazada: requiere revision. En Proceso: siendo planificada. Completada: entregada.",
    },
    {
      pregunta: "Puedo cancelar una solicitud despues de enviarla?",
      respuesta: "No puedes cancelar directamente. Debes solicitar al aprobador que la rechace, o contactar al administrador para casos especiales.",
    },
  ];

  const handleTabChange = (event, newValue) => setActiveTab(newValue);
  const handleFaqChange = (panel) => (event, isExpanded) => setExpandedFaq(isExpanded ? panel : false);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Centro de Ayuda
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Obten asistencia, aprende a usar el sistema o contacta al administrador
        </Typography>
      </Box>

      <Paper sx={{ width: 'fit-content' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<SendIcon />} iconPosition="start" label="Contactar Administrador" />
          <Tab icon={<BookIcon />} iconPosition="start" label="Instrucciones de Uso" />
          <Tab icon={<AlertTriangleIcon />} iconPosition="start" label="Ayuda Urgente" />
        </Tabs>
      </Paper>

      <Grid container spacing={3}>
        {activeTab === 0 && (
          <>
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3 }}>
                <Stack spacing={3}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <MessageSquareIcon sx={{ color: 'secondary.main' }} />
                      <Typography variant="h6" fontWeight="bold">
                        Enviar Mensaje al Administrador
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Completa el formulario para enviar tu consulta o reporte
                    </Typography>
                  </Box>

                  {sent ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                        Mensaje Enviado
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Tu mensaje ha sido enviado al administrador. Recibiras una respuesta pronto.
                      </Typography>
                      <Button variant="contained" onClick={() => setSent(false)}>
                        Enviar otro mensaje
                      </Button>
                    </Box>
                  ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <TextField select label="Tipo de Consulta" value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} fullWidth>
                        <MenuItem value="consulta">Consulta General</MenuItem>
                        <MenuItem value="problema">Reportar Problema</MenuItem>
                        <MenuItem value="sugerencia">Sugerencia</MenuItem>
                        <MenuItem value="acceso">Problema de Acceso</MenuItem>
                        <MenuItem value="otro">Otro</MenuItem>
                      </TextField>
                      <TextField label="Asunto" value={formData.asunto} onChange={(e) => setFormData({ ...formData, asunto: e.target.value })} placeholder="Describe brevemente tu consulta" required fullWidth />
                      <TextField label="Mensaje" value={formData.mensaje} onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })} placeholder="Describe tu consulta o problema en detalle..." required multiline rows={6} fullWidth />
                      {error && <Alert severity="error">{error}</Alert>}
                      <Button type="submit" variant="contained" disabled={sending} startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />} fullWidth>
                        {sending ? "Enviando..." : "Enviar Mensaje"}
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Stack spacing={3}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Informacion de Contacto
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <MailIcon sx={{ color: 'secondary.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">Email</Typography>
                        <Typography variant="body2" color="text.secondary">solicitudespuntualesmateriales@gmail.com</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <PhoneIcon sx={{ color: 'primary.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">Telefono</Typography>
                        <Typography variant="body2" color="text.secondary">+54 11 1234-5678</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <ClockIcon sx={{ color: 'info.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">Horario de Atencion</Typography>
                        <Typography variant="body2" color="text.secondary">Lun - Vie: 8:00 - 18:00</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    Preguntas Frecuentes
                  </Typography>
                  <Stack spacing={1}>
                    {faqs.slice(0, 3).map((faq, idx) => (
                      <Accordion key={idx} expanded={expandedFaq === `contacto-faq-${idx}`} onChange={handleFaqChange(`contacto-faq-${idx}`)} disableGutters elevation={0} sx={{ bgcolor: 'action.hover', '&:before': { display: 'none' }, borderRadius: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" fontWeight="medium">{faq.pregunta}</Typography></AccordionSummary>
                        <AccordionDetails><Typography variant="body2" color="text.secondary">{faq.respuesta}</Typography></AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>
                </Paper>
              </Stack>
            </Grid>
          </>
        )}

        {activeTab === 1 && (
          <Grid item xs={12}>
            <Grid container spacing={3}>
              {instrucciones.map((instruccion, idx) => {
                const Icon = instruccion.icon;
                return (
                  <Grid item xs={12} md={6} key={idx}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Icon color="primary" />
                          <Typography variant="h6" fontWeight="bold">{instruccion.titulo}</Typography>
                        </Stack>
                        <Stack component="ol" spacing={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                          {instruccion.pasos.map((paso, pasoIdx) => (
                            <Stack component="li" key={pasoIdx} direction="row" alignItems="flex-start" spacing={1.5}>
                              <Box sx={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.contrastText', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {pasoIdx + 1}
                              </Box>
                              <Typography variant="body2" color="text.secondary">{paso}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
            <Paper sx={{ p: 3, mt: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <HelpCircleIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">Preguntas Frecuentes</Typography>
              </Stack>
              <Stack spacing={1}>
                {faqs.map((faq, idx) => (
                  <Accordion key={idx} expanded={expandedFaq === `instrucciones-faq-${idx}`} onChange={handleFaqChange(`instrucciones-faq-${idx}`)} disableGutters elevation={0} sx={{ bgcolor: 'action.hover', '&:before': { display: 'none' }, borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" fontWeight="medium">{faq.pregunta}</Typography></AccordionSummary>
                    <AccordionDetails sx={{ borderTop: 1, borderColor: 'divider' }}><Typography variant="body2" color="text.secondary">{faq.respuesta}</Typography></AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </Paper>
          </Grid>
        )}

        {activeTab === 2 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, border: 2, borderColor: 'warning.main', bgcolor: 'warning.lighter' }}>
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <AlertTriangleIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                    <Typography variant="h6" fontWeight="bold" color="warning.dark">Ayuda Urgente</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Para situaciones criticas que requieren atencion inmediata
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PhoneIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight="bold">Contacto de Emergencia</Typography>
                        </Stack>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="text.secondary">Linea directa soporte:</Typography>
                          <Typography variant="h6" fontWeight="bold" color="primary.main" fontFamily="monospace">+54 11 1234-5678</Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="text.secondary">WhatsApp urgencias:</Typography>
                          <Typography variant="h6" fontWeight="bold" color="success.main" fontFamily="monospace">+54 9 11 9876-5432</Typography>
                        </Paper>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <AlertTriangleIcon color="warning" />
                          <Typography variant="subtitle1" fontWeight="bold">Cuando usar Ayuda Urgente?</Typography>
                        </Stack>
                        <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                          {["No puedes acceder al sistema y tienes una solicitud critica", "Error que bloquea operaciones de produccion", "Problema de seguridad o acceso no autorizado", "Perdida de datos o informacion critica"].map((item, idx) => (
                            <Stack component="li" key={idx} direction="row" spacing={1} alignItems="flex-start">
                              <Typography component="span" color="warning.main">-</Typography>
                              <Typography variant="body2" color="text.secondary">{item}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    <UsersIcon color="info" />
                    <Typography variant="subtitle1" fontWeight="bold">Administradores del Sistema</Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {[{ nombre: "Admin Principal", email: "solicitudespuntualesmateriales@gmail.com", horario: "24/7" }, { nombre: "Soporte Tecnico", email: "solicitudespuntualesmateriales@gmail.com", horario: "8:00 - 20:00" }, { nombre: "Mesa de Ayuda", email: "solicitudespuntualesmateriales@gmail.com", horario: "8:00 - 18:00" }].map((admin, idx) => (
                      <Grid item xs={12} md={4} key={idx}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                          <Typography variant="body2" fontWeight="medium">{admin.nombre}</Typography>
                          <Typography variant="body2" color="text.secondary">{admin.email}</Typography>
                          <Typography variant="caption" color="text.disabled">Horario: {admin.horario}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button component="a" href="tel:+541112345678" variant="contained" color="warning" size="large" startIcon={<PhoneIcon />} sx={{ px: 4, py: 1.5, fontWeight: 'bold', fontSize: '1.1rem' }}>
                    Llamar Ahora
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Stack>
  );
}
