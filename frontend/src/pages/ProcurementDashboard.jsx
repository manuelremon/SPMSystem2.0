/**
 * ProcurementDashboard - Dashboard de Procurement SAP
 * ✨ Migrado a SPMAgGrid para mejor rendimiento
 * Visualizacion de KPIs de requisiciones, ordenes de compra, lead times y cumplimiento
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { procurementService } from '../services/procurement';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';

// MUI Icons
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import GroupIcon from '@mui/icons-material/Group';
import UploadFileIcon from '@mui/icons-material/UploadFile';

// Componente StatCard estilo MUI
const StatCard = ({ title, value, subtitle, icon: Icon, color = 'var(--primary)', trend }) => (
  <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700, color }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {trend !== undefined && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.5,
              color: trend >= 0 ? "success.main" : "error.main",
              fontWeight: 500
            }}
          >
            {trend >= 0 ? '+' : ''}{trend}% vs periodo anterior
          </Typography>
        )}
      </Box>
      <Box sx={{
        p: 1.5,
        bgcolor: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <Icon sx={{ fontSize: 28, color }} />
      </Box>
    </Box>
  </Paper>
);

// Componente Gauge para OTIF
const OTIFGauge = ({ value }) => {
  const getColor = (val) => {
    if (val >= 90) return 'var(--success)';
    if (val >= 70) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box sx={{ position: "relative", width: 140, height: 140 }}>
        <svg width="100%" height="100%" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={getColor(value)}
            strokeWidth="3"
            strokeDasharray={`${value}, 100`}
          />
        </svg>
        <Box sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: getColor(value) }}>
            {value}%
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mt: 1 }}>
        OTIF
      </Typography>
      <Typography variant="caption" color="text.secondary">
        A tiempo y completo
      </Typography>
    </Box>
  );
};

/**
 * Tabla Top Proveedores migrada a SPMAgGrid
 */
function TopProveedoresTable({ data }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, idx) => ({ ...item, id: idx }));
  }, [data]);

  const columnDefs = useMemo(() => [
    {
      field: 'proveedor_nombre',
      headerName: t('common_supplier', 'Proveedor'),
      flex: 0.6,
      minWidth: 150,
      valueFormatter: (params) => params.value || 'Sin nombre',
    },
    {
      field: 'pedidos',
      headerName: t('procurement_orders', 'Pedidos'),
      flex: 0.3,
      minWidth: 100,
      type: 'numericColumn',
      valueFormatter: (params) => params.value?.toLocaleString() || '0',
    },
    {
      field: 'valor_total',
      headerName: t('common_total_value', 'Valor Total'),
      flex: 0.4,
      minWidth: 120,
      type: 'numericColumn',
      cellStyle: { textAlign: 'right', paddingRight: '16px' },
      valueFormatter: (params) =>
        `$${(params.value || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`,
    },
  ], [t]);

  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
        {t('common_no_data', 'No hay datos disponibles')}
      </Typography>
    );
  }

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={250}
      pagination={false}
      enableQuickFilter={true}
      exportFileName="procurement_top_proveedores"
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  );
}

/**
 * Tabla Cumplimiento por Proveedor migrada a SPMAgGrid
 */
function ComplianceTable({ data }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(0, 10).map((item, idx) => ({ ...item, id: idx }));
  }, [data]);

  const getColor = (value) => {
    if (value >= 80) return 'var(--success)';
    if (value >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const columnDefs = useMemo(() => [
    {
      field: 'proveedor_nombre',
      headerName: t('common_supplier', 'Proveedor'),
      flex: 0.5,
      minWidth: 150,
      valueFormatter: (params) => params.value || 'Sin nombre',
    },
    {
      field: 'total_pedidos',
      headerName: t('procurement_orders', 'Pedidos'),
      flex: 0.25,
      minWidth: 80,
      type: 'numericColumn',
    },
    {
      field: 'pct_a_tiempo',
      headerName: '% A Tiempo',
      flex: 0.25,
      minWidth: 100,
      cellRenderer: (params) => (
        <Typography
          variant="body2"
          sx={{
            color: getColor(params.value),
            fontWeight: 500,
          }}
        >
          {params.value}%
        </Typography>
      ),
    },
    {
      field: 'pct_completas',
      headerName: '% Completas',
      flex: 0.25,
      minWidth: 100,
      cellRenderer: (params) => (
        <Typography
          variant="body2"
          sx={{
            color: getColor(params.value),
            fontWeight: 500,
          }}
        >
          {params.value}%
        </Typography>
      ),
    },
    {
      field: 'pct_otif',
      headerName: '% OTIF',
      flex: 0.25,
      minWidth: 80,
      cellRenderer: (params) => (
        <Typography
          variant="body2"
          sx={{
            color: getColor(params.value),
            fontWeight: 600,
          }}
        >
          {params.value}%
        </Typography>
      ),
    },
  ], [t]);

  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
        {t('common_no_data', 'No hay datos disponibles')}
      </Typography>
    );
  }

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={350}
      pagination={true}
      paginationPageSize={10}
      enableQuickFilter={true}
      exportFileName="procurement_cumplimiento"
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  );
}

/**
 * Tabla Historial de Importaciones migrada a SPMAgGrid
 */
function ImportHistoryTable({ data }) {
  const { t } = useI18n();

  const rows = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, idx) => ({ ...item, id: idx }));
  }, [data]);

  const columnDefs = useMemo(() => [
    {
      field: 'filename',
      headerName: t('common_file', 'Archivo'),
      flex: 0.4,
      minWidth: 150,
    },
    {
      field: 'started_at',
      headerName: t('common_date', 'Fecha'),
      flex: 0.4,
      minWidth: 150,
      valueFormatter: (params) =>
        params.value
          ? new Date(params.value).toLocaleString('es-AR')
          : '-',
    },
    {
      field: 'records_inserted',
      headerName: t('procurement_inserted', 'Insertados'),
      flex: 0.25,
      minWidth: 100,
      type: 'numericColumn',
    },
    {
      field: 'records_updated',
      headerName: t('procurement_updated', 'Actualizados'),
      flex: 0.25,
      minWidth: 100,
      type: 'numericColumn',
    },
    {
      field: 'status',
      headerName: t('common_status', 'Estado'),
      flex: 0.25,
      minWidth: 100,
      cellRenderer: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={{
            fontSize: "0.7rem",
            bgcolor:
              params.value === 'completed'
                ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                : params.value === 'failed'
                ? 'color-mix(in srgb, var(--danger) 15%, transparent)'
                : 'color-mix(in srgb, var(--warning) 15%, transparent)',
            color:
              params.value === 'completed'
                ? 'var(--success)'
                : params.value === 'failed'
                ? 'var(--danger)'
                : 'var(--warning)',
            fontWeight: 500,
          }}
        />
      ),
    },
  ], [t]);

  if (!data || data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
        {t('common_no_data', 'No hay datos disponibles')}
      </Typography>
    );
  }

  return (
    <SPMAgGrid
      rowData={rows}
      columnDefs={columnDefs}
      height={300}
      pagination={true}
      paginationPageSize={10}
      enableQuickFilter={true}
      exportFileName="procurement_historial_importaciones"
      emptyMessage={t('common_no_data', 'Sin datos')}
    />
  );
}

// Componente principal
export default function ProcurementDashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes');
  const [centro, setCentro] = useState('');

  const [kpis, setKpis] = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [importHistory, setImportHistory] = useState([]);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpisRes, complianceRes, pipelineRes, historyRes] = await Promise.all([
        procurementService.getKPIs({ periodo, centro: centro || undefined }),
        procurementService.getCompliance({ min_pedidos: 3 }),
        procurementService.getPipeline(),
        procurementService.getImportHistory(5)
      ]);

      setKpis(kpisRes.data);
      setCompliance(complianceRes.data?.items || []);
      setPipeline(pipelineRes.data?.items || []);
      setImportHistory(historyRes.data?.items || []);
    } catch (err) {
      console.error('Error fetching procurement data:', err);
      setError('Error al cargar datos de procurement');
    } finally {
      setLoading(false);
    }
  }, [periodo, centro]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const res = await procurementService.importFile(file);
      alert(`Importación completada:\n- Insertados: ${res.data.stats?.solpeds_inserted || 0} SOLPEDs\n- Actualizados: ${res.data.stats?.solpeds_updated || 0}`);
      setShowImportModal(false);
      fetchData();
    } catch (err) {
      console.error('Error importing:', err);
      alert('Error durante la importación: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  if (loading && !kpis) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Skeleton variant="text" width={300} height={40} />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 3 }}>
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header con filtros */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t('procurement_dashboard', 'PANEL DE COMPRAS SAP')}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ fontSize: "0.75rem" }}>Período</InputLabel>
            <Select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              label="Período"
              sx={{ fontSize: "0.75rem" }}
            >
              <MenuItem value="mes">Último Mes</MenuItem>
              <MenuItem value="trimestre">Último Trimestre</MenuItem>
              <MenuItem value="anio">Último Año</MenuItem>
            </Select>
          </FormControl>

          <IconButton
            onClick={fetchData}
            disabled={loading}
            size="small"
            sx={{ color: "text.disabled" }}
          >
            <RefreshIcon className={loading ? 'animate-spin' : ''} />
          </IconButton>

          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => setShowImportModal(true)}
            size="small"
          >
            Importar ZM65
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" icon={<WarningAmberIcon />}>
          {error}
        </Alert>
      )}

      {/* KPIs Cards */}
      {kpis && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
          <StatCard
            title="Requisiciones (SOLPEDs)"
            value={kpis.totales?.solpeds?.toLocaleString() || 0}
            subtitle={`${kpis.totales?.items || 0} items totales`}
            icon={ShoppingCartIcon}
            color="var(--primary)"
          />
          <StatCard
            title="Tiempo de Entrega"
            value={`${kpis.lead_times?.total_dias || 0} días`}
            subtitle={`Aprobación: ${kpis.lead_times?.aprobacion_dias || 0}d | Entrega: ${kpis.lead_times?.entrega_dias || 0}d`}
            icon={AccessTimeIcon}
            color="var(--purple-dark)"
          />
          <StatCard
            title="Entregas a Tiempo"
            value={`${kpis.cumplimiento?.pct_a_tiempo || 0}%`}
            subtitle={`OTIF: ${kpis.cumplimiento?.pct_otif || 0}%`}
            icon={CheckCircleIcon}
            color="var(--success)"
          />
          <StatCard
            title="Proveedores Activos"
            value={kpis.totales?.proveedores_unicos || 0}
            subtitle={`${kpis.totales?.materiales_unicos || 0} materiales únicos`}
            icon={GroupIcon}
            color="var(--warning)"
          />
        </Box>
      )}

      {/* Segunda fila: OTIF Gauge + Top Proveedores */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 2fr" }, gap: 3 }}>
        {/* OTIF Gauge */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 3 }}>
            Cumplimiento OTIF
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <OTIFGauge value={kpis?.cumplimiento?.pct_otif || 0} />
          </Box>
          <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, textAlign: "center" }}>
            <Box>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {kpis?.cumplimiento?.pct_a_tiempo || 0}%
              </Typography>
              <Typography variant="caption" color="text.secondary">A Tiempo</Typography>
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {kpis?.cumplimiento?.pct_completas || 0}%
              </Typography>
              <Typography variant="caption" color="text.secondary">Completas</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Top Proveedores */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
            Top 5 Proveedores por Volumen
          </Typography>
          <TopProveedoresTable data={kpis?.top_proveedores} />
        </Paper>
      </Box>

      {/* Pipeline */}
      {pipeline.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 3 }}>
            Embudo de Conversión
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            {pipeline.map((etapa, idx) => (
              <Box key={idx} sx={{ flex: 1, textAlign: "center" }}>
                <Box sx={{ mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={etapa.porcentaje}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      "& .MuiLinearProgress-bar": { borderRadius: 4 }
                    }}
                  />
                </Box>
                <Typography variant="h5" fontWeight={700} color="text.primary">
                  {etapa.cantidad?.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {etapa.etapa}
                </Typography>
                <Typography variant="caption" color="primary.main" fontWeight={500}>
                  {etapa.porcentaje}%
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Tabla Cumplimiento por Proveedor */}
      {compliance.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
            Cumplimiento por Proveedor
          </Typography>
          <ComplianceTable data={compliance} />
        </Paper>
      )}

      {/* Historial de Importaciones */}
      {importHistory.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary" sx={{ mb: 2 }}>
            Últimas Importaciones
          </Typography>
          <ImportHistoryTable data={importHistory} />
        </Paper>
      )}

      {/* Modal de Importacion */}
      <Dialog
        open={showImportModal}
        onClose={() => !importing && setShowImportModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Importar Archivo ZM65</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Seleccione un archivo Excel (.xlsx) con datos de requisiciones SAP.
          </Typography>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleImport(e.target.files[0]);
              }
            }}
            disabled={importing}
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              border: "1px dashed var(--border)",
              borderRadius: "8px",
              cursor: importing ? "not-allowed" : "pointer"
            }}
          />
          {importing && (
            <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1, color: "var(--primary)" }}>
              <CircularProgress size={16} color="inherit" />
              <Typography variant="body2">Importando...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowImportModal(false)}
            disabled={importing}
            color="inherit"
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
