import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  InputAdornment,
  Autocomplete,
  Divider,
  Chip
} from '@mui/material';
import { Add, Search, Calculate, Label } from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import api from '../services/api';
import { useI18n } from '../context/i18n';

const HSCodeManagement = () => {
  const { t } = useI18n();
  const [hsCodes, setHsCodes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [createHsCodeOpen, setCreateHsCodeOpen] = useState(false);
  const [classifyMaterialOpen, setClassifyMaterialOpen] = useState(false);
  const [dutiesCalculatorOpen, setDutiesCalculatorOpen] = useState(false);
  const [acuerdos, setAcuerdos] = useState([]);

  // Form states
  const [hsCodeForm, setHsCodeForm] = useState({
    codigo: '',
    descripcion: '',
    arancel_pct: '',
    unidad_medida: '',
    capitulo: '',
    partida: '',
    subpartida: '',
    notas: ''
  });

  const [classifyForm, setClassifyForm] = useState({
    material_codigo: '',
    hs_code_id: null,
    pais_origen: 'AR',
    pais_destino: '',
    certificado_origen: ''
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
    cargarHsCodes();
    cargarAcuerdos();
  }, []);

  const cargarHsCodes = async (search = '') => {
    try {
      const response = await api.get('/api/customs/hs-codes', {
        params: { search, per_page: 100 }
      });
      setHsCodes(response.data.codes || []);
    } catch (error) {
    }
  };

  const cargarAcuerdos = async () => {
    try {
      const response = await api.get('/api/customs/agreements');
      setAcuerdos(response.data || []);
    } catch (error) {
    }
  };

  const handleSearch = () => {
    cargarHsCodes(searchTerm);
  };

  const handleCreateHsCode = async () => {
    try {
      await api.post('/api/customs/hs-codes', {
        ...hsCodeForm,
        arancel_pct: parseFloat(hsCodeForm.arancel_pct)
      });

      setCreateHsCodeOpen(false);
      setHsCodeForm({
        codigo: '',
        descripcion: '',
        arancel_pct: '',
        unidad_medida: '',
        capitulo: '',
        partida: '',
        subpartida: '',
        notas: ''
      });
      cargarHsCodes();
    } catch (error) {
      alert(t('hs_error_create', 'Error al crear código HS'));
    }
  };

  const handleClassifyMaterial = async () => {
    try {
      if (!classifyForm.material_codigo || !classifyForm.hs_code_id) {
        alert(t('hs_error_missing_fields', 'Material y código HS son requeridos'));
        return;
      }

      await api.post('/api/customs/classifications', classifyForm);

      setClassifyMaterialOpen(false);
      setClassifyForm({
        material_codigo: '',
        hs_code_id: null,
        pais_origen: 'AR',
        pais_destino: '',
        certificado_origen: ''
      });
      alert(t('hs_material_classified', 'Material clasificado exitosamente'));
    } catch (error) {
      alert(t('hs_error_classify', 'Error al clasificar material'));
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
      alert(t('hs_error_calculate', 'Error al calcular tributos'));
    }
  };

  const columnDefs = [
    {
      headerName: t('hs_code', 'Código HS'),
      field: 'codigo',
      width: 150,
      cellRenderer: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      )
    },
    {
      headerName: t('hs_description', 'Descripción'),
      field: 'descripcion',
      flex: 1
    },
    {
      headerName: t('hs_tariff', 'Arancel'),
      field: 'arancel_pct',
      width: 110,
      valueFormatter: (params) => `${params.value}%`
    },
    {
      headerName: t('hs_unit', 'Unidad'),
      field: 'unidad_medida',
      width: 100
    },
    {
      headerName: t('hs_chapter', 'Capítulo'),
      field: 'capitulo',
      width: 100
    },
    {
      headerName: t('hs_heading', 'Partida'),
      field: 'partida',
      width: 100
    },
    {
      headerName: t('hs_subheading', 'Subpartida'),
      field: 'subpartida',
      width: 110
    },
    {
      headerName: t('hs_actions', 'Acciones'),
      field: 'id',
      width: 180,
      cellRenderer: (params) => (
        <Button
          size="small"
          onClick={() => {
            setClassifyForm({ ...classifyForm, hs_code_id: params.value });
            setClassifyMaterialOpen(true);
          }}
        >
          {t('hs_classify_material', 'Clasificar Material')}
        </Button>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">
          {t('hs_title', 'Gestión de Códigos HS')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  placeholder={t('hs_search_placeholder', 'Buscar por código o descripción...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    )
                  }}
                />
                <Button variant="contained" onClick={handleSearch}>
                  {t('common_search', 'Buscar')}
                </Button>
                <Button variant="outlined" startIcon={<Add />} onClick={() => setCreateHsCodeOpen(true)}>
                  {t('hs_new_code', 'Nuevo')}
                </Button>
              </Box>

              <SPMAgGrid
                rowData={hsCodes}
                columnDefs={columnDefs}
                pagination={true}
                paginationPageSize={20}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true
                }}
                height={500}
                exportFileName="hs-codes"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Label sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('hs_classify_material', 'Clasificar Material')}
              </Typography>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                onClick={() => setClassifyMaterialOpen(true)}
              >
                {t('hs_classify_new_material', 'Clasificar Material')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Calculate sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('hs_duties_calculator', 'Calculadora de Aranceles')}
              </Typography>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => setDutiesCalculatorOpen(true)}
              >
                {t('hs_calculate_duties', 'Calcular Tributos')}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog: Crear Código HS */}
      <Dialog open={createHsCodeOpen} onClose={() => setCreateHsCodeOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('hs_new_code', 'Nuevo Código HS')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('hs_code', 'Código HS')}
                value={hsCodeForm.codigo}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, codigo: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('hs_tariff', 'Arancel (%)')}
                value={hsCodeForm.arancel_pct}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, arancel_pct: e.target.value })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label={t('hs_description', 'Descripción')}
                value={hsCodeForm.descripcion}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, descripcion: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={t('hs_chapter', 'Capítulo')}
                value={hsCodeForm.capitulo}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, capitulo: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={t('hs_heading', 'Partida')}
                value={hsCodeForm.partida}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, partida: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={t('hs_subheading', 'Subpartida')}
                value={hsCodeForm.subpartida}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, subpartida: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('hs_unit', 'Unidad de Medida')}
                value={hsCodeForm.unidad_medida}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, unidad_medida: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('hs_notes', 'Notas')}
                value={hsCodeForm.notas}
                onChange={(e) => setHsCodeForm({ ...hsCodeForm, notas: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateHsCodeOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreateHsCode} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Clasificar Material */}
      <Dialog open={classifyMaterialOpen} onClose={() => setClassifyMaterialOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('hs_classify_material', 'Clasificar Material')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('hs_material_code', 'Código de Material')}
                value={classifyForm.material_codigo}
                onChange={(e) => setClassifyForm({ ...classifyForm, material_codigo: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                options={hsCodes}
                getOptionLabel={(option) => `${option.codigo} - ${option.descripcion || ''}`}
                value={hsCodes.find((hs) => hs.id === classifyForm.hs_code_id) || null}
                onChange={(e, newValue) => setClassifyForm({ ...classifyForm, hs_code_id: newValue?.id || null })}
                renderInput={(params) => (
                  <TextField {...params} label={t('hs_code', 'Código HS')} required />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('hs_origin_country', 'País de Origen')}
                value={classifyForm.pais_origen}
                onChange={(e) => setClassifyForm({ ...classifyForm, pais_origen: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('hs_destination_country', 'País de Destino')}
                value={classifyForm.pais_destino}
                onChange={(e) => setClassifyForm({ ...classifyForm, pais_destino: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('hs_origin_certificate', 'Certificado de Origen')}
                value={classifyForm.certificado_origen}
                onChange={(e) => setClassifyForm({ ...classifyForm, certificado_origen: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassifyMaterialOpen(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleClassifyMaterial} variant="contained">
            {t('hs_classify', 'Clasificar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Calculadora de Tributos */}
      <Dialog open={dutiesCalculatorOpen} onClose={() => setDutiesCalculatorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('hs_duties_calculator', 'Calculadora de Tributos Aduaneros')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('hs_fob_value', 'Valor FOB')}
                value={calculatorForm.valor_fob}
                onChange={(e) => setCalculatorForm({ ...calculatorForm, valor_fob: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('hs_freight', 'Flete')}
                value={calculatorForm.flete}
                onChange={(e) => setCalculatorForm({ ...calculatorForm, flete: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('hs_insurance', 'Seguro')}
                value={calculatorForm.seguro}
                onChange={(e) => setCalculatorForm({ ...calculatorForm, seguro: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: 'info.light', mb: 2 }}>
                <Typography variant="body2">
                  {t('hs_cif_formula', 'Valor CIF = FOB + Flete + Seguro')}
                </Typography>
                <Typography variant="h6">
                  CIF: ${(parseFloat(calculatorForm.valor_fob || 0) + parseFloat(calculatorForm.flete || 0) + parseFloat(calculatorForm.seguro || 0)).toFixed(2)}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" gutterBottom>
                {t('hs_optional_params', 'Parámetros Opcionales (para cálculo preciso)')}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                options={hsCodes}
                getOptionLabel={(option) => `${option.codigo} - Arancel ${option.arancel_pct}%`}
                value={hsCodes.find((hs) => hs.id === calculatorForm.hs_code_id) || null}
                onChange={(e, newValue) => setCalculatorForm({ ...calculatorForm, hs_code_id: newValue?.id || null })}
                renderInput={(params) => (
                  <TextField {...params} label={t('hs_code', 'Código HS')} />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                options={acuerdos}
                getOptionLabel={(option) => `${option.nombre} - ${option.preferencia_arancelaria_pct}%`}
                value={acuerdos.find((ac) => ac.id === calculatorForm.acuerdo_id) || null}
                onChange={(e, newValue) => setCalculatorForm({ ...calculatorForm, acuerdo_id: newValue?.id || null })}
                renderInput={(params) => (
                  <TextField {...params} label={t('hs_trade_agreement', 'Acuerdo Comercial')} />
                )}
              />
            </Grid>

            {calculatorResult && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'success.light', mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    {t('hs_calculation_result', 'Resultado del Cálculo')}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Valor CIF:</Typography>
                    <Typography variant="body2" fontWeight="bold">${calculatorResult.valor_cif}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Arancel Base:</Typography>
                    <Typography variant="body2">{calculatorResult.arancel_pct}%</Typography>
                  </Box>
                  {calculatorResult.preferencia_pct > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">Preferencia Arancelaria:</Typography>
                      <Typography variant="body2" color="success.dark">-{calculatorResult.preferencia_pct}%</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Arancel Efectivo:</Typography>
                    <Typography variant="body2" fontWeight="bold">{calculatorResult.arancel_efectivo_pct}%</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Total Tributos:</Typography>
                    <Typography variant="h6" color="primary">${calculatorResult.total_tributos}</Typography>
                  </Box>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDutiesCalculatorOpen(false)}>{t('common_close', 'Cerrar')}</Button>
          <Button onClick={handleCalculateDuties} variant="contained">
            {t('common_calculate', 'Calcular')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HSCodeManagement;
