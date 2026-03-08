import React, { useState } from 'react';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

export default function CreateCAPAModal({ open, onClose, ncrId, onCreated }) {
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState({
    tipo: ncrId ? 'corrective' : 'preventive',
    titulo: '',
    descripcion_problema: '',
    accion_propuesta: '',
    responsable_id: '',
    fecha_objetivo: '',
    ncr_id: ncrId || null,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.titulo.trim() || !form.accion_propuesta.trim()) {
      showError(t('capa_required_fields', 'Título y acción propuesta son requeridos'));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.responsable_id) payload.responsable_id = parseInt(payload.responsable_id);
      const { data } = await api.post('/quality/capa', payload);
      showSuccess(t('capa_created', 'CAPA creada exitosamente'));
      onCreated?.(data);
      onClose();
      setForm({ tipo: 'preventive', titulo: '', descripcion_problema: '', accion_propuesta: '', responsable_id: '', fecha_objetivo: '', ncr_id: null });
    } catch {
      showError(t('capa_error_creating', 'Error al crear CAPA'));
    } finally {
      setSaving(false);
    }
  };

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('capa_create_title', 'Crear CAPA')}</DialogTitle>
      <DialogContent>
        <div className="space-y-3 pt-2">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.tipo === 'corrective'} onChange={() => update('tipo', 'corrective')} />
              {t('capa_corrective', 'Correctiva')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.tipo === 'preventive'} onChange={() => update('tipo', 'preventive')} />
              {t('capa_preventive', 'Preventiva')}
            </label>
          </div>
          {ncrId && (
            <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
              Vinculada a NCR #{ncrId}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('capa_title', 'Título')} *</label>
            <input type="text" value={form.titulo} onChange={e => update('titulo', e.target.value)} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('capa_problem_desc', 'Descripción del Problema')}</label>
            <textarea value={form.descripcion_problema} onChange={e => update('descripcion_problema', e.target.value)} rows={2} className="w-full border rounded p-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('capa_proposed_action', 'Acción Propuesta')} *</label>
            <textarea value={form.accion_propuesta} onChange={e => update('accion_propuesta', e.target.value)} rows={2} className="w-full border rounded p-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('capa_responsible', 'Responsable ID')}</label>
              <input type="number" value={form.responsable_id} onChange={e => update('responsable_id', e.target.value)} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('capa_target_date', 'Fecha Objetivo')}</label>
              <input type="date" value={form.fecha_objetivo} onChange={e => update('fecha_objetivo', e.target.value)} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t('common_cancel', 'Cancelar')}</button>
        <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {saving ? t('common_saving', 'Guardando...') : t('common_create', 'Crear')}
        </button>
      </DialogActions>
    </Dialog>
  );
}
