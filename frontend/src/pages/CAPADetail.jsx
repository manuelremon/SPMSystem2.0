import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const estadoBadge = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  implemented: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
};

const estadoLabel = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  implemented: 'Implementada',
  verified: 'Verificada',
  closed: 'Cerrada',
};

export default function CAPADetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useToast();
  const [capa, setCapa] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [implementacion, setImplementacion] = useState('');
  const [verifyModal, setVerifyModal] = useState(false);
  const [efectividad, setEfectividad] = useState('');

  const fetchDetail = useCallback(async () => {
    try {
      const { data } = await api.get(`/quality/capa/${id}`);
      setCapa(data.capa || data);
      setHistorial(data.historial || []);
      setImplementacion(data.capa?.accion_implementada || '');
    } catch {
      showError(t('capa_error_loading', 'Error al cargar CAPA'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleStatusChange = async () => {
    try {
      await api.put(`/quality/capa/${id}/status`, {
        estado: statusModal,
        notas: statusNotes,
        accion_implementada: statusModal === 'implemented' ? implementacion : undefined,
      });
      showSuccess(t('capa_status_updated', 'Estado actualizado'));
      setStatusModal(null);
      setStatusNotes('');
      fetchDetail();
    } catch {
      showError(t('capa_error_status', 'Error al cambiar estado'));
    }
  };

  const handleVerify = async () => {
    try {
      await api.put(`/quality/capa/${id}/verify`, { efectividad });
      showSuccess(t('capa_verified', 'Efectividad verificada'));
      setVerifyModal(false);
      fetchDetail();
    } catch {
      showError(t('capa_error_verify', 'Error al verificar'));
    }
  };

  if (loading) return <div className="p-6 text-gray-400">{t('common_loading', 'Cargando...')}</div>;
  if (!capa) return <div className="p-6 text-gray-400">{t('capa_not_found', 'CAPA no encontrada')}</div>;

  const actions = {
    pending: [{ label: 'Iniciar', estado: 'in_progress', color: 'bg-blue-600' }],
    in_progress: [{ label: 'Marcar Implementada', estado: 'implemented', color: 'bg-yellow-600' }],
    implemented: [{ label: 'Verificar Efectividad', action: () => setVerifyModal(true), color: 'bg-green-600' }],
    verified: [{ label: 'Cerrar', estado: 'closed', color: 'bg-purple-600' }],
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/quality/capa')} className="text-sm text-blue-600 hover:underline mb-1">
            ← {t('capa_back', 'Volver a CAPAs')}
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {capa.numero_capa}
            <span className={`px-2 py-0.5 rounded-full text-xs ${estadoBadge[capa.estado] || 'bg-gray-100'}`}>
              {estadoLabel[capa.estado] || capa.estado}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${capa.tipo === 'corrective' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {capa.tipo === 'corrective' ? 'Correctiva' : 'Preventiva'}
            </span>
          </h1>
        </div>
        <div className="flex gap-2">
          {(actions[capa.estado] || []).map((action, i) => (
            <button
              key={i}
              onClick={() => action.action ? action.action() : setStatusModal(action.estado)}
              className={`px-4 py-2 text-white rounded text-sm hover:opacity-90 ${action.color}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">{t('capa_info', 'Información')}</h3>
          <div><span className="text-sm text-gray-500">{t('capa_title', 'Título')}:</span> <span className="ml-2">{capa.titulo}</span></div>
          {capa.ncr_id && <div><span className="text-sm text-gray-500">NCR:</span> <button onClick={() => navigate(`/quality/ncr/${capa.ncr_id}`)} className="ml-2 text-blue-600 hover:underline">NCR #{capa.ncr_id}</button></div>}
          <div><span className="text-sm text-gray-500">{t('capa_responsible', 'Responsable')}:</span> <span className="ml-2">User #{capa.responsable_id}</span></div>
          {capa.verificador_id && <div><span className="text-sm text-gray-500">{t('capa_verifier', 'Verificador')}:</span> <span className="ml-2">User #{capa.verificador_id}</span></div>}
          <div><span className="text-sm text-gray-500">{t('capa_target_date', 'Fecha Objetivo')}:</span> <span className="ml-2">{capa.fecha_objetivo ? new Date(capa.fecha_objetivo).toLocaleDateString() : '-'}</span></div>
          {capa.fecha_implementacion && <div><span className="text-sm text-gray-500">{t('capa_impl_date', 'Implementada')}:</span> <span className="ml-2">{new Date(capa.fecha_implementacion).toLocaleDateString()}</span></div>}
          {capa.fecha_verificacion && <div><span className="text-sm text-gray-500">{t('capa_verify_date', 'Verificada')}:</span> <span className="ml-2">{new Date(capa.fecha_verificacion).toLocaleDateString()}</span></div>}
          {capa.efectividad && <div><span className="text-sm text-gray-500">{t('capa_effectiveness', 'Efectividad')}:</span> <span className="ml-2">{capa.efectividad}</span></div>}
        </div>

        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">{t('capa_problem', 'Problema y Acciones')}</h3>
          <div>
            <div className="text-sm text-gray-500 mb-1">{t('capa_problem_desc', 'Descripción del Problema')}</div>
            <div className="text-sm bg-gray-50 p-2 rounded">{capa.descripcion_problema || '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">{t('capa_proposed_action', 'Acción Propuesta')}</div>
            <div className="text-sm bg-gray-50 p-2 rounded">{capa.accion_propuesta || '-'}</div>
          </div>
          {capa.accion_implementada && (
            <div>
              <div className="text-sm text-gray-500 mb-1">{t('capa_implemented_action', 'Acción Implementada')}</div>
              <div className="text-sm bg-green-50 p-2 rounded">{capa.accion_implementada}</div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {historial.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-700 mb-3">{t('capa_timeline', 'Historial')}</h3>
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
            {historial.map((entry, i) => (
              <div key={i} className="relative mb-3">
                <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <div className="text-sm">
                  <span className="font-medium">{estadoLabel[entry.estado_anterior] || entry.estado_anterior}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="font-medium">{estadoLabel[entry.estado_nuevo] || entry.estado_nuevo}</span>
                  <span className="ml-2 text-xs text-gray-400">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                  {entry.notas && <div className="text-xs text-gray-500 mt-1">{entry.notas}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      <Dialog open={!!statusModal} onClose={() => setStatusModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('capa_change_status', 'Cambiar Estado')}</DialogTitle>
        <DialogContent>
          <div className="space-y-3 pt-2">
            <div className="text-sm">
              Estado: <span className="font-semibold">{estadoLabel[capa.estado]}</span> → <span className="font-semibold text-blue-600">{estadoLabel[statusModal]}</span>
            </div>
            {statusModal === 'implemented' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t('capa_impl_action', 'Acción Implementada')}</label>
                <textarea value={implementacion} onChange={e => setImplementacion(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm" />
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('common_notes', 'Notas')}</label>
              <textarea value={statusNotes} onChange={e => setStatusNotes(e.target.value)} rows={2} className="w-full border rounded p-2 text-sm" />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <button onClick={() => setStatusModal(null)} className="px-4 py-2 text-sm text-gray-600">{t('common_cancel', 'Cancelar')}</button>
          <button onClick={handleStatusChange} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">{t('common_confirm', 'Confirmar')}</button>
        </DialogActions>
      </Dialog>

      {/* Verify Modal */}
      <Dialog open={verifyModal} onClose={() => setVerifyModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('capa_verify_title', 'Verificar Efectividad')}</DialogTitle>
        <DialogContent>
          <div className="space-y-3 pt-2">
            <label className="block text-sm text-gray-600">{t('capa_effectiveness', 'Efectividad')}</label>
            <textarea value={efectividad} onChange={e => setEfectividad(e.target.value)} rows={3} placeholder="Describir la efectividad de la acción correctiva/preventiva..." className="w-full border rounded p-2 text-sm" />
          </div>
        </DialogContent>
        <DialogActions>
          <button onClick={() => setVerifyModal(false)} className="px-4 py-2 text-sm text-gray-600">{t('common_cancel', 'Cancelar')}</button>
          <button onClick={handleVerify} disabled={!efectividad.trim()} className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50">{t('capa_verify_btn', 'Verificar')}</button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
