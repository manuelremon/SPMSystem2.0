import React, { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Autocomplete from '@mui/material/Autocomplete'
import Grid from '@mui/material/Grid'
import SearchIcon from '@mui/icons-material/Search'
import { useI18n } from '../context/i18n'
import { getAnomalias } from '../services/ai'
import api from '../services/api'

export default function AnomaliaDetection() {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [centro, setCentro] = useState('')
  const [dias, setDias] = useState(90)
  const [loading, setLoading] = useState(false)
  const [anomalias, setAnomalias] = useState(null)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  const searchMateriales = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await api.get('/ai/materiales/buscar-consumo', { params: { q, limit: 10 } })
      setSearchResults(res.data?.data || [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearch = useCallback((e) => {
    const v = e.target.value
    setSearchQuery(v)
    searchMateriales(v)
  }, [searchMateriales])

  const selectMaterial = useCallback((mat) => {
    setSelectedMaterial(mat)
    setSearchQuery(mat.codigo + ' - ' + (mat.descripcion || ''))
    setSearchResults([])
  }, [])

  const detectar = useCallback(async () => {
    if (!selectedMaterial) return
    setLoading(true)
    setError('')
    setAnomalias(null)
    try {
      const result = await getAnomalias(selectedMaterial.codigo, { centro, dias })
      setAnomalias(result)
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Error al detectar anomalias')
    } finally { setLoading(false) }
  }, [selectedMaterial, centro, dias])

  const getSeverityColor = (score) => {
    if (score >= 0.8) return 'error'
    if (score >= 0.6) return 'warning'
    return 'info'
  }


  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t('anomalias_title', 'Deteccion de Anomalias')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('anomalias_desc', 'Identifica patrones inusuales de consumo usando Isolation Forest (ML).')}
        </Typography>

        {/* Search & Filters */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Box sx={{ flex: 1, minWidth: 280, position: 'relative' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                Material
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Buscar por codigo o descripcion..."
              />
              {searchResults.length > 0 && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    maxHeight: 200,
                    overflowY: 'auto',
                    mt: 0.5,
                  }}
                >
                  {searchResults.map(mat => (
                    <Box
                      key={mat.codigo}
                      onClick={() => selectMaterial(mat)}
                      sx={{
                        px: 2,
                        py: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderBottom: 1,
                        borderColor: 'divider',
                        transition: 'background-color 0.15s',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>{mat.codigo}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ ml: 1 }}>{mat.descripcion}</Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>
            <Box sx={{ width: 160 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, display: 'block' }}>
                Centro
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={centro}
                onChange={e => setCentro(e.target.value)}
                placeholder="Ej: AA101"
              />
            </Box>
            <FormControl size="small" sx={{ width: 120 }}>
              <InputLabel>{t('anomalias_dias', 'Dias')}</InputLabel>
              <Select
                value={dias}
                label={t('anomalias_dias', 'Dias')}
                onChange={e => setDias(Number(e.target.value))}
              >
                <MenuItem value={30}>30 dias</MenuItem>
                <MenuItem value={60}>60 dias</MenuItem>
                <MenuItem value={90}>90 dias</MenuItem>
                <MenuItem value={180}>180 dias</MenuItem>
                <MenuItem value={365}>1 ano</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={detectar}
              disabled={!selectedMaterial || loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              sx={{ height: 40, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {loading ? 'Analizando...' : 'Detectar'}
            </Button>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Results */}
        {anomalias && (
          <>
            {/* Summary cards */}
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Total Registros
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                    {anomalias.total_registros}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Anomalias Detectadas
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="error.main" sx={{ mt: 0.5 }}>
                    {anomalias.anomalias_detectadas}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Proporcion
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                    {(Number(anomalias.proporcion_anomalias) * 100).toFixed(1)}%
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Significativas
                  </Typography>
                  <Typography variant="h4" fontWeight={700} color="warning.main" sx={{ mt: 0.5 }}>
                    {anomalias.anomalias_significativas}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Anomalies timeline */}
            <Typography variant="h6" fontWeight={700}>
              Anomalias Detectadas
            </Typography>
            {anomalias.explicaciones?.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No se detectaron anomalias significativas en el periodo analizado.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {anomalias.explicaciones?.map((exp, i) => (
                  <Paper
                    key={i}
                    sx={{
                      p: 2,
                      borderLeft: 4,
                      borderColor: `${getSeverityColor(exp.score)}.main`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          {exp.fecha?.split('T')[0] || exp.fecha}
                        </Typography>
                        <Chip
                          label={`Score: ${(Number(exp.score) * 100).toFixed(0)}%`}
                          size="small"
                          color={getSeverityColor(exp.score)}
                          sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {exp.tipos_anomalia?.map((tipo, j) => (
                          <Chip
                            key={j}
                            label={tipo}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 80 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                        Cantidad
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {Number(exp.cantidad || 0).toFixed(1)}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}
