import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { Radar } from 'react-chartjs-2';
import { SPMLine, SPM_COLORS, CHART_PALETTE, TOOLTIP_CONFIG, ANIMATION_CONFIG } from '../components/ui/SPMChartJS';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

export default function ProveedorScorecard() {
  const { t } = useI18n();
  const toast = useToast();
  const [ranking, setRanking] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [periodo, setPeriodo] = useState('');

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        const res = await api.get('/procurement/scorecard/ranking', { params: { limit: 50 } });
        if (res.data?.ok) {
          setRanking(res.data.ranking || []);
        }
      } catch {
        // Fallback: try legacy endpoint
        try {
          const res = await api.get('/procurement/kpis/compliance', { params: { min_pedidos: 1 } });
          const items = res.data?.items || [];
          setRanking(items.map(p => ({
            proveedor_id: p.proveedor_cuit,
            nombre: p.proveedor_nombre,
            score_global: p.pct_otif || 0,
            entrega_score: p.pct_a_tiempo || 0,
            calidad_score: p.pct_completas || 0,
            precio_score: 0,
            servicio_score: 0,
            tendencia: null,
          })));
        } catch { setRanking([]); }
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [periodo]);

  const loadScorecard = useCallback(async (proveedorId) => {
    setSelectedId(proveedorId);
    setDetailLoading(true);
    try {
      const res = await api.get(`/procurement/scorecard/${proveedorId}`, { params: { meses: 12 } });
      if (res.data?.ok) {
        setScorecard(res.data);
      } else {
        setScorecard(res.data);
      }
    } catch {
      setScorecard(null);
      toast.error('Error al cargar scorecard');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const radarData = useMemo(() => {
    if (!scorecard?.current) return null;
    const s = scorecard.current;
    return {
      labels: ['Entrega', 'Calidad', 'Precio', 'Servicio'],
      datasets: [{
        label: 'Score Actual',
        data: [s.entrega_score || 0, s.calidad_score || 0, s.precio_score || 0, s.servicio_score || 0],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: SPM_COLORS.primary,
        borderWidth: 2,
        pointBackgroundColor: SPM_COLORS.primary,
        pointRadius: 4,
      }],
    };
  }, [scorecard]);

  const radarOptions = useMemo(() => ({
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, font: { size: 10 } },
        pointLabels: { font: { size: 12, weight: 600 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: TOOLTIP_CONFIG,
    },
    animation: ANIMATION_CONFIG,
    maintainAspectRatio: false,
  }), []);

  const trendData = useMemo(() => {
    if (!scorecard?.historial?.length) return null;
    const hist = scorecard.historial.slice(-12);
    return {
      labels: hist.map(h => h.periodo),
      datasets: [{
        label: 'Score Global',
        data: hist.map(h => h.score_global || 0),
        borderColor: SPM_COLORS.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    };
  }, [scorecard]);

  const rankingColumns = [
    { field: 'nombre', headerName: 'Proveedor', flex: 2, minWidth: 200 },
    {
      field: 'score_global', headerName: 'Score', width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(1)}` : 'N/A',
    },
    {
      field: 'entrega_score', headerName: 'Entrega', width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(0)}%` : '-',
    },
    {
      field: 'calidad_score', headerName: 'Calidad', width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(0)}%` : '-',
    },
    {
      field: 'precio_score', headerName: 'Precio', width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(0)}%` : '-',
    },
    {
      field: 'tendencia', headerName: 'Tendencia', width: 100,
      cellRenderer: (p) => {
        if (p.value == null) return '-';
        const arrow = p.value > 0 ? '▲' : p.value < 0 ? '▼' : '—';
        const color = p.value > 0 ? '#10b981' : p.value < 0 ? '#ef4444' : '#9ca3af';
        return <span style={{ color, fontWeight: 600 }}>{arrow} {Math.abs(p.value).toFixed(1)}</span>;
      },
    },
  ];

  const selectedProvider = ranking.find(r => r.proveedor_id === selectedId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        {t('scorecard_title', 'Scorecard de Proveedores')}
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} gap={3}>
        {/* Ranking table */}
        <Paper elevation={0} sx={{ flex: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Ranking de Proveedores
            </Typography>
          </Box>
          <SPMAgGrid
            columnDefs={rankingColumns}
            rowData={ranking}
            loading={loading}
            height={500}
            pagination={true}
            paginationPageSize={15}
            enableQuickFilter={true}
            onRowClick={(row) => loadScorecard(row.proveedor_id)}
            exportFileName="ranking_proveedores"
            emptyMessage="Sin datos de proveedores"
            getRowId={(params) => String(params.data.proveedor_id || params.data.nombre)}
          />
        </Paper>

        {/* Detail panel */}
        <Paper elevation={0} sx={{ flex: 1, minWidth: 380, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          {!selectedId ? (
            <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>Seleccione un proveedor del ranking</Typography>
            </Box>
          ) : detailLoading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : scorecard ? (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Header */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {selectedProvider?.nombre || selectedId}
                </Typography>
                {scorecard.current && (
                  <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                    <Chip
                      label={`Score: ${(scorecard.current.score_global || 0).toFixed(1)}`}
                      color={getScoreColor(scorecard.current.score_global || 0)}
                      size="small"
                    />
                  </Stack>
                )}
              </Box>

              {/* Radar chart */}
              {radarData && (
                <Box sx={{ height: 250, position: 'relative' }}>
                  <Radar data={radarData} options={radarOptions} />
                </Box>
              )}

              {/* Score bars */}
              {scorecard.current && (
                <Stack spacing={1.5}>
                  {['entrega', 'calidad', 'precio', 'servicio'].map(dim => {
                    const val = scorecard.current[`${dim}_score`] || 0;
                    return (
                      <Box key={dim}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                            {dim}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: val >= 80 ? 'success.main' : val >= 60 ? 'warning.main' : 'error.main' }}>
                            {val.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <Box sx={{ height: 6, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
                          <Box sx={{
                            height: '100%',
                            width: `${Math.min(val, 100)}%`,
                            bgcolor: val >= 80 ? 'success.main' : val >= 60 ? 'warning.main' : 'error.main',
                            transition: 'width 0.5s',
                          }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}

              {/* Trend chart */}
              {trendData && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Tendencia (últimos 12 meses)
                  </Typography>
                  <Box sx={{ height: 180 }}>
                    <SPMLine
                      data={trendData}
                      height={180}
                      options={{
                        scales: {
                          y: { beginAtZero: true, max: 100 },
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: TOOLTIP_CONFIG,
                        },
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>No hay datos de scorecard disponibles</Typography>
            </Box>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
