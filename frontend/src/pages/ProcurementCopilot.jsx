/**
 * ProcurementCopilot - AI Procurement Copilot chat interface
 *
 * Left panel: conversation list with new conversation button.
 * Right panel: chat messages with input, quick actions, and suggestion cards.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDateTime } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Divider from '@mui/material/Divider';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

const CONTEXTO_COLORS = {
  general: 'default',
  sourcing: 'info',
  rfq: 'warning',
  supplier: 'success',
  contract: 'primary',
};

const SUGGESTION_TIPO_COLORS = {
  sourcing: 'info',
  supplier: 'success',
  cost_reduction: 'warning',
  risk: 'error',
  general: 'default',
};

export default function ProcurementCopilot() {
  const { t } = useI18n();
  const toast = useToast();
  const messagesEndRef = useRef(null);

  // Conversations
  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState(null);

  // Messages
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [processingFeedback, setProcessingFeedback] = useState(null);

  // Analyze Material dialog
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [materialCodigo, setMaterialCodigo] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const res = await api.get('/copilot/conversations');
      if (res.data?.ok) {
        setConversations(res.data.conversations || res.data.items || []);
      }
    } catch {
      toast.error(t('copilot_error_convs', 'Error al cargar conversaciones'));
    } finally {
      setConvsLoading(false);
    }
  }, [t, toast]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    setMsgsLoading(true);
    try {
      const res = await api.get(`/copilot/conversations/${convId}`);
      if (res.data?.ok) {
        setMessages(res.data.messages || res.data.conversation?.messages || []);
      }
    } catch {
      toast.error(t('copilot_error_msgs', 'Error al cargar mensajes'));
    } finally {
      setMsgsLoading(false);
    }
  }, [t, toast]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/copilot/suggestions');
      if (res.data?.ok) {
        setSuggestions(res.data.suggestions || res.data.items || []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchSuggestions();
  }, [fetchConversations, fetchSuggestions]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    }
  }, [activeConvId, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Select conversation
  const handleSelectConversation = useCallback((convId) => {
    setActiveConvId(convId);
    setMessages([]);
  }, []);

  // New conversation
  const handleNewConversation = useCallback(async () => {
    try {
      const res = await api.post('/copilot/conversations', {
        titulo: t('copilot_new_conv_title', 'Nueva Conversacion'),
      });
      if (res.data?.ok) {
        const newConv = res.data.conversation || res.data;
        fetchConversations();
        setActiveConvId(newConv.id);
        setMessages([]);
        toast.success(t('copilot_conv_created', 'Conversacion creada'));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('copilot_error_new_conv', 'Error al crear conversacion'));
    }
  }, [t, toast, fetchConversations]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !activeConvId) return;
    const text = messageInput.trim();
    setMessageInput('');
    setSending(true);

    // Optimistic: add user message
    const userMsg = { role: 'user', contenido: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.post(`/copilot/conversations/${activeConvId}/messages`, {
        mensaje: text,
      });
      if (res.data?.ok) {
        const assistantMsg = res.data.message || res.data.response;
        if (assistantMsg) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              contenido: typeof assistantMsg === 'string' ? assistantMsg : assistantMsg.contenido || assistantMsg.message,
              created_at: new Date().toISOString(),
            },
          ]);
        }
        fetchSuggestions();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('copilot_error_send', 'Error al enviar mensaje'));
    } finally {
      setSending(false);
    }
  }, [messageInput, activeConvId, t, toast, fetchSuggestions]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Quick actions
  const handleQuickAction = useCallback((action) => {
    if (!activeConvId) {
      toast.warning(t('copilot_select_conv', 'Seleccione o cree una conversacion primero'));
      return;
    }
    if (action === 'analyze_material') {
      setAnalyzeOpen(true);
    } else if (action === 'suggest_supplier') {
      setMessageInput(t('copilot_prompt_supplier', 'Sugiere proveedores para mi proxima compra'));
    } else if (action === 'draft_rfq') {
      setMessageInput(t('copilot_prompt_rfq', 'Ayudame a crear un borrador de RFQ'));
    }
  }, [activeConvId, t, toast]);

  // Analyze material
  const handleAnalyzeMaterial = useCallback(async () => {
    if (!materialCodigo.trim()) {
      toast.warning(t('copilot_material_required', 'Ingrese codigo de material'));
      return;
    }
    setAnalyzing(true);
    try {
      const res = await api.post(`/copilot/suggestions/sourcing/${materialCodigo.trim()}`);
      if (res.data?.ok) {
        toast.success(t('copilot_analysis_started', 'Analisis de sourcing iniciado'));
        setAnalyzeOpen(false);
        setMaterialCodigo('');
        fetchSuggestions();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('copilot_error_analyze', 'Error al analizar material'));
    } finally {
      setAnalyzing(false);
    }
  }, [materialCodigo, t, toast, fetchSuggestions]);

  // Suggestion feedback
  const handleSuggestionFeedback = useCallback(async (suggestionId, accepted) => {
    setProcessingFeedback(suggestionId);
    try {
      const res = await api.put(`/copilot/suggestions/${suggestionId}/feedback`, {
        aceptada: accepted,
      });
      if (res.data?.ok) {
        toast.success(
          accepted
            ? t('copilot_suggestion_accepted', 'Sugerencia aceptada')
            : t('copilot_suggestion_rejected', 'Sugerencia rechazada')
        );
        fetchSuggestions();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('copilot_error_feedback', 'Error al procesar feedback'));
    } finally {
      setProcessingFeedback(null);
    }
  }, [t, toast, fetchSuggestions]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const activeSuggestions = suggestions.filter((s) => s.estado === 'active' || s.estado === 'pending');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <SmartToyIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('copilot_title', 'Procurement Copilot')}
        </Typography>
      </Stack>

      {/* Main Layout */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ minHeight: 600 }}>
        {/* Left Panel: Conversations */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', md: '30%' },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              fullWidth
              onClick={handleNewConversation}
              size="small"
            >
              {t('copilot_new_conv', 'Nueva Conversacion')}
            </Button>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {convsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : conversations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                {t('copilot_no_convs', 'Sin conversaciones')}
              </Typography>
            ) : (
              <List disablePadding>
                {conversations.map((conv) => (
                  <ListItemButton
                    key={conv.id}
                    selected={activeConvId === conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: activeConvId === conv.id ? 700 : 400, flex: 1 }} noWrap>
                            {conv.titulo || t('copilot_untitled', 'Sin titulo')}
                          </Typography>
                          {conv.contexto_tipo && (
                            <Chip
                              size="small"
                              label={conv.contexto_tipo}
                              color={CONTEXTO_COLORS[conv.contexto_tipo] || 'default'}
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                          )}
                        </Stack>
                      }
                      secondary={formatDateTime(conv.updated_at || conv.created_at)}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </Paper>

        {/* Right Panel: Chat */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Chat Header */}
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2">
              {activeConv ? activeConv.titulo : t('copilot_select_conv_prompt', 'Seleccione una conversacion')}
            </Typography>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {msgsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : !activeConvId ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('copilot_start_hint', 'Cree o seleccione una conversacion para comenzar')}
                </Typography>
              </Box>
            ) : messages.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('copilot_empty_conv', 'Envie un mensaje para iniciar la conversacion')}
                </Typography>
              </Box>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        maxWidth: '75%',
                        borderRadius: 2,
                        bgcolor: isUser ? 'primary.main' : 'grey.100',
                        color: isUser ? 'primary.contrastText' : 'text.primary',
                        border: isUser ? 'none' : '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {msg.contenido || msg.message || msg.content}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          opacity: 0.7,
                          textAlign: isUser ? 'right' : 'left',
                        }}
                      >
                        {formatDateTime(msg.created_at)}
                      </Typography>
                    </Paper>
                  </Box>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Quick Actions */}
          {activeConvId && (
            <Box sx={{ px: 2, pb: 1 }}>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SearchIcon />}
                  onClick={() => handleQuickAction('analyze_material')}
                >
                  {t('copilot_quick_analyze', 'Analizar Material')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<GroupIcon />}
                  onClick={() => handleQuickAction('suggest_supplier')}
                >
                  {t('copilot_quick_supplier', 'Sugerir Proveedor')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DescriptionIcon />}
                  onClick={() => handleQuickAction('draft_rfq')}
                >
                  {t('copilot_quick_rfq', 'Draft RFQ')}
                </Button>
              </Stack>
            </Box>
          )}

          {/* Input Area */}
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" gap={1}>
              <TextField
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('copilot_input_placeholder', 'Escriba su mensaje...')}
                fullWidth
                size="small"
                multiline
                maxRows={3}
                disabled={!activeConvId || sending}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!activeConvId || !messageInput.trim() || sending}
                aria-label={t('copilot_send', 'Enviar')}
              >
                {sending ? <CircularProgress size={20} /> : <SendIcon />}
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      </Stack>

      {/* Suggestions Panel */}
      {activeSuggestions.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <LightbulbIcon sx={{ color: 'warning.main' }} />
            <Typography variant="subtitle2">{t('copilot_suggestions', 'Sugerencias Activas')}</Typography>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
            {activeSuggestions.map((sug) => (
              <Card
                key={sug.id}
                variant="outlined"
                sx={{ flex: 1, minWidth: 280, maxWidth: { md: 400 } }}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Chip
                      size="small"
                      label={sug.tipo || 'general'}
                      color={SUGGESTION_TIPO_COLORS[sug.tipo] || 'default'}
                    />
                  </Stack>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    {sug.titulo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {sug.contenido}
                  </Typography>
                </CardContent>
                <Divider />
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    color="error"
                    startIcon={processingFeedback === sug.id ? <CircularProgress size={14} /> : <CloseIcon />}
                    onClick={() => handleSuggestionFeedback(sug.id, false)}
                    disabled={processingFeedback === sug.id}
                  >
                    {t('copilot_reject', 'Rechazar')}
                  </Button>
                  <Button
                    size="small"
                    color="success"
                    variant="contained"
                    startIcon={processingFeedback === sug.id ? <CircularProgress size={14} /> : <CheckIcon />}
                    onClick={() => handleSuggestionFeedback(sug.id, true)}
                    disabled={processingFeedback === sug.id}
                  >
                    {t('copilot_accept', 'Aceptar')}
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Analyze Material Dialog */}
      <Dialog open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <SearchIcon color="primary" />
            <span>{t('copilot_analyze_title', 'Analizar Material')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TextField
            label={t('copilot_material_code', 'Codigo de Material')}
            value={materialCodigo}
            onChange={(e) => setMaterialCodigo(e.target.value)}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            placeholder="MAT001"
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAnalyzeOpen(false)} disabled={analyzing}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleAnalyzeMaterial}
            disabled={analyzing || !materialCodigo.trim()}
            startIcon={analyzing ? <CircularProgress size={16} /> : <SearchIcon />}
          >
            {t('copilot_analyze_btn', 'Analizar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
