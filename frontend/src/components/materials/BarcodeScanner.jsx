/**
 * BarcodeScanner - Camera-based barcode scanner with mobile pairing & manual fallback
 * Uses html5-qrcode for cross-browser camera scanning.
 * Two tabs: "Local Camera" and "Scan with Phone".
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  IconButton,
  Stack,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PhonelinkIcon from '@mui/icons-material/Phonelink';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useI18n } from '../../context/i18n';
import api from '../../services/api';

const READER_ID = 'html5qr-reader';

export default function BarcodeScanner({ open, onClose, onScan }) {
  const { t } = useI18n();
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');
  const [tabIndex, setTabIndex] = useState(0);

  // --- Local camera state ---
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const html5QrRef = useRef(null);

  // --- Mobile pairing state ---
  const [pairingSession, setPairingSession] = useState(null);
  const [qrDataUri, setQrDataUri] = useState(null);
  const [remoteCodes, setRemoteCodes] = useState([]);
  const [lastRemoteCode, setLastRemoteCode] = useState(null);
  const pollRef = useRef(null);

  // ─── Local camera helpers ───
  const stopLocalCamera = useCallback(async () => {
    try {
      if (html5QrRef.current) {
        const state = html5QrRef.current.getState();
        // state 2 = SCANNING
        if (state === 2) {
          await html5QrRef.current.stop();
        }
        html5QrRef.current.clear();
        html5QrRef.current = null;
      }
    } catch {
      // ignore
    }
    setCameraActive(false);
    setScanning(false);
  }, []);

  const startLocalCamera = useCallback(async () => {
    try {
      setError('');
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(READER_ID);
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (decodedText && decodedText.trim()) {
            stopLocalCamera();
            onScan(decodedText.trim());
            handleClose();
          }
        },
        () => {} // ignore errors during scan
      );
      setCameraActive(true);
      setScanning(true);
    } catch {
      setError(t('scanner_no_camera', 'No se pudo acceder a la cámara. Usa el campo manual.'));
    }
  }, [onScan, onClose, t, stopLocalCamera]);

  // ─── Mobile pairing helpers ───
  const startPairing = useCallback(async () => {
    try {
      setError('');
      const res = await api.post('/scanner/session');
      const data = res.data;
      setPairingSession(data.session_id);
      setQrDataUri(data.qr_data_uri);
      setRemoteCodes([]);
      setLastRemoteCode(null);
    } catch {
      setError(t('scanner_pairing_error', 'No se pudo crear la sesión de escaneo.'));
    }
  }, [t]);

  const stopPairing = useCallback(async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pairingSession) {
      try {
        await api.delete(`/scanner/session/${pairingSession}`);
      } catch {
        // ignore
      }
      setPairingSession(null);
    }
    setQrDataUri(null);
    setRemoteCodes([]);
    setLastRemoteCode(null);
  }, [pairingSession]);

  // Poll for remote codes
  useEffect(() => {
    if (!pairingSession || tabIndex !== 1) return;

    const poll = async () => {
      try {
        const res = await api.get(`/scanner/session/${pairingSession}/codes`);
        if (res.data.ok && res.data.codes.length > 0) {
          const newCodes = res.data.codes;
          setRemoteCodes(prev => [...prev, ...newCodes]);
          // Process the latest code
          const latest = newCodes[newCodes.length - 1];
          setLastRemoteCode(latest.code);
          onScan(latest.code);
        }
      } catch {
        // session may have expired
      }
    };

    pollRef.current = setInterval(poll, 1500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pairingSession, tabIndex, onScan]);

  // Auto-start pairing when switching to tab 1
  useEffect(() => {
    if (tabIndex === 1 && !pairingSession && open) {
      startPairing();
    }
  }, [tabIndex, pairingSession, open, startPairing]);

  // ─── Handle tab changes ───
  const handleTabChange = async (_e, newValue) => {
    // Stop current mode
    if (tabIndex === 0) await stopLocalCamera();
    if (tabIndex === 1) await stopPairing();
    setTabIndex(newValue);
  };

  // ─── Manual submit ───
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      handleClose();
    }
  };

  // ─── Close ───
  const handleClose = useCallback(async () => {
    await stopLocalCamera();
    await stopPairing();
    setManualCode('');
    setError('');
    setTabIndex(0);
    onClose();
  }, [stopLocalCamera, stopPairing, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocalCamera();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stopLocalCamera]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <QrCodeScannerIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" component="span" fontWeight={600}>
            {t('scanner_title', 'Escanear Código')}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={handleClose} aria-label={t('common_cerrar', 'Cerrar')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="warning" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<CameraAltIcon />}
            iconPosition="start"
            label={t('scanner_tab_local', 'Cámara Local')}
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
          <Tab
            icon={<PhonelinkIcon />}
            iconPosition="start"
            label={t('scanner_tab_mobile', 'Escanear con Celular')}
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
        </Tabs>

        {/* Tab 0: Local Camera */}
        {tabIndex === 0 && (
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                bgcolor: 'grey.900',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* html5-qrcode renders inside this div */}
              <div
                id={READER_ID}
                style={{
                  width: '100%',
                  height: '100%',
                  display: cameraActive ? 'block' : 'none',
                }}
              />

              {!cameraActive && (
                <Stack spacing={2} alignItems="center" sx={{ color: 'white', p: 3 }}>
                  <CameraAltIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                  <Button
                    variant="contained"
                    startIcon={<CameraAltIcon />}
                    onClick={startLocalCamera}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('scanner_scan', 'Iniciar Escaneo')}
                  </Button>
                </Stack>
              )}

              {scanning && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    zIndex: 10,
                  }}
                >
                  <CircularProgress size={14} sx={{ color: 'success.main' }} />
                  <Typography variant="caption">
                    {t('scanner_scanning', 'Escaneando...')}
                  </Typography>
                </Stack>
              )}

              {cameraActive && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={stopLocalCamera}
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textTransform: 'none',
                    zIndex: 10,
                  }}
                >
                  {t('scanner_stop', 'Detener')}
                </Button>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
              {t('scanner_hint', 'Apunta la cámara hacia el código de barras o QR')}
            </Typography>
          </Box>
        )}

        {/* Tab 1: Mobile Pairing */}
        {tabIndex === 1 && (
          <Box sx={{ mb: 3 }}>
            {!qrDataUri ? (
              <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  {t('scanner_creating_session', 'Creando sesión...')}
                </Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={2}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {t('scanner_scan_qr_instruction', 'Escaneá este QR con tu celular para abrir la cámara remota')}
                </Typography>

                <Box
                  component="img"
                  src={qrDataUri}
                  alt="QR Code"
                  sx={{
                    width: 220,
                    height: 220,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: 'divider',
                  }}
                />

                {/* Remote codes received */}
                {remoteCodes.length > 0 && (
                  <Stack spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    {lastRemoteCode && (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label={lastRemoteCode}
                        color="success"
                        sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {t('scanner_codes_received', '{count} código(s) recibido(s)').replace('{count}', remoteCodes.length)}
                    </Typography>
                  </Stack>
                )}

                {remoteCodes.length === 0 && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      {t('scanner_waiting_mobile', 'Esperando escaneo del celular...')}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            )}
          </Box>
        )}

        {/* Manual Input - always visible */}
        <Box component="form" onSubmit={handleManualSubmit}>
          <Typography
            variant="caption"
            fontWeight={600}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}
          >
            {t('scanner_manual_input', 'O ingresa el código manualmente')}
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t('scanner_code_placeholder', 'Ej: 10000123')}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            InputProps={{
              endAdornment: manualCode && (
                <IconButton size="small" onClick={() => setManualCode('')}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
        <Button onClick={handleClose} variant="outlined" sx={{ textTransform: 'none' }}>
          {t('common_cancelar', 'Cancelar')}
        </Button>
        <Button
          onClick={handleManualSubmit}
          disabled={!manualCode.trim()}
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          {t('scanner_use_code', 'Usar Código')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
