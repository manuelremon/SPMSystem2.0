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
      titulo: t("ayuda_instr1_titulo", "Crear una Nueva Solicitud"),
      icon: FileTextIcon,
      pasos: [
        t("ayuda_instr1_paso1", "Ve a 'Solicitudes' > 'Nueva Solicitud' en el menu superior"),
        t("ayuda_instr1_paso2", "Completa los datos del formulario: centro, sector, justificacion"),
        t("ayuda_instr1_paso3", "Agrega los materiales que necesitas usando el buscador"),
        t("ayuda_instr1_paso4", "Revisa el resumen y haz clic en 'Enviar Solicitud'"),
        t("ayuda_instr1_paso5", "La solicitud pasara a estado 'Enviada' para aprobacion"),
      ],
    },
    {
      titulo: t("ayuda_instr2_titulo", "Ver Mis Solicitudes"),
      icon: PackageIcon,
      pasos: [
        t("ayuda_instr2_paso1", "Ve a 'Solicitudes' > 'Mis Solicitudes'"),
        t("ayuda_instr2_paso2", "Filtra por estado: Borradores, Enviadas, Aprobadas, etc."),
        t("ayuda_instr2_paso3", "Haz clic en 'Ver' para ver los detalles de una solicitud"),
        t("ayuda_instr2_paso4", "Puedes editar o eliminar solicitudes en estado 'Borrador'"),
      ],
    },
    {
      titulo: t("ayuda_instr3_titulo", "Aprobar Solicitudes"),
      icon: CheckCircleIcon,
      pasos: [
        t("ayuda_instr3_paso1", "Ve a 'Aprobaciones' en el menu superior"),
        t("ayuda_instr3_paso2", "Veras las solicitudes pendientes de tu aprobacion"),
        t("ayuda_instr3_paso3", "Revisa los detalles, materiales y montos"),
        t("ayuda_instr3_paso4", "Haz clic en 'Aprobar' o 'Rechazar' segun corresponda"),
        t("ayuda_instr3_paso5", "Si rechazas, debes indicar el motivo"),
      ],
    },
    {
      titulo: t("ayuda_instr4_titulo", "Panel de Planificacion"),
      icon: WorkflowIcon,
      pasos: [
        t("ayuda_instr4_paso1", "Accede a 'Planificador' en el menu (solo planificadores)"),
        t("ayuda_instr4_paso2", "Veras las solicitudes aprobadas asignadas a ti"),
        t("ayuda_instr4_paso3", "Trata cada solicitud: asigna materiales, cantidades y almacenes"),
        t("ayuda_instr4_paso4", "Finaliza el tratamiento para completar el proceso"),
      ],
    },
    {
      titulo: t("ayuda_instr5_titulo", "Configurar Mi Cuenta"),
      icon: SettingsIcon,
      pasos: [
        t("ayuda_instr5_paso1", "Haz clic en tu nombre en la esquina superior derecha"),
        t("ayuda_instr5_paso2", "Selecciona 'Mi Cuenta'"),
        t("ayuda_instr5_paso3", "Aqui puedes actualizar tu informacion personal"),
        t("ayuda_instr5_paso4", "Cambiar tu contrasena o preferencias"),
      ],
    },
  ];

  const faqs = [
    {
      pregunta: t("ayuda_faq1_p", "Como puedo editar una solicitud ya enviada?"),
      respuesta: t("ayuda_faq1_r", "Las solicitudes enviadas no pueden editarse. Si necesitas hacer cambios, solicita al aprobador que la rechace para que vuelva a estado Borrador, o crea una nueva solicitud."),
    },
    {
      pregunta: t("ayuda_faq2_p", "Por que no veo el boton de aprobar en las solicitudes?"),
      respuesta: t("ayuda_faq2_r", "El boton de aprobar solo aparece si tienes rol de aprobador y la solicitud esta asignada a ti. Contacta al administrador si crees que deberias poder aprobar."),
    },
    {
      pregunta: t("ayuda_faq3_p", "Como agrego materiales que no aparecen en el buscador?"),
      respuesta: t("ayuda_faq3_r", "Si un material no aparece, puede que no este en el catalogo del sistema. Contacta al administrador para que lo agregue."),
    },
    {
      pregunta: t("ayuda_faq4_p", "Que significa cada estado de solicitud?"),
      respuesta: t("ayuda_faq4_r", "Borrador: aun no enviada. Enviada: esperando aprobacion. Aprobada: lista para planificacion. Rechazada: requiere revision. En Proceso: siendo planificada. Completada: entregada."),
    },
    {
      pregunta: t("ayuda_faq5_p", "Puedo cancelar una solicitud despues de enviarla?"),
      respuesta: t("ayuda_faq5_r", "No puedes cancelar directamente. Debes solicitar al aprobador que la rechace, o contactar al administrador para casos especiales."),
    },
  ];

  const handleTabChange = (event, newValue) => setActiveTab(newValue);
  const handleFaqChange = (panel) => (event, isExpanded) => setExpandedFaq(isExpanded ? panel : false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t("ayuda_centro_title", "Centro de Ayuda")}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("ayuda_centro_desc", "Obten asistencia, aprende a usar el sistema o contacta al administrador")}
        </Typography>
      </Box>

      <Paper sx={{ width: 'fit-content' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<SendIcon />} iconPosition="start" label={t("ayuda_tab_contactar", "Contactar Administrador")} />
          <Tab icon={<BookIcon />} iconPosition="start" label={t("ayuda_tab_instrucciones", "Instrucciones de Uso")} />
          <Tab icon={<AlertTriangleIcon />} iconPosition="start" label={t("ayuda_tab_urgente", "Ayuda Urgente")} />
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
                        {t("ayuda_form_titulo", "Enviar Mensaje al Administrador")}
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
                        {t("ayuda_enviado_titulo", "Mensaje Enviado")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t("ayuda_enviado_desc", "Tu mensaje ha sido enviado al administrador. Recibiras una respuesta pronto.")}
                      </Typography>
                      <Button variant="contained" onClick={() => setSent(false)}>
                        {t("ayuda_enviar_otro", "Enviar otro mensaje")}
                      </Button>
                    </Box>
                  ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <TextField select label={t("ayuda_tipo_label", "Tipo de Consulta")} value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })} fullWidth>
                        <MenuItem value="consulta">{t("ayuda_tipo_consulta", "Consulta General")}</MenuItem>
                        <MenuItem value="problema">{t("ayuda_tipo_problema", "Reportar Problema")}</MenuItem>
                        <MenuItem value="sugerencia">{t("ayuda_tipo_sugerencia", "Sugerencia")}</MenuItem>
                        <MenuItem value="acceso">{t("ayuda_tipo_acceso", "Problema de Acceso")}</MenuItem>
                        <MenuItem value="otro">{t("ayuda_tipo_otro", "Otro")}</MenuItem>
                      </TextField>
                      <TextField label={t("ayuda_asunto_label", "Asunto")} value={formData.asunto} onChange={(e) => setFormData({ ...formData, asunto: e.target.value })} placeholder={t("ayuda_asunto_placeholder", "Describe brevemente tu consulta")} required fullWidth />
                      <TextField label={t("ayuda_mensaje_label", "Mensaje")} value={formData.mensaje} onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })} placeholder={t("ayuda_mensaje_placeholder", "Describe tu consulta o problema en detalle...")} required multiline rows={6} fullWidth />
                      {error && <Alert severity="error">{error}</Alert>}
                      <Button type="submit" variant="contained" disabled={sending} startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />} fullWidth>
                        {sending ? t("ayuda_enviando", "Enviando...") : t("ayuda_enviar_btn", "Enviar Mensaje")}
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
                    {t("ayuda_contacto_titulo", "Informacion de Contacto")}
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <MailIcon sx={{ color: 'secondary.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{t("ayuda_contacto_email", "Email")}</Typography>
                        <Typography variant="body2" color="text.secondary">solicitudespuntualesmateriales@gmail.com</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <PhoneIcon sx={{ color: 'primary.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{t("ayuda_contacto_telefono", "Telefono")}</Typography>
                        <Typography variant="body2" color="text.secondary">+54 11 1234-5678</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <ClockIcon sx={{ color: 'info.main', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{t("ayuda_contacto_horario", "Horario de Atencion")}</Typography>
                        <Typography variant="body2" color="text.secondary">{t("ayuda_contacto_horario_val", "Lun - Vie: 8:00 - 18:00")}</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                    {t("ayuda_faq_titulo", "Preguntas Frecuentes")}
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
                <Typography variant="h6" fontWeight="bold">{t("ayuda_faq_titulo", "Preguntas Frecuentes")}</Typography>
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
          <Grid item xs={12}>
            <Paper sx={{ p: 3, border: 2, borderColor: 'warning.main', bgcolor: 'warning.lighter' }}>
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <AlertTriangleIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                    <Typography variant="h6" fontWeight="bold" color="warning.dark">{t("ayuda_urgente_titulo", "Ayuda Urgente")}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t("ayuda_urgente_desc", "Para situaciones criticas que requieren atencion inmediata")}
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PhoneIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight="bold">{t("ayuda_emergencia_titulo", "Contacto de Emergencia")}</Typography>
                        </Stack>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="text.secondary">{t("ayuda_linea_directa", "Linea directa soporte:")}</Typography>
                          <Typography variant="h6" fontWeight="bold" color="primary.main" fontFamily="monospace">+54 11 1234-5678</Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover' }}>
                          <Typography variant="body2" color="text.secondary">{t("ayuda_whatsapp", "WhatsApp urgencias:")}</Typography>
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
                          <Typography variant="subtitle1" fontWeight="bold">{t("ayuda_cuando_urgente_titulo", "Cuando usar Ayuda Urgente?")}</Typography>
                        </Stack>
                        <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                          {[t("ayuda_urgente_caso1", "No puedes acceder al sistema y tienes una solicitud critica"), t("ayuda_urgente_caso2", "Error que bloquea operaciones de produccion"), t("ayuda_urgente_caso3", "Problema de seguridad o acceso no autorizado"), t("ayuda_urgente_caso4", "Perdida de datos o informacion critica")].map((item, idx) => (
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
                    <Typography variant="subtitle1" fontWeight="bold">{t("ayuda_admins_titulo", "Administradores del Sistema")}</Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {[{ nombre: t("ayuda_admin1", "Admin Principal"), email: "solicitudespuntualesmateriales@gmail.com", horario: "24/7" }, { nombre: t("ayuda_admin2", "Soporte Tecnico"), email: "solicitudespuntualesmateriales@gmail.com", horario: "8:00 - 20:00" }, { nombre: t("ayuda_admin3", "Mesa de Ayuda"), email: "solicitudespuntualesmateriales@gmail.com", horario: "8:00 - 18:00" }].map((admin, idx) => (
                      <Grid item xs={12} md={4} key={idx}>
                        <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}>
                          <Typography variant="body2" fontWeight="medium">{admin.nombre}</Typography>
                          <Typography variant="body2" color="text.secondary">{admin.email}</Typography>
                          <Typography variant="caption" color="text.disabled">{t("ayuda_horario_label", "Horario:")} {admin.horario}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button component="a" href="tel:+541112345678" variant="contained" color="warning" size="large" startIcon={<PhoneIcon />} sx={{ px: 4, py: 1.5, fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {t("ayuda_llamar_ahora", "Llamar Ahora")}
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
      </Box>
    </Box>
  );
}
