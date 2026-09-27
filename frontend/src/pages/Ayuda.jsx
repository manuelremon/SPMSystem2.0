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
import { useI18n } from "../context/i18n";
import api from "../services/api";
import PageLayout from "../components/ui/PageLayout";

export default function Ayuda() {
  const { user } = useAuthStore();
  const { t } = useI18n();
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
      setError(t("ayuda_error_envio", "No se pudo enviar el mensaje. Intenta de nuevo."));
    } finally {
      setSending(false);
    }
  };

  const instrucciones = [
    {
      titulo: t("ayuda_instr1_titulo", "Crear una nueva solicitud"),
      icon: FileTextIcon,
      pasos: [
        t("ayuda_instr1_paso1", "Ve a 'Solicitudes' > 'Nueva solicitud' en el menú"),
        t("ayuda_instr1_paso2", "Completa los datos del formulario: centro, sector y justificación"),
        t("ayuda_instr1_paso3", "Agrega los materiales que necesitas usando el buscador"),
        t("ayuda_instr1_paso4", "Revisa el resumen y haz clic en 'Enviar solicitud'"),
        t("ayuda_instr1_paso5", "La solicitud pasará a estado 'Enviada' para su aprobación"),
      ],
    },
    {
      titulo: t("ayuda_instr2_titulo", "Ver mis solicitudes"),
      icon: PackageIcon,
      pasos: [
        t("ayuda_instr2_paso1", "Ve a 'Solicitudes' > 'Mis solicitudes'"),
        t("ayuda_instr2_paso2", "Filtra por estado: Borradores, Enviadas, Aprobadas, etc."),
        t("ayuda_instr2_paso3", "Haz clic en 'Ver' para ver los detalles de una solicitud"),
        t("ayuda_instr2_paso4", "Puedes editar o eliminar solicitudes en estado 'Borrador'"),
      ],
    },
    {
      titulo: t("ayuda_instr3_titulo", "Aprobar solicitudes"),
      icon: CheckCircleIcon,
      pasos: [
        t("ayuda_instr3_paso1", "Ve a 'Aprobaciones' en el menú"),
        t("ayuda_instr3_paso2", "Verás las solicitudes pendientes de tu aprobación"),
        t("ayuda_instr3_paso3", "Revisa los detalles, materiales y montos"),
        t("ayuda_instr3_paso4", "Haz clic en 'Aprobar' o 'Rechazar' según corresponda"),
        t("ayuda_instr3_paso5", "Si rechazas, debes indicar el motivo"),
      ],
    },
    {
      titulo: t("ayuda_instr4_titulo", "Panel de planificación"),
      icon: WorkflowIcon,
      pasos: [
        t("ayuda_instr4_paso1", "Accede a 'Planificador' en el menú (solo planificadores)"),
        t("ayuda_instr4_paso2", "Verás las solicitudes aprobadas asignadas a ti"),
        t("ayuda_instr4_paso3", "Trata cada solicitud: asigna materiales, cantidades y almacenes"),
        t("ayuda_instr4_paso4", "Finaliza el tratamiento para completar el proceso"),
      ],
    },
    {
      titulo: t("ayuda_instr5_titulo", "Configurar mi cuenta"),
      icon: SettingsIcon,
      pasos: [
        t("ayuda_instr5_paso1", "Haz clic en tu nombre en la esquina superior derecha"),
        t("ayuda_instr5_paso2", "Selecciona 'Mi cuenta'"),
        t("ayuda_instr5_paso3", "Aquí puedes actualizar tu información personal"),
        t("ayuda_instr5_paso4", "Cambia tu contraseña o tus preferencias"),
      ],
    },
  ];

  const faqs = [
    {
      pregunta: t("ayuda_faq1_p", "¿Cómo puedo editar una solicitud ya enviada?"),
      respuesta: t("ayuda_faq1_r", "Las solicitudes enviadas no pueden editarse. Si necesitas hacer cambios, solicita al aprobador que la rechace para que vuelva a estado Borrador, o crea una nueva solicitud."),
    },
    {
      pregunta: t("ayuda_faq2_p", "¿Por qué no veo el botón de aprobar en las solicitudes?"),
      respuesta: t("ayuda_faq2_r", "El botón de aprobar solo aparece si tienes rol de aprobador y la solicitud está asignada a ti. Contacta al administrador si crees que deberías poder aprobar."),
    },
    {
      pregunta: t("ayuda_faq3_p", "¿Cómo agrego materiales que no aparecen en el buscador?"),
      respuesta: t("ayuda_faq3_r", "Si un material no aparece, puede que no esté en el catálogo del sistema. Contacta al administrador para que lo agregue."),
    },
    {
      pregunta: t("ayuda_faq4_p", "¿Qué significa cada estado de solicitud?"),
      respuesta: t("ayuda_faq4_r", "Borrador: aún no enviada. Enviada: esperando aprobación. Aprobada: lista para planificación. Rechazada: requiere revisión. En proceso: siendo planificada. Completada: entregada."),
    },
    {
      pregunta: t("ayuda_faq5_p", "¿Puedo cancelar una solicitud después de enviarla?"),
      respuesta: t("ayuda_faq5_r", "No puedes cancelar directamente. Debes solicitar al aprobador que la rechace, o contactar al administrador para casos especiales."),
    },
  ];

  const handleTabChange = (event, newValue) => setActiveTab(newValue);
  const handleFaqChange = (panel) => (event, isExpanded) => setExpandedFaq(isExpanded ? panel : false);

  return (
    <PageLayout
      title={t("ayuda_centro_title", "Centro de ayuda")}
      subtitle={t("ayuda_centro_desc", "Obtén asistencia, aprende a usar el sistema o contacta al administrador")}
    >
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ "& .MuiTab-root": { textTransform: "none", minHeight: 48 } }}
        >
          <Tab icon={<SendIcon />} iconPosition="start" label={t("ayuda_tab_contactar", "Contactar al administrador")} />
          <Tab icon={<BookIcon />} iconPosition="start" label={t("ayuda_tab_instrucciones", "Instrucciones de uso")} />
          <Tab icon={<AlertTriangleIcon />} iconPosition="start" label={t("ayuda_tab_urgente", "Ayuda urgente")} />
        </Tabs>
      </Paper>

      <Grid container spacing={3}>
        {activeTab === 0 && (
          <>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                <Stack spacing={3}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <MessageSquareIcon sx={{ color: 'secondary.main' }} />
                      <Typography variant="h6" fontWeight="bold">
                        {t("ayuda_form_titulo", "Enviar mensaje al administrador")}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {t("ayuda_form_desc", "Completa el formulario para enviar tu consulta o reporte")}
                    </Typography>
                  </Box>

                  {sent ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                        {t("ayuda_enviado_titulo", "Mensaje enviado")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t("ayuda_enviado_desc", "Tu mensaje fue enviado al administrador. Recibirás una respuesta pronto.")}
                      </Typography>
                      <Button variant="contained" onClick={() => setSent(false)} sx={{ textTransform: "none" }}>
                        {t("ayuda_enviar_otro", "Enviar otro mensaje")}
                      </Button>
                    </Box>
                  ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <TextField select label={t("ayuda_tipo_label", "Tipo de consulta")} value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} fullWidth>
                        <MenuItem value="consulta">{t("ayuda_tipo_consulta", "Consulta general")}</MenuItem>
                        <MenuItem value="problema">{t("ayuda_tipo_problema", "Reportar un problema")}</MenuItem>
                        <MenuItem value="sugerencia">{t("ayuda_tipo_sugerencia", "Sugerencia")}</MenuItem>
                        <MenuItem value="acceso">{t("ayuda_tipo_acceso", "Problema de acceso")}</MenuItem>
                        <MenuItem value="otro">{t("ayuda_tipo_otro", "Otro")}</MenuItem>
                      </TextField>
                      <TextField label={t("ayuda_asunto_label", "Asunto")} value={formData.asunto} onChange={(e) => setFormData({ ...formData, asunto: e.target.value })} placeholder={t("ayuda_asunto_placeholder", "Describe brevemente tu consulta")} required fullWidth />
                      <TextField label={t("ayuda_mensaje_label", "Mensaje")} value={formData.mensaje} onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })} placeholder={t("ayuda_mensaje_placeholder", "Describe tu consulta o problema en detalle...")} required multiline rows={6} fullWidth />
                      {error && <Alert severity="error">{error}</Alert>}
                      <Button type="submit" variant="contained" disabled={sending} startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />} fullWidth sx={{ textTransform: "none" }}>
                        {sending ? t("ayuda_enviando", "Enviando...") : t("ayuda_enviar_btn", "Enviar mensaje")}
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={3}>
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    {t("ayuda_contacto_titulo", "Información de contacto")}
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <MailIcon sx={{ color: 'secondary.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{t("ayuda_contacto_email", "Correo electrónico")}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>solicitudespuntualesmateriales@gmail.com</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <PhoneIcon sx={{ color: 'primary.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{t("ayuda_contacto_telefono", "Teléfono")}</Typography>
                        <Typography variant="body2" color="text.secondary">+54 11 1234-5678</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <ClockIcon sx={{ color: 'info.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{t("ayuda_contacto_horario", "Horario de atención")}</Typography>
                        <Typography variant="body2" color="text.secondary">{t("ayuda_contacto_horario_val", "Lun a vie: 8:00 a 18:00")}</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    {t("ayuda_faq_titulo", "Preguntas frecuentes")}
                  </Typography>
                  <Stack spacing={1}>
                    {faqs.slice(0, 3).map((faq, idx) => (
                      <Accordion key={idx} expanded={expandedFaq === `contacto-faq-${idx}`} onChange={handleFaqChange(`contacto-faq-${idx}`)} disableGutters elevation={0} sx={{ bgcolor: 'action.hover', '&:before': { display: 'none' } }}>
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
          <Grid size={12}>
            <Grid container spacing={3}>
              {instrucciones.map((instruccion, idx) => {
                const Icon = instruccion.icon;
                return (
                  <Grid
                    key={idx}
                    size={{
                      xs: 12,
                      md: idx === instrucciones.length - 1 && instrucciones.length % 2 === 1 ? 12 : 6,
                    }}>
                    <Paper elevation={0} sx={{ p: 3, height: '100%', border: 1, borderColor: 'divider' }}>
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
            <Paper elevation={0} sx={{ p: 3, mt: 3, border: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <HelpCircleIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">{t("ayuda_faq_titulo", "Preguntas frecuentes")}</Typography>
              </Stack>
              <Stack spacing={1}>
                {faqs.map((faq, idx) => (
                  <Accordion key={idx} expanded={expandedFaq === `instrucciones-faq-${idx}`} onChange={handleFaqChange(`instrucciones-faq-${idx}`)} disableGutters elevation={0} sx={{ bgcolor: 'action.hover', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2" fontWeight="medium">{faq.pregunta}</Typography></AccordionSummary>
                    <AccordionDetails sx={{ borderTop: 1, borderColor: 'divider' }}><Typography variant="body2" color="text.secondary">{faq.respuesta}</Typography></AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </Paper>
          </Grid>
        )}

        {activeTab === 2 && (
          <Grid size={12}>
            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'warning.main' }}>
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <AlertTriangleIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                    <Typography variant="h6" fontWeight="bold" color="warning.dark">{t("ayuda_urgente_titulo", "Ayuda urgente")}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t("ayuda_urgente_desc", "Para situaciones críticas que requieren atención inmediata")}
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PhoneIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight="bold">{t("ayuda_emergencia_titulo", "Contacto de emergencia")}</Typography>
                        </Stack>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="text.secondary">{t("ayuda_linea_directa", "Línea directa de soporte:")}</Typography>
                          <Typography variant="h6" fontWeight="bold" color="primary.main">+54 11 1234-5678</Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="text.secondary">{t("ayuda_whatsapp", "WhatsApp para urgencias:")}</Typography>
                          <Typography variant="h6" fontWeight="bold" color="success.main">+54 9 11 9876-5432</Typography>
                        </Paper>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <AlertTriangleIcon color="warning" />
                          <Typography variant="subtitle1" fontWeight="bold">{t("ayuda_cuando_urgente_titulo", "¿Cuándo usar la ayuda urgente?")}</Typography>
                        </Stack>
                        <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                          {[t("ayuda_urgente_caso1", "No puedes acceder al sistema y tienes una solicitud crítica"), t("ayuda_urgente_caso2", "Un error bloquea operaciones de producción"), t("ayuda_urgente_caso3", "Problema de seguridad o acceso no autorizado"), t("ayuda_urgente_caso4", "Pérdida de datos o de información crítica")].map((item, idx) => (
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
                    <Typography variant="subtitle1" fontWeight="bold">{t("ayuda_admins_titulo", "Administradores del sistema")}</Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {[{ nombre: t("ayuda_admin1", "Administrador principal"), email: "solicitudespuntualesmateriales@gmail.com", horario: "24/7" }, { nombre: t("ayuda_admin2", "Soporte técnico"), email: "solicitudespuntualesmateriales@gmail.com", horario: "8:00 - 20:00" }, { nombre: t("ayuda_admin3", "Mesa de ayuda"), email: "solicitudespuntualesmateriales@gmail.com", horario: "8:00 - 18:00" }].map((admin, idx) => (
                      <Grid
                        key={idx}
                        size={{
                          xs: 12,
                          md: 4
                        }}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                          <Typography variant="body2" fontWeight="medium">{admin.nombre}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>{admin.email}</Typography>
                          <Typography variant="caption" color="text.disabled">{t("ayuda_horario_label", "Horario:")} {admin.horario}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button component="a" href="tel:+541112345678" variant="contained" color="warning" size="large" startIcon={<PhoneIcon />} sx={{ px: 4, textTransform: 'none', fontWeight: 600 }}>
                    {t("ayuda_llamar_ahora", "Llamar ahora")}
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </PageLayout>
  );
}
