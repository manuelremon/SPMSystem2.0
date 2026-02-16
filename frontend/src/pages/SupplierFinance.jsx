import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Alert,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function SupplierFinance() {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [programas, setProgramas] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [terminos, setTerminos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Program dialog
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [newProgram, setNewProgram] = useState({
    nombre: '',
    tipo: 'early_payment',
    descuento_base_pct: 2.0,
    dias_anticipacion: 15,
    formula: '',
    presupuesto_anual: null,
  });

  // Generate offers dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [diasHorizonte, setDiasHorizonte] = useState(30);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load KPIs
      const kpisRes = await api.get('/api/supplier-finance/kpis');
      if (kpisRes.data.ok) {
        setKpis(kpisRes.data.kpis);
      }

      if (activeTab === 0) {
        // Load programs
        const programsRes = await api.get('/api/supplier-finance/programs');
        if (programsRes.data.ok) {
          setProgramas(programsRes.data.programas);
        }
      } else if (activeTab === 1) {
        // Load offers
        const offersRes = await api.get('/api/supplier-finance/offers');
        if (offersRes.data.ok) {
          setOfertas(offersRes.data.ofertas);
        }
      } else if (activeTab === 2) {
        // Load payment terms
        const termsRes = await api.get('/api/supplier-finance/payment-terms');
        if (termsRes.data.ok) {
          setTerminos(termsRes.data.terminos);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      addToast(error.response?.data?.error || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProgram = async () => {
    try {
      const res = await api.post('/api/supplier-finance/programs', newProgram);
      if (res.data.ok) {
        addToast('Programa creado exitosamente', 'success');
        setProgramDialogOpen(false);
        setNewProgram({
          nombre: '',
          tipo: 'early_payment',
          descuento_base_pct: 2.0,
          dias_anticipacion: 15,
          formula: '',
          presupuesto_anual: null,
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating program:', error);
      addToast(error.response?.data?.error || 'Error al crear programa', 'error');
    }
  };

  const handleGenerateOffers = async () => {
    try {
      const res = await api.post(
        `/api/supplier-finance/programs/${selectedProgramId}/generate-offers`,
        { dias_horizonte: diasHorizonte }
      );
      if (res.data.ok) {
        addToast(`${res.data.ofertas_generadas} ofertas generadas`, 'success');
        setGenerateDialogOpen(false);
        setActiveTab(1); // Switch to offers tab
        loadData();
      }
    } catch (error) {
      console.error('Error generating offers:', error);
      addToast(error.response?.data?.error || 'Error al generar ofertas', 'error');
    }
  };

  const handleAcceptOffer = async (ofertaId) => {
    try {
      const res = await api.put(`/api/supplier-finance/offers/${ofertaId}/accept`);
      if (res.data.ok) {
        addToast('Oferta aceptada', 'success');
        loadData();
      }
    } catch (error) {
      console.error('Error accepting offer:', error);
      addToast(error.response?.data?.error || 'Error al aceptar oferta', 'error');
    }
  };

  const handleRejectOffer = async (ofertaId) => {
    try {
      const res = await api.put(`/api/supplier-finance/offers/${ofertaId}/reject`);
      if (res.data.ok) {
        addToast('Oferta rechazada', 'success');
        loadData();
      }
    } catch (error) {
      console.error('Error rejecting offer:', error);
      addToast(error.response?.data?.error || 'Error al rechazar oferta', 'error');
    }
  };

  const handleMarkPaid = async (ofertaId) => {
    try {
      const res = await api.put(`/api/supplier-finance/offers/${ofertaId}/pay`);
      if (res.data.ok) {
        addToast('Oferta marcada como pagada', 'success');
        loadData();
      }
    } catch (error) {
      console.error('Error marking paid:', error);
      addToast(error.response?.data?.error || 'Error al marcar como pagada', 'error');
    }
  };

  const handleUpdateTerms = async (params) => {
    const { proveedor_cuit, field, newValue } = params;
    try {
      const body = { [field]: newValue };
      const res = await api.put(`/api/supplier-finance/payment-terms/${proveedor_cuit}`, body);
      if (res.data.ok) {
        addToast('Términos actualizados', 'success');
        loadData();
      }
    } catch (error) {
      console.error('Error updating terms:', error);
      addToast(error.response?.data?.error || 'Error al actualizar términos', 'error');
    }
  };

  // AG-Grid columns for programs
  const programsColumns = useMemo(
    () => [
      { field: 'nombre', headerName: t('finance_program_name'), flex: 2 },
      {
        field: 'tipo',
        headerName: t('finance_program_type'),
        flex: 1,
        cellRenderer: (params) => {
          const typeMap = {
            early_payment: t('finance_early_payment'),
            volume_rebate: t('finance_volume_rebate'),
            prompt_payment: t('finance_prompt_payment'),
          };
          return typeMap[params.value] || params.value;
        },
      },
      {
        field: 'descuento_base_pct',
        headerName: t('finance_discount_base'),
        flex: 1,
        valueFormatter: (params) => `${params.value}%`,
      },
      {
        field: 'dias_anticipacion',
        headerName: t('finance_anticipation_days'),
        flex: 1,
      },
      {
        field: 'estado',
        headerName: 'Estado',
        flex: 1,
        cellRenderer: (params) => {
          const stateMap = {
            active: { label: t('finance_state_active'), color: 'success' },
            paused: { label: t('finance_state_paused'), color: 'warning' },
            terminated: { label: t('finance_state_terminated'), color: 'error' },
          };
          const state = stateMap[params.value] || { label: params.value, color: 'default' };
          return <Chip label={state.label} color={state.color} size="small" />;
        },
      },
      {
        field: 'presupuesto_disponible',
        headerName: t('finance_budget_available'),
        flex: 1,
        valueFormatter: (params) => (params.value !== null ? formatCurrency(params.value) : 'N/A'),
      },
      {
        field: 'actions',
        headerName: 'Acciones',
        flex: 1,
        cellRenderer: (params) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSelectedProgramId(params.data.id);
              setGenerateDialogOpen(true);
            }}
          >
            {t('finance_generate_offers')}
          </Button>
        ),
      },
    ],
    [t]
  );

  // AG-Grid columns for offers
  const offersColumns = useMemo(
    () => [
      { field: 'programa_nombre', headerName: 'Programa', flex: 1.5 },
      { field: 'proveedor_cuit', headerName: t('finance_supplier_cuit'), flex: 1 },
      {
        field: 'monto_factura',
        headerName: t('finance_invoice_amount'),
        flex: 1,
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        field: 'descuento_ofrecido_pct',
        headerName: t('finance_discount_offered'),
        flex: 1,
        valueFormatter: (params) => `${params.value}%`,
      },
      {
        field: 'monto_descuento',
        headerName: 'Ahorro',
        flex: 1,
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        field: 'fecha_pago_original',
        headerName: t('finance_original_date'),
        flex: 1,
        valueFormatter: (params) => formatDate(params.value),
      },
      {
        field: 'fecha_pago_anticipado',
        headerName: t('finance_early_date'),
        flex: 1,
        valueFormatter: (params) => formatDate(params.value),
      },
      {
        field: 'estado',
        headerName: 'Estado',
        flex: 1,
        cellRenderer: (params) => {
          const stateMap = {
            pendiente: { label: t('finance_status_pending'), color: 'warning' },
            aceptada: { label: t('finance_status_accepted'), color: 'info' },
            rechazada: { label: t('finance_status_rejected'), color: 'error' },
            pagada: { label: t('finance_status_paid'), color: 'success' },
          };
          const state = stateMap[params.value] || { label: params.value, color: 'default' };
          return <Chip label={state.label} color={state.color} size="small" />;
        },
      },
      {
        field: 'actions',
        headerName: 'Acciones',
        flex: 1.5,
        cellRenderer: (params) => {
          const { estado, id } = params.data;
          return (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {estado === 'pendiente' && (
                <>
                  <Button size="small" color="success" onClick={() => handleAcceptOffer(id)}>
                    {t('finance_accept')}
                  </Button>
                  <Button size="small" color="error" onClick={() => handleRejectOffer(id)}>
                    {t('finance_reject')}
                  </Button>
                </>
              )}
              {estado === 'aceptada' && (
                <Button size="small" variant="outlined" onClick={() => handleMarkPaid(id)}>
                  {t('finance_mark_paid')}
                </Button>
              )}
            </Box>
          );
        },
      },
    ],
    [t]
  );

  // AG-Grid columns for payment terms
  const termsColumns = useMemo(
    () => [
      { field: 'proveedor_cuit', headerName: t('finance_supplier_cuit'), flex: 1.5 },
      {
        field: 'termino_estandar_dias',
        headerName: t('finance_standard_term'),
        flex: 1,
        editable: true,
      },
      {
        field: 'termino_negociado_dias',
        headerName: t('finance_negotiated_term'),
        flex: 1,
        editable: true,
      },
      {
        field: 'descuento_pronto_pago_pct',
        headerName: t('finance_prompt_discount'),
        flex: 1,
        editable: true,
        valueFormatter: (params) => (params.value !== null ? `${params.value}%` : ''),
      },
      {
        field: 'historico_cumplimiento_pct',
        headerName: t('finance_compliance_history'),
        flex: 1,
        valueFormatter: (params) => (params.value !== null ? `${params.value}%` : ''),
      },
      {
        field: 'ultima_revision',
        headerName: t('finance_last_review'),
        flex: 1,
        valueFormatter: (params) => (params.value ? formatDate(params.value) : ''),
      },
    ],
    [t]
  );

  const onCellValueChanged = useCallback(
    (params) => {
      if (activeTab === 2) {
        // Payment terms editable
        handleUpdateTerms({
          proveedor_cuit: params.data.proveedor_cuit,
          field: params.colDef.field,
          newValue: params.newValue,
        });
      }
    },
    [activeTab]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('finance_title')}
      </Typography>

      {/* KPIs */}
      {kpis && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  {t('finance_total_savings')}
                </Typography>
                <Typography variant="h5">{formatCurrency(kpis.total_savings)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  {t('finance_pending_offers')}
                </Typography>
                <Typography variant="h5">
                  {kpis.pending_offers_count}
                  <Typography component="span" variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                    ({formatCurrency(kpis.pending_savings_potential)})
                  </Typography>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  {t('finance_avg_dpo')}
                </Typography>
                <Typography variant="h5">{kpis.avg_dpo} días</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  {t('finance_budget_remaining')}
                </Typography>
                <Typography variant="h5">{formatCurrency(kpis.remaining_budget)}</Typography>
                <Typography variant="caption" color="textSecondary">
                  ({kpis.budget_utilization_pct}% utilizado)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
          <Tab label={t('finance_programs')} />
          <Tab label={t('finance_offers')} />
          <Tab label={t('finance_terms')} />
        </Tabs>
      </Box>

      {/* Programs Tab */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" onClick={() => setProgramDialogOpen(true)}>
              {t('finance_new_program')}
            </Button>
          </Box>
          <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={programas}
              columnDefs={programsColumns}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              loading={loading}
            />
          </div>
        </Box>
      )}

      {/* Offers Tab */}
      {activeTab === 1 && (
        <Box>
          <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={ofertas}
              columnDefs={offersColumns}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              loading={loading}
            />
          </div>
        </Box>
      )}

      {/* Payment Terms Tab */}
      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Términos editables: haga doble clic en una celda para editar
          </Alert>
          <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={terminos}
              columnDefs={termsColumns}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
              }}
              onCellValueChanged={onCellValueChanged}
              loading={loading}
            />
          </div>
        </Box>
      )}

      {/* Create Program Dialog */}
      <Dialog open={programDialogOpen} onClose={() => setProgramDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('finance_new_program')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('finance_program_name')}
              value={newProgram.nombre}
              onChange={(e) => setNewProgram({ ...newProgram, nombre: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label={t('finance_program_type')}
              value={newProgram.tipo}
              onChange={(e) => setNewProgram({ ...newProgram, tipo: e.target.value })}
              fullWidth
            >
              <MenuItem value="early_payment">{t('finance_early_payment')}</MenuItem>
              <MenuItem value="volume_rebate">{t('finance_volume_rebate')}</MenuItem>
              <MenuItem value="prompt_payment">{t('finance_prompt_payment')}</MenuItem>
            </TextField>
            <TextField
              label={t('finance_discount_base')}
              type="number"
              value={newProgram.descuento_base_pct}
              onChange={(e) =>
                setNewProgram({ ...newProgram, descuento_base_pct: parseFloat(e.target.value) })
              }
              fullWidth
              inputProps={{ step: 0.1, min: 0 }}
            />
            <TextField
              label={t('finance_anticipation_days')}
              type="number"
              value={newProgram.dias_anticipacion}
              onChange={(e) =>
                setNewProgram({ ...newProgram, dias_anticipacion: parseInt(e.target.value, 10) })
              }
              fullWidth
              inputProps={{ step: 1, min: 1 }}
            />
            <TextField
              label={t('finance_formula')}
              value={newProgram.formula}
              onChange={(e) => setNewProgram({ ...newProgram, formula: e.target.value })}
              fullWidth
              placeholder="base_pct * (dias_ant / 30)"
              helperText="Opcional: usar base_pct, dias_ant, monto"
            />
            <TextField
              label={t('finance_annual_budget')}
              type="number"
              value={newProgram.presupuesto_anual || ''}
              onChange={(e) =>
                setNewProgram({
                  ...newProgram,
                  presupuesto_anual: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              fullWidth
              inputProps={{ step: 1000, min: 0 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgramDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateProgram} variant="contained" disabled={!newProgram.nombre}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Offers Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('finance_generate_offers')}</DialogTitle>
        <DialogContent>
          <TextField
            label="Días de horizonte"
            type="number"
            value={diasHorizonte}
            onChange={(e) => setDiasHorizonte(parseInt(e.target.value, 10))}
            fullWidth
            sx={{ mt: 2 }}
            inputProps={{ step: 1, min: 1, max: 90 }}
            helperText="Facturas con vencimiento dentro de este período"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleGenerateOffers} variant="contained">
            Generar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
