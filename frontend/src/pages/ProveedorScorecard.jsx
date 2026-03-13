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
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const MAX_COMPARE = 3;
const COMPARE_COLORS = [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[3]];

export default function ProveedorScorecard() {
  const { t } = useI18n();
  const toast = useToast();
  const [ranking, setRanking] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [periodo, setPeriodo] = useState('');

  // Comparison state
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

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
      toast.error(t('scorecard_error', 'Error al cargar scorecard'));
    } finally {
      setDetailLoading(false);
    }
  }, [toast, t]);

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  // --- Comparison logic ---
  const handleToggleCompare = useCallback((proveedorId) => {
    setSelectedForCompare(prev => {
      if (prev.includes(proveedorId)) {
        return prev.filter(id => id !== proveedorId);
      }
      if (prev.length >= MAX_COMPARE) {
        toast.warning(t('scorecard_compare_max', 'Maximo 3 proveedores'));
        return prev;
      }
      return [...prev, proveedorId];
    });
  }, [toast, t]);

  const handleCompare = useCallback(async () => {
    if (selectedForCompare.length < 2) {
      toast.warning(t('scorecard_compare_min', 'Selecciona al menos 2 proveedores'));
      return;
    }
    setCompareLoading(true);
    setCompareOpen(true);
    try {
      const res = await api.post('/procurement/comparar', {
        proveedor_ids: selectedForCompare,
      });
      if (res.data?.ok) {
        setCompareData(res.data.data);
      } else {
        setCompareData(null);
        toast.error(t('scorecard_error', 'Error al cargar scorecard'));
      }
    } catch {
      setCompareData(null);
      toast.error(t('scorecard_error', 'Error al cargar scorecard'));
    } finally {
      setCompareLoading(false);
    }
  }, [selectedForCompare, toast, t]);

  const handleClearSelection = useCallback(() => {
    setSelectedForCompare([]);
  }, []);

  const handleCloseCompare = useCallback(() => {
    setCompareOpen(false);
  }, []);

  // --- Comparison radar data (multi-dataset) ---
  const compareRadarData = useMemo(() => {
    if (!compareData?.proveedores?.length) return null;
    const labels = [
      t('scorecard_entrega', 'Entrega'),
      t('scorecard_calidad', 'Calidad'),
      t('scorecard_precio', 'Precio'),
      t('scorecard_servicio', 'Servicio'),
    ];
    const datasets = compareData.proveedores.map((prov, idx) => {
      const sc = prov.scorecard || {};
      const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
      return {
        label: prov.nombre || prov.proveedor_id,
        data: [
          sc.entrega_score || 0,
          sc.calidad_score || 0,
          sc.precio_score || 0,
          sc.servicio_score || 0,
        ],
        backgroundColor: `${color}25`,
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointRadius: 4,
      };
    });
    return { labels, datasets };
  }, [compareData, t]);

  const compareRadarOptions = useMemo(() => ({
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, font: { size: 10 } },
        pointLabels: { font: { size: 12, weight: 600 } },
      },
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
      tooltip: TOOLTIP_CONFIG,
    },
    animation: ANIMATION_CONFIG,
    maintainAspectRatio: false,
  }), []);

  // Comparison metric rows
  const comparisonMetrics = useMemo(() => {
    if (!compareData?.proveedores?.length) return [];
    return [
      { key: 'score_global', label: 'Score Global' },
      { key: 'entrega_score', label: t('scorecard_entrega', 'Entrega') },
      { key: 'calidad_score', label: t('scorecard_calidad', 'Calidad') },
      { key: 'precio_score', label: t('scorecard_precio', 'Precio') },
      { key: 'servicio_score', label: t('scorecard_servicio', 'Servicio') },
    ];
  }, [compareData, t]);

  // --- Single provider radar/trend data ---
  const radarData = useMemo(() => {
    if (!scorecard?.current) return null;
    const s = scorecard.current;
    return {
      labels: [t('scorecard_entrega', 'Entrega'), t('scorecard_calidad', 'Calidad'), t('scorecard_precio', 'Precio'), t('scorecard_servicio', 'Servicio')],
      datasets: [{
        label: t('scorecard_score_actual', 'Score Actual'),
        data: [s.entrega_score || 0, s.calidad_score || 0, s.precio_score || 0, s.servicio_score || 0],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: SPM_COLORS.primary,
        borderWidth: 2,
        pointBackgroundColor: SPM_COLORS.primary,
        pointRadius: 4,
      }],
    };
  }, [scorecard, t]);

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
        label: t('scorecard_score', 'Score Global'),
        data: hist.map(h => h.score_global || 0),
        borderColor: SPM_COLORS.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    };
  }, [scorecard, t]);

  // --- Ranking columns with checkbox ---
  const rankingColumns = useMemo(() => [
    {
      field: '_select',
      headerName: '',
      width: 50,
      maxWidth: 50,
      minWidth: 50,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (params) => {
        const id = params.data?.proveedor_id;
        const checked = selectedForCompare.includes(id);
        const disabled = !checked && selectedForCompare.length >= MAX_COMPARE;
        return (
          <Checkbox
            size="small"
            checked={checked}
            disabled={disabled}
            onChange={(e) => {
              e.stopPropagation();
              handleToggleCompare(id);
            }}
            onClick={(e) => e.stopPropagation()}
            inputProps={{ 'aria-label': `${t('scorecard_compare_btn', 'Comparar')} ${params.data?.nombre || ''}` }}
            sx={{ p: 0 }}
          />
        );
      },
    },
    { field: 'nombre', headerName: t('scorecard_proveedor', 'Proveedor'), flex: 2, minWidth: 200 },
    {
      field: 'score_global', headerName: t('scorecard_score', 'Score'), width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(1)}` : 'N/A',
    },
    {
      field: 'entrega_score', headerName: t('scorecard_entrega', 'Entrega'), width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(0)}%` : '-',
    },
    {
      field: 'calidad_score', headerName: t('scorecard_calidad', 'Calidad'), width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(0)}%` : '-',
    },
    {
      field: 'precio_score', headerName: t('scorecard_precio', 'Precio'), width: 100,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(0)}%` : '-',
    },
    {
      field: 'tendencia', headerName: t('scorecard_tendencia', 'Tendencia'), width: 100,
      cellRenderer: (p) => {
        if (p.value == null) return '-';
        const arrow = p.value > 0 ? '\u25B2' : p.value < 0 ? '\u25BC' : '\u2014';
        const color = p.value > 0 ? 'var(--success-light)' : p.value < 0 ? 'var(--danger-light)' : 'var(--fg-subtle)';
        return <span style={{ color, fontWeight: 600 }}>{arrow} {Math.abs(p.value).toFixed(1)}</span>;
      },
    },
  ], [t, selectedForCompare, handleToggleCompare]);

  const selectedProvider = ranking.find(r => r.proveedor_id === selectedId);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
        {t('scorecard_title', 'Scorecard de Proveedores')}
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} gap={3}>
        {/* Ranking table */}
        <Paper elevation={0} sx={{ flex: 2, border: '1px solid', borderColor: 'divider' }} aria-label={t('scorecard_ranking', 'Ranking de Proveedores')}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('scorecard_ranking', 'Ranking de Proveedores')}
            </Typography>
            <Stack direction="row" gap={1} alignItems="center">
              {selectedForCompare.length > 0 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={handleClearSelection}
                  aria-label={t('scorecard_compare_clear', 'Limpiar Seleccion')}
                >
                  {t('scorecard_compare_clear', 'Limpiar Seleccion')}
                </Button>
              )}
              {selectedForCompare.length >= 2 && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CompareArrowsIcon />}
                  onClick={handleCompare}
                  aria-label={t('scorecard_compare_btn', 'Comparar Seleccionados')}
                >
                  {t('scorecard_compare_btn', 'Comparar Seleccionados')} ({selectedForCompare.length})
                </Button>
              )}
              {selectedForCompare.length === 1 && (
                <Chip
                  size="small"
                  label={t('scorecard_compare_min', 'Selecciona al menos 2 proveedores')}
                  variant="outlined"
                />
              )}
            </Stack>
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
            emptyMessage={t('scorecard_empty', 'Sin datos de proveedores')}
            getRowId={(params) => String(params.data.proveedor_id || params.data.nombre)}
          />
        </Paper>

        {/* Detail panel */}
        <Paper elevation={0} sx={{ flex: 1, minWidth: 380, border: '1px solid', borderColor: 'divider' }} aria-label="Scorecard detail">
          {!selectedId ? (
            <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>{t('scorecard_select_provider', 'Seleccione un proveedor del ranking')}</Typography>
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
                      label={`Score: ${Number(scorecard.current.score_global || 0).toFixed(1)}`}
                      color={getScoreColor(scorecard.current.score_global || 0)}
                      size="small"
                    />
                  </Stack>
                )}
              </Box>

              {/* Radar chart */}
              {radarData && (
                <Box sx={{ height: 250, position: 'relative' }} role="img" aria-label={t('scorecard_score_actual', 'Score Actual')}>
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
                            {Number(val).toFixed(1)}%
                          </Typography>
                        </Stack>
                        <Box sx={{ height: 6, bgcolor: 'grey.200', overflow: 'hidden' }}>
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
                    {t('scorecard_trend', 'Tendencia (ultimos 12 meses)')}
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
              <Typography>{t('scorecard_no_data', 'No hay datos de scorecard disponibles')}</Typography>
            </Box>
          )}
        </Paper>
      </Stack>

      {/* Comparison Dialog */}
      <Dialog
        open={compareOpen}
        onClose={handleCloseCompare}
        maxWidth="md"
        fullWidth
        aria-labelledby="compare-dialog-title"
      >
        <DialogTitle id="compare-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <CompareArrowsIcon />
            <span>{t('scorecard_compare_title', 'Comparacion de Proveedores')}</span>
          </Stack>
          <IconButton onClick={handleCloseCompare} size="small" aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {compareLoading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : compareData?.proveedores?.length ? (
            <Stack spacing={3}>
              {/* Overlapping Radar Chart */}
              {compareRadarData && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {t('scorecard_score_actual', 'Score Actual')}
                  </Typography>
                  <Box sx={{ height: 320, position: 'relative' }} role="img" aria-label={t('scorecard_compare_title', 'Comparacion de Proveedores')}>
                    <Radar data={compareRadarData} options={compareRadarOptions} />
                  </Box>
                </Box>
              )}

              {/* Comparison Table */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('scorecard_compare_title', 'Comparacion de Proveedores')}
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" aria-label={t('scorecard_compare_title', 'Comparacion de Proveedores')}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('scorecard_score', 'Score')}
                        </TableCell>
                        {compareData.proveedores.map((prov, idx) => (
                          <TableCell
                            key={prov.proveedor_id}
                            align="center"
                            sx={{
                              fontWeight: 700,
                              borderBottom: `3px solid ${COMPARE_COLORS[idx % COMPARE_COLORS.length]}`,
                            }}
                          >
                            {prov.nombre || prov.proveedor_id}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comparisonMetrics.map(metric => {
                        const values = compareData.proveedores.map(
                          prov => prov.scorecard?.[metric.key] ?? null
                        );
                        const maxVal = Math.max(...values.filter(v => v != null));
                        return (
                          <TableRow key={metric.key} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{metric.label}</TableCell>
                            {compareData.proveedores.map((prov) => {
                              const val = prov.scorecard?.[metric.key];
                              const isBest = val != null && val === maxVal && values.filter(v => v === maxVal).length < values.length;
                              return (
                                <TableCell
                                  key={prov.proveedor_id}
                                  align="center"
                                  sx={{
                                    fontWeight: isBest ? 700 : 400,
                                    color: isBest ? 'success.main' : 'text.primary',
                                    bgcolor: isBest ? 'success.lighter' : 'transparent',
                                  }}
                                >
                                  {val != null ? `${Number(val).toFixed(1)}` : '-'}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>{t('scorecard_no_data', 'No hay datos de scorecard disponibles')}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCompare}>{t('common_close', 'Cerrar')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Box>
  );
}
