/**
 * BarcodeScanner - Camera-based barcode scanner with manual fallback
 * Uses browser's native BarcodeDetector API (Chrome) or manual input
 */
import { useState, useEffect, useRef } from 'react';
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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useI18n } from '../../context/i18n';

export default function BarcodeScanner({ open, onClose, onScan }) {
  const { t } = useI18n();
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Check for BarcodeDetector API support
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      setHasBarcodeDetector(true);
      try {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
        });
      } catch (err) {
        setHasBarcodeDetector(false);
      }
    }
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);

        // Start scanning if BarcodeDetector is available
        if (hasBarcodeDetector && detectorRef.current) {
          setScanning(true);
          scanIntervalRef.current = setInterval(detectBarcode, 500);
        }
      }
    } catch (err) {
      setError(t('scanner_no_camera', 'No se pudo acceder a la cámara. Usa el campo manual.'));
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setScanning(false);
  };

  // Detect barcode from video
  const detectBarcode = async () => {
    if (!videoRef.current || !detectorRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);

      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        handleCodeDetected(code);
      }
    } catch (err) {
    }
  };

  // Handle detected/entered code
  const handleCodeDetected = (code) => {
    if (code && code.trim()) {
      stopCamera();
      onScan(code.trim());
      handleClose();
    }
  };

  // Handle manual submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleCodeDetected(manualCode.trim());
    }
  };

  // Handle close
  const handleClose = () => {
    stopCamera();
    setManualCode('');
    setError('');
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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

        {/* Camera View */}
        {hasBarcodeDetector && (
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                bgcolor: 'grey.900',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: cameraActive ? 'block' : 'none',
                }}
              />

              {!cameraActive && (
                <Stack spacing={2} alignItems="center" sx={{ color: 'white', p: 3 }}>
                  <CameraAltIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                  <Button
                    variant="contained"
                    startIcon={<CameraAltIcon />}
                    onClick={startCamera}
                    sx={{ textTransform: 'none' }}
                  >
                    {t('scanner_scan', 'Iniciar Escaneo')}
                  </Button>
                </Stack>
              )}

              {scanning && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: 4,
                    borderColor: 'success.main',
                    borderRadius: 2,
                    pointerEvents: 'none',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.3 },
                      '50%': { opacity: 1 },
                    },
                  }}
                />
              )}

              {scanning && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                  }}
                >
                  <CircularProgress size={16} sx={{ color: 'success.main' }} />
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
                  onClick={stopCamera}
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textTransform: 'none',
                  }}
                >
                  {t('scanner_stop', 'Detener')}
                </Button>
              )}
            </Box>

            {hasBarcodeDetector && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                {t('scanner_hint', 'Apunta la cámara hacia el código de barras o QR')}
              </Typography>
            )}
          </Box>
        )}

        {/* Manual Input */}
        <Box component="form" onSubmit={handleManualSubmit}>
          <Typography
            variant="caption"
            fontWeight={600}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}
          >
            {hasBarcodeDetector
              ? t('scanner_manual_input', 'O ingresa el código manualmente')
              : t('scanner_manual_input_only', 'Ingresa el código del material')}
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={t('scanner_code_placeholder', 'Ej: 10000123')}
            autoFocus={!hasBarcodeDetector}
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
