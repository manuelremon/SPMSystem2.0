import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  InputAdornment
} from '@mui/material';
import { Add, Calculate, LocalShipping, Gavel, TrendingDown } from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import { useI18n } from '../context/i18n';

const CustomsOperations = () => {
  const { t } = useI18n();
  const [tabIndex, setTabIndex] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [operaciones, setOperaciones] = useState([]);
  const [acuerdos, setAcuerdos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOperacionOpen, setCreateOperacionOpen] = useState(false);
  const [createAcuerdoOpen, setCreateAcuerdoOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  // Form states
  const [operacionForm, setOperacionForm] = useState({
    tipo: 'importacion',
    numero_despacho: '',
    proveedor_cuit: '',
    fecha_operacion: new Date().toISOString().split('T')[0],
    valor_fob: '',
    flete: '',
    seguro: '',
    moneda: 'USD',
    notas: ''
  });

  const [acuerdoForm, setAcuerdoForm] = useState({
    nombre: '',
    tipo: 'mercosur',
    pais_socio: '',
    preferencia_arancelaria_pct: '',
    fecha_vigencia_desde: '',
    fecha_vigencia_hasta: '',
    requisitos_origen: ''
  });

  const [calculatorForm, setCalculatorForm] = useState({
    valor_fob: '',
    flete: '',
    seguro: '',
    hs_code_id: null,
    acuerdo_id: null
  });

  const [calculatorResult, setCalculatorResult] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [kpisRes, operacionesRes, acuerdosRes] = await Promise.all([
        api.get('/api/customs/kpis'),
        api.get('/api/customs/operations'),
        api.get('/api/customs/agreements')
      ]);

      setKpis(kpisRes.data);
      setOperaciones(operacionesRes.data.operaciones || []);
      setAcuerdos(acuerdosRes.data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperacion = async () => {
    try {
      await api.post('/api/customs/operations', {
        ...operacionForm,
        valor_fob: parseFloat(operacionForm.valor_fob),
        flete: parseFloat(operacionForm.flete),
        seguro: parseFloat(operacionForm.seguro)
      });

      setCreateOperacionOpen(false);
      setOperacionForm({
        tipo: 'importacion',
        numero_despacho: '',
        proveedor_cuit: '',
        fecha_operacion: new Date().toISOString().split('T')[0],
        valor_fob: '',
        flete: '',
        seguro: '',
        moneda: 'USD',
        notas: ''
      });
      cargarDatos();
    } catch (error) {
      alert(t('customs_error_create_operation', 'Error al crear operación'));
    }
  };

  const handleCreateAcuerdo = async () => {
    try {
      await api.post('/api/customs/agreements', {
        ...acuerdoForm,
        preferencia_arancelaria_pct: parseFloat(acuerdoForm.preferencia_arancelaria_pct)
      });

      setCreateAcuerdoOpen(false);
      setAcuerdoForm({
        nombre: '',
        tipo: 'mercosur',
        pais_socio: '',
        preferencia_arancelaria_pct: '',
        fecha_vigencia_desde: '',
        fecha_vigencia_hasta: '',
        requisitos_origen: ''
      });
      cargarDatos();
    } catch (error) {
      alert(t('customs_error_create_agreement', 'Error al crear acuerdo'));
    }
  };

  const handleCalculateDuties = async () => {
    try {
      const response = await api.post('/api/customs/calculate-duties', {
        valor_fob: parseFloat(calculatorForm.valor_fob),
        flete: parseFloat(calculatorForm.flete),
        seguro: parseFloat(calculatorForm.seguro),
        hs_code_id: calculatorForm.hs_code_id,
        acuerdo_id: calculatorForm.acuerdo_id
      });

      setCalculatorResult(response.data);
    } catch (error) {
      alert(t('customs_error_calculate', 'Error al calcular tributos'));
    }
  };

  const handleUpdateEstado = async (operacionId, nuevoEstado) => {
    try {
      await api.put(`/api/customs/operations/${operacionId}`, {
        estado: nuevoEstado
      });
      cargarDatos();
    } catch (error) {
    }
  };

  const columnDefsOperaciones = [
    {
      headerName: t('customs_operation_number', 'Despacho'),
      field: 'numero_despacho',
      width: 130
    },
    {
      headerName: t('customs_type', 'Tipo'),
      field: 'tipo',
      width: 120,
      cellRenderer: (params) => (
        <Chip
          label={params.value === 'importacion' ? t('customs_import', 'Importación') : t('customs_export', 'Exportación')}
          size="small"
          color={params.value === 'importacion' ? 'primary' : 'secondary'}
        />
      )
    },
    {
      headerName: t('customs_date', 'Fecha'),
      field: 'fecha_operacion',
      width: 120
    },
    {
      headerName: t('customs_status', 'Estado'),
      field: 'estado',
      width: 130,
      cellRenderer: (params) => {
        const colors = {
          en_proceso: 'warning',
          despachado: 'info',
          liberado: 'success',
          observado: 'error'
        };
        return (
          <Chip
            label={t(`customs_status_${params.value}`, params.value)}
            size="small"
            color={colors[params.value] || 'default'}
          />
        );
      }
    },
    {
      headerName: t('customs_fob_value', 'Valor FOB'),
      field: 'valor_fob',
      width: 120,
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '-'
    },
    {
      headerName: t('customs_cif_value', 'Valor CIF'),
      field: 'valor_cif',
      width: 120,
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '-'
    },
    {
      headerName: t('customs_duties', 'Aranceles'),
      field: 'aranceles',
      width: 120,
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '-'
    },
    {
      headerName: t('customs_total_duties', 'Total Tributos'),
      field: 'total_tributos',
      width: 130,
      valueFormatter: (params) => params.value ? `$${params.value.toFixed(2)}` : '-'
    },
    {
      headerName: t('customs_currency', 'Moneda'),
      field: 'moneda',
      width: 90
    },
    {
      headerName: t('customs_actions', 'Acciones'),
      field: 'id',
      width: 180,
      cellRenderer: (params) => (
        <Box>
          {params.data.estado === 'en_proceso' && (
            <Button
              size="small"
              onClick={() => handleUpdateEstado(params.value, 'despachado')}
            >
              {t('customs_dispatch', 'Despachar')}
            </Button>
          )}
          {params.data.estado === 'despachado' && (
            <Button
              size="small"
              color="success"
              onClick={() => handleUpdateEstado(params.value, 'liberado')}
            >
              {t('customs_release', 'Liberar')}
            </Button>
          )}
        </Box>
      )
    }
  ];

  const columnDefsAcuerdos = [
    {
      headerName: t('customs_agreement_name', 'Nombre'),
      field: 'nombre',
      flex: 1
    },
    {
      headerName: t('customs_agreement_type', 'Tipo'),
      field: 'tipo',
      width: 130,
      cellRenderer: (params) => (
        <Chip label={params.value.toUpperCase()} size="small" />
      )
    },
    {
      headerName: t('customs_partner_country', 'País Socio'),
      field: 'pais_socio',
      width: 150
    },
    {
      headerName: t('customs_tariff_preference', 'Preferencia Arancelaria'),
      field: 'preferencia_arancelaria_pct',
      width: 180,
      valueFormatter: (params) => `${params.value}%`
    },
    {
      headerName: t('customs_valid_from', 'Vigencia Desde'),
      field: 'fecha_vigencia_desde',
      width: 140
    },
    {
      headerName: t('customs_valid_until', 'Vigencia Hasta'),
      field: 'fecha_vigencia_hasta',
      width: 140
    },
    {
      headerName: t('customs_status', 'Estado'),
      field: 'estado',
      width: 120,
      cellRenderer: (params) => (
        <Chip
          label={t(`customs_status_${params.value}`, params.value)}
          size="small"
          color={params.value === 'active' ? 'success' : 'default'}
        />
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          {t('customs_title', 'Aduanas y Comercio Exterior')}
        </Typography>
      </Box>

      {kpis && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Gavel sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    {t('customs_kpi_month_duties', 'Tributos del Mes')}
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  ${kpis.tributos_mes_actual.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LocalShipping sx={{ mr: 1, color: 'warning.main' }} />
                  <Typography variant="h6">
                    {t('customs_kpi_pending_operations', 'Operaciones Pendientes')}
                  </Typography>
                </Box>
                <Typography variant="h4" color="warning.main">
                  {kpis.operaciones_pendientes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingDown sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h6">
                    {t('customs_kpi_agreement_savings', 'Ahorro por Acuerdos')}
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  ${kpis.ahorro_acuerdos_comerciales.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabIndex} onChange={(e, newValue) => setTabIndex(newValue)}>
          <Tab label={t('customs_tab_operations', 'Operaciones')} />
          <Tab label={t('customs_tab_agreements', 'Acuerdos Comerciales')} />
        </Tabs>
      </Paper>

      {tabIndex === 0 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateOperacionOpen(true)}
            >
              {t('customs_new_operation', 'Nueva Operación')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Calculate />}
              onClick={() => setCalculatorOpen(true)}
            >
              {t('customs_calculate_duties', 'Calcular Tributos')}
            </Button>
          </Box>

          <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={operaciones}
              columnDefs={columnDefsOperaciones}
              pagination={true}
              paginationPageSize={20}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
            />
          </div>
        </Box>
      )}

      {tabIndex === 1 && (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateAcuerdoOpen(true)}
            >
              {t('customs_new_agreement', 'Nuevo Acuerdo')}
            </Button>
          </Box>

          <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={acuerdos}
              columnDefs={columnDefsAcuerdos}
              pagination={true}
              paginationPageSize={20}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
            />
          </div>
        </Box>
      )}

      {/* Dialog: Crear Operación */}
      <Dialog open={createOperacionOpen} onClose={() => setCreateOperacionOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('customs_new_operation', 'Nueva Operación Aduanera')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label={t('customs_type', 'Tipo')}
                value={operacionForm.tipo}
                onChange={(e) => setOperacionForm({ ...operacionForm, tipo: e.target.value })}
              >
                <MenuItem value="importacion">{t('customs_import', 'Importación')}</MenuItem>
                <MenuItem value="exportacion">{t('customs_export', 'Exportación')}</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('customs_operation_number', 'Número de Despacho')}
                value={operacionForm.numero_despacho}
                onChange={(e) => setOperacionForm({ ...operacionForm, numero_despacho: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('customs_supplier_cuit', 'CUIT Proveedor')}
                value={operacionForm.proveedor_cuit}
                onChange={(e) => setOperacionForm({ ...operacionForm, proveedor_cuit: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('customs_date', 'Fecha')}
                value={operacionForm.fecha_operacion}
                onChange={(e) => setOperacionForm({ ...operacionForm, fecha_operacion: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_fob_value', 'Valor FOB')}
                value={operacionForm.valor_fob}
                onChange={(e) => setOperacionForm({ ...operacionForm, valor_fob: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_freight', 'Flete')}
                value={operacionForm.flete}
                onChange={(e) => setOperacionForm({ ...operacionForm, flete: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_insurance', 'Seguro')}
                value={operacionForm.seguro}
                onChange={(e) => setOperacionForm({ ...operacionForm, seguro: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label={t('customs_currency', 'Moneda')}
                value={operacionForm.moneda}
                onChange={(e) => setOperacionForm({ ...operacionForm, moneda: e.target.value })}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="ARS">ARS</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('customs_notes', 'Notas')}
                value={operacionForm.notas}
                onChange={(e) => setOperacionForm({ ...operacionForm, notas: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
                <Typography variant="body2">
                  {t('customs_cif_formula', 'Valor CIF = FOB + Flete + Seguro')}
                </Typography>
                <Typography variant="h6">
                  CIF: ${(parseFloat(operacionForm.valor_fob || 0) + parseFloat(operacionForm.flete || 0) + parseFloat(operacionForm.seguro || 0)).toFixed(2)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOperacionOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreateOperacion} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Crear Acuerdo */}
      <Dialog open={createAcuerdoOpen} onClose={() => setCreateAcuerdoOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('customs_new_agreement', 'Nuevo Acuerdo Comercial')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('customs_agreement_name', 'Nombre')}
                value={acuerdoForm.nombre}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, nombre: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label={t('customs_agreement_type', 'Tipo')}
                value={acuerdoForm.tipo}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, tipo: e.target.value })}
              >
                <MenuItem value="mercosur">Mercosur</MenuItem>
                <MenuItem value="bilateral">Bilateral</MenuItem>
                <MenuItem value="gsp">GSP</MenuItem>
                <MenuItem value="otro">Otro</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('customs_partner_country', 'País Socio')}
                value={acuerdoForm.pais_socio}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, pais_socio: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_tariff_preference', 'Preferencia Arancelaria (%)')}
                value={acuerdoForm.preferencia_arancelaria_pct}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, preferencia_arancelaria_pct: e.target.value })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('customs_valid_from', 'Vigencia Desde')}
                value={acuerdoForm.fecha_vigencia_desde}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, fecha_vigencia_desde: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('customs_valid_until', 'Vigencia Hasta')}
                value={acuerdoForm.fecha_vigencia_hasta}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, fecha_vigencia_hasta: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('customs_origin_requirements', 'Requisitos de Origen')}
                value={acuerdoForm.requisitos_origen}
                onChange={(e) => setAcuerdoForm({ ...acuerdoForm, requisitos_origen: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateAcuerdoOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreateAcuerdo} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Calculadora de Tributos */}
      <Dialog open={calculatorOpen} onClose={() => setCalculatorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('customs_calculate_duties', 'Calculadora de Tributos')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_fob_value', 'Valor FOB')}
                value={calculatorForm.valor_fob}
                onChange={(e) => setCalculatorForm({ ...calculatorForm, valor_fob: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_freight', 'Flete')}
                value={calculatorForm.flete}
                onChange={(e) => setCalculatorForm({ ...calculatorForm, flete: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('customs_insurance', 'Seguro')}
                value={calculatorForm.seguro}
                onChange={(e) => setCalculatorForm({ ...calculatorForm, seguro: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>

            {calculatorResult && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
                  <Typography variant="subtitle2">{t('customs_calculation_result', 'Resultado del Cálculo')}</Typography>
                  <Typography variant="body1">Valor CIF: ${calculatorResult.valor_cif}</Typography>
                  <Typography variant="body1">Arancel Base: {calculatorResult.arancel_pct}%</Typography>
                  {calculatorResult.preferencia_pct > 0 && (
                    <Typography variant="body1">Preferencia: {calculatorResult.preferencia_pct}%</Typography>
                  )}
                  <Typography variant="body1">Arancel Efectivo: {calculatorResult.arancel_efectivo_pct}%</Typography>
                  <Typography variant="h6" color="primary">
                    Total Tributos: ${calculatorResult.total_tributos}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalculatorOpen(false)}>{t('common_close', 'Cerrar')}</Button>
          <Button onClick={handleCalculateDuties} variant="contained">
            {t('common_calculate', 'Calcular')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomsOperations;
