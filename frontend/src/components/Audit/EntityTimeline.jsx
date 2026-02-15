/**
 * EntityTimeline - Linea de tiempo de auditoria para una entidad
 *
 * Componente reutilizable que muestra el historial de cambios
 * de cualquier entidad (solicitud, usuario, material, etc.).
 * Sprint 51
 */

import { useState, useEffect, useCallback } from 'react';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useI18n } from '../../context/i18n';
import api from '../../services/api';

const ACTION_ICONS = {
  crear: { color: 'bg-green-500', label: 'C' },
  create: { color: 'bg-green-500', label: 'C' },
  editar: { color: 'bg-blue-500', label: 'E' },
  update: { color: 'bg-blue-500', label: 'E' },
  eliminar: { color: 'bg-red-500', label: 'D' },
  delete: { color: 'bg-red-500', label: 'D' },
  aprobar: { color: 'bg-emerald-500', label: 'A' },
  rechazar: { color: 'bg-orange-500', label: 'R' },
};

function getActionStyle(accion) {
  const lower = (accion || '').toLowerCase();
  return ACTION_ICONS[lower] || { color: 'bg-gray-500', label: '?' };
}

export default function EntityTimeline({ entidad, entidadId }) {
  const { t } = useI18n();
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    if (!entidad || !entidadId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/api/audit/logs/${entidad}/${entidadId}`);
      setTimeline(data.timeline || data.items || []);
    } catch {
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [entidad, entidadId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <CircularProgress size={20} />
        <span className="ml-2 text-sm text-gray-400">
          {t('common_loading', 'Cargando...')}
        </span>
      </div>
    );
  }

  if (!timeline.length) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        {t('audit_no_history', 'Sin historial de cambios')}
      </div>
    );
  }

  return (
    <div className="relative pl-8" role="list" aria-label={t('audit_timeline', 'Historial de cambios')}>
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

      {timeline.map((entry, i) => {
        const style = getActionStyle(entry.accion);
        return (
          <div
            key={entry.id || i}
            className="relative mb-4 last:mb-0"
            role="listitem"
          >
            {/* Timeline dot */}
            <div
              className={`absolute -left-5 top-2 w-4 h-4 rounded-full ${style.color} border-2 border-white flex items-center justify-center`}
            >
              <span className="text-white text-[8px] font-bold">{style.label}</span>
            </div>

            {/* Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <Chip
                  label={entry.accion}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.created_at).toLocaleString()}
                </Typography>
              </div>

              <Typography variant="body2" color="text.primary" sx={{ mb: 0.5 }}>
                {entry.actor_nombre || `User #${entry.actor_id}`}
              </Typography>

              {entry.descripcion && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {entry.descripcion}
                </Typography>
              )}

              {/* Expandable change details */}
              {(entry.datos_anteriores || entry.datos_nuevos) && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                    {t('audit_view_changes', 'Ver cambios')}
                  </summary>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {entry.datos_anteriores && (
                      <div>
                        <span className="inline-block text-red-500 font-medium mb-1">
                          {t('audit_before', 'Antes')}:
                        </span>
                        <pre className="bg-red-50 p-2 rounded border border-red-100 max-h-24 overflow-auto">
                          {JSON.stringify(entry.datos_anteriores, null, 2)}
                        </pre>
                      </div>
                    )}
                    {entry.datos_nuevos && (
                      <div>
                        <span className="inline-block text-green-500 font-medium mb-1">
                          {t('audit_after', 'Despues')}:
                        </span>
                        <pre className="bg-green-50 p-2 rounded border border-green-100 max-h-24 overflow-auto">
                          {JSON.stringify(entry.datos_nuevos, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
