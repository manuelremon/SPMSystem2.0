import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/i18n';
import { useUserRoles } from '../../hooks/useUserRoles';
import { cachedGet } from '../../services/cachedApi';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import VerifiedIcon from '@mui/icons-material/Verified';
import InventoryIcon from '@mui/icons-material/Inventory';

const MODULE_CONFIGS = [
  {
    id: 'tms',
    label: 'dash_ops_transport',
    fallback: 'Transporte',
    icon: LocalShippingIcon,
    api: '/tms/kpis',
    path: '/tms',
    roles: ['admin', 'jefe'],
    metrics: (data) => [
      { label: 'Envíos activos', value: data?.envios_activos ?? data?.active_shipments ?? '-' },
      { label: '% A tiempo', value: data?.on_time_pct != null ? `${Math.round(data.on_time_pct)}%` : (data?.porcentaje_a_tiempo != null ? `${Math.round(data.porcentaje_a_tiempo)}%` : '-') },
    ],
  },
  {
    id: 'fms',
    label: 'dash_ops_fleet',
    fallback: 'Flota',
    icon: DirectionsCarIcon,
    api: '/fms/kpis',
    path: '/fms',
    roles: ['admin', 'jefe'],
    metrics: (data) => [
      { label: 'Disponibles', value: data?.vehiculos_disponibles != null ? `${data.vehiculos_disponibles}/${data.vehiculos_total ?? '?'}` : (data?.available != null ? `${data.available}/${data.total ?? '?'}` : '-') },
      { label: 'OTs abiertas', value: data?.ots_abiertas ?? data?.open_work_orders ?? '-' },
    ],
  },
  {
    id: 'quality',
    label: 'dash_ops_quality',
    fallback: 'Calidad',
    icon: VerifiedIcon,
    api: '/quality/kpis',
    path: '/quality',
    roles: ['admin', 'jefe', 'planificador'],
    metrics: (data) => [
      { label: 'Pass rate', value: data?.pass_rate != null ? `${Math.round(data.pass_rate)}%` : (data?.tasa_aprobacion != null ? `${Math.round(data.tasa_aprobacion)}%` : '-') },
      { label: 'NCRs', value: data?.ncrs_abiertas ?? data?.open_ncrs ?? '-' },
    ],
  },
  {
    id: 'mrp',
    label: 'dash_ops_mrp',
    fallback: 'MRP',
    icon: InventoryIcon,
    api: '/mrp/kpis',
    path: '/mrp',
    roles: ['admin', 'jefe', 'planificador'],
    metrics: (data) => [
      { label: 'En riesgo', value: data?.materiales_en_riesgo ?? data?.at_risk ?? '-' },
      { label: 'Sobrestock', value: data?.sobrestock ?? data?.overstock ?? '-' },
    ],
  },
];

/**
 * ModuleCard - Compact card showing module KPIs.
 */
function ModuleCard({ config, t }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await cachedGet(config.api);
        if (!cancelled) {
          setData(res.data?.data || res.data || {});
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [config.api]);

  const Icon = config.icon;
  const metrics = !loading && !error && data ? config.metrics(data) : [];

  return (
    <Paper
      elevation={0}
      onClick={() => navigate(config.path)}
      sx={{
        flex: '1 1 200px',
        minWidth: 180,
        maxWidth: 280,
        bgcolor: 'var(--surface)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.5,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>
          {t(config.label, config.fallback)}
        </Typography>
      </Stack>

      {loading ? (
        <Stack gap={0.5}>
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="50%" height={20} />
        </Stack>
      ) : error ? (
        <Typography variant="caption" sx={{ color: 'grey.400' }}>
          {t('dash_ops_unavailable', 'No disponible')}
        </Typography>
      ) : (
        <Stack gap={0.25}>
          {metrics.map((m, i) => (
            <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ color: 'grey.600', fontSize: '0.72rem' }}>
                {m.label}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                {m.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

/**
 * OperationsOverview - Cross-module KPI grid.
 * Lazy-loaded via IntersectionObserver, staggered fetch with cachedGet.
 * Only visible to admin/jefe; planner sees Quality + MRP.
 */
function OperationsOverview() {
  const { t } = useI18n();
  const { hasRole } = useUserRoles();
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filter modules by role
  const visibleModules = MODULE_CONFIGS.filter(config =>
    config.roles.some(role => hasRole(role))
  );

  if (visibleModules.length === 0) return null;

  return (
    <Box ref={ref}>
      {visible && (
        <>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontSize: '0.7rem',
              mb: 1,
              display: 'block',
            }}
          >
            {t('dash_ops_title', 'Operaciones')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            {visibleModules.map(config => (
              <ModuleCard key={config.id} config={config} t={t} />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

export default memo(OperationsOverview);
