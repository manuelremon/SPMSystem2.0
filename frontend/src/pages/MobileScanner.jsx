/**
 * MobileScanner - Public page for scanning barcodes from a mobile device.
 * Opened via QR code from the PC's BarcodeScanner dialog.
 * Route: /scan/:sessionId (no auth required)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import api from '../services/api';

const READER_ID = 'mobile-scanner-reader';

export default function MobileScanner() {
  const { sessionId } = useParams();
  const [error, setError] = useState('');
  const [sessionValid, setSessionValid] = useState(null); // null = loading
  const [scannedCodes, setScannedCodes] = useState([]);
  const [lastCode, setLastCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrRef = useRef(null);
  const successTimerRef = useRef(null);

  // Validate session on mount
  useEffect(() => {
    const validate = async () => {
      try {
        // Try submitting an empty code to check if session exists
        // Actually, just try to GET - but it requires auth. Instead, we'll
        // start the camera and handle 404 on first submit.
        setSessionValid(true);
      } catch {
        setSessionValid(false);
      }
    };
    validate();
  }, [sessionId]);

  const stopCamera = useCallback(async () => {
    try {
      if (html5QrRef.current) {
        const state = html5QrRef.current.getState();
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
  }, []);

  const handleCodeScanned = useCallback(async (code) => {
    if (!code || !code.trim()) return;
    const trimmed = code.trim();

    try {
      const res = await api.post(`/scanner/session/${sessionId}/code`, { code: trimmed });
      if (res.data.ok) {
        setScannedCodes(prev => [...prev, trimmed]);
        setLastCode(trimmed);
        setShowSuccess(true);
        setError('');

        // Clear success after 2s
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setError('La sesión ha expirado o no existe. Generá un nuevo QR desde la PC.');
        await stopCamera();
        setSessionValid(false);
      } else if (status === 429) {
        setError('Se alcanzó el límite de códigos por sesión (máx. 10).');
      } else {
        setError('Error al enviar el código. Intentá de nuevo.');
      }
    }
  }, [sessionId, stopCamera]);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(READER_ID);
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleCodeScanned(decodedText);
        },
        () => {} // ignore scan errors
      );
      setCameraActive(true);
    } catch {
      setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
    }
  }, [handleCodeScanned]);

  // Auto-start camera when session is valid
  useEffect(() => {
    if (sessionValid && !cameraActive) {
      startCamera();
    }
  }, [sessionValid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [stopCamera]);

  // Session expired/invalid
  if (sessionValid === false) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 360, textAlign: 'center' }}>
          <QrCodeScannerIcon sx={{ fontSize: 64, color: 'error.main', opacity: 0.6 }} />
          <Typography variant="h6" fontWeight={600}>
            Sesión no disponible
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error || 'Esta sesión ha expirado o no existe. Generá un nuevo QR desde la PC.'}
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.8)', zIndex: 10 }}
      >
        <QrCodeScannerIcon sx={{ color: '#fff' }} />
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
          SPM Scanner
        </Typography>
        <Box sx={{ flex: 1 }} />
        {scannedCodes.length > 0 && (
          <Chip
            label={`${scannedCodes.length} escaneado(s)`}
            size="small"
            sx={{ bgcolor: 'success.main', color: '#fff', fontWeight: 600 }}
          />
        )}
      </Stack>

      {/* Error */}
      {error && (
        <Alert severity="warning" onClose={() => setError('')} sx={{ mx: 2, mt: 1, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Success flash */}
      {showSuccess && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{
            mx: 2,
            mt: 1,
            p: 1.5,
            bgcolor: 'success.main',
            borderRadius: 2,
            animation: 'fadeIn 0.3s ease-in',
            '@keyframes fadeIn': { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
          }}
        >
          <CheckCircleIcon sx={{ color: '#fff' }} />
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
            {lastCode}
          </Typography>
        </Stack>
      )}

      {/* Camera */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          id={READER_ID}
          style={{ width: '100%', height: '100%' }}
        />

        {!cameraActive && sessionValid !== false && (
          <Stack
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ position: 'absolute', inset: 0, color: '#fff' }}
          >
            <QrCodeScannerIcon sx={{ fontSize: 64, opacity: 0.4 }} />
            <Button
              variant="contained"
              onClick={startCamera}
              sx={{ textTransform: 'none' }}
            >
              Iniciar Cámara
            </Button>
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Stack
        direction="row"
        justifyContent="center"
        sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.8)' }}
      >
        <Button
          variant="outlined"
          onClick={() => window.close()}
          sx={{ textTransform: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
        >
          Listo
        </Button>
      </Stack>
    </Box>
  );
}
