/**
 * AwardRFQModal - Adjudicar RFQ a proveedores ganadores
 *
 * Para cada item, permite seleccionar proveedor ganador y precio adjudicado.
 * Opcion para auto-generar ordenes de compra.
 * Sprint 57
 */

import { useState, useCallback, useMemo } from 'react';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';

export default function AwardRFQModal({ open, onClose, rfqId, items = [], bids = [], onAwarded }) {
  const { t } = useI18n();
  const toast = useToast();

  const [awards, setAwards] = useState({});
  const [generatePOs, setGeneratePOs] = useState(false);
  const [saving, setSaving] = useState(false);

  // Unique suppliers from bids
  const suppliers = useMemo(() => {
    const map = new Map();
    bids.forEach((bid) => {
      const key = bid.proveedor_id || bid.proveedor_cuit || bid.proveedor_nombre;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          nombre: bid.proveedor_nombre || key,
        });
      }
    });
    return Array.from(map.values());
  }, [bids]);

  const handleSupplierChange = useCallback((itemId, supplierId) => {
    setAwards((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        proveedor_id: supplierId,
      },
    }));
  }, []);

  const handlePriceChange = useCallback((itemId, price) => {
    setAwards((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        precio_adjudicado: price,
      },
    }));
  }, []);

  const hasAnyAward = useMemo(
    () => Object.values(awards).some((a) => a.proveedor_id),
    [awards]
  );

  const handleAward = useCallback(async () => {
    if (!hasAnyAward) {
      toast.warning(t('rfq_adjudicar_seleccionar', 'Seleccione al menos un proveedor ganador'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        adjudicaciones: Object.entries(awards)
          .filter(([, a]) => a.proveedor_id)
          .map(([itemId, a]) => ({
            item_id: itemId,
            proveedor_id: a.proveedor_id,
            precio_adjudicado: a.precio_adjudicado ? Number(a.precio_adjudicado) : null,
          })),
        generar_ordenes_compra: generatePOs,
      };

      const res = await api.post(`/rfq/${rfqId}/award`, payload);
      if (res.data?.ok) {
        toast.success(t('rfq_adjudicada', 'RFQ adjudicada exitosamente'));
        onAwarded?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rfq_error_adjudicar', 'Error al adjudicar RFQ'));
    } finally {
      setSaving(false);
    }
  }, [awards, generatePOs, hasAnyAward, rfqId, onAwarded, t, toast]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="award-dialog-title"
    >
      <DialogTitle id="award-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <EmojiEventsIcon color="success" />
          <span>{t('rfq_adjudicar_titulo', 'Adjudicar RFQ')}</span>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label={t('common_cerrar', 'Cerrar')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Alert severity="info">
            {t('rfq_adjudicar_info', 'Seleccione el proveedor ganador para cada item y opcionalmente el precio adjudicado.')}
          </Alert>

          {items.length === 0 ? (
            <Alert severity="warning">
              {t('rfq_sin_items_adjudicar', 'No hay items para adjudicar')}
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small" aria-label={t('rfq_adjudicar_tabla', 'Adjudicacion por item')}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t('rfq_item', 'Item')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t('rfq_cantidad', 'Cant.')}</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>{t('rfq_proveedor_ganador', 'Proveedor Ganador')}</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>{t('rfq_precio_adjudicado', 'Precio Adj.')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => {
                    const itemId = item.id || item.material_codigo;
                    const award = awards[itemId] || {};
                    return (
                      <TableRow key={itemId}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.material_codigo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.descripcion}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.cantidad} {item.unidad}</TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <InputLabel>{t('rfq_seleccionar', 'Seleccionar')}</InputLabel>
                            <Select
                              value={award.proveedor_id || ''}
                              onChange={(e) => handleSupplierChange(itemId, e.target.value)}
                              label={t('rfq_seleccionar', 'Seleccionar')}
                            >
                              <MenuItem value="">
                                <em>{t('rfq_ninguno', 'Ninguno')}</em>
                              </MenuItem>
                              {suppliers.map((sup) => (
                                <MenuItem key={sup.id} value={sup.id}>
                                  {sup.nombre}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={award.precio_adjudicado || ''}
                            onChange={(e) => handlePriceChange(itemId, e.target.value)}
                            placeholder="USD"
                            inputProps={{ min: 0, step: 0.01 }}
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={generatePOs}
                onChange={(e) => setGeneratePOs(e.target.checked)}
              />
            }
            label={t('rfq_generar_oc', 'Generar Ordenes de Compra automaticamente')}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common_cancelar', 'Cancelar')}</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleAward}
          disabled={saving || !hasAnyAward}
          startIcon={saving ? <CircularProgress size={16} /> : <EmojiEventsIcon />}
        >
          {saving ? t('rfq_adjudicando', 'Adjudicando...') : t('rfq_confirmar_adjudicacion', 'Confirmar Adjudicacion')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
