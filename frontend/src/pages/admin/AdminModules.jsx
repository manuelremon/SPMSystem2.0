import React, { useEffect, useState } from 'react'
import {
  Paper, Typography, Box, Switch, Chip, Button, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress
} from '@mui/material'
import { useModuleStore } from '../../store/moduleStore'
import { useI18n } from '../../context/i18n'

export default function AdminModules() {
  const { t } = useI18n()
  const { modules, isLoaded, fetchModules, updateModules } = useModuleStore()
  const [localModules, setLocalModules] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isLoaded) fetchModules()
  }, [isLoaded, fetchModules])

  useEffect(() => {
    setLocalModules(modules.map(m => ({ ...m })))
  }, [modules])

  const handleToggle = (key) => {
    setLocalModules(prev =>
      prev.map(m => m.module_key === key ? { ...m, enabled: !m.enabled } : m)
    )
    setMessage(null)
    setError(null)
  }

  const hasChanges = localModules.some((m, i) => modules[i] && m.enabled !== modules[i].enabled)

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const changed = localModules
        .filter((m, i) => modules[i] && m.enabled !== modules[i].enabled)
        .map(m => ({ module_key: m.module_key, enabled: m.enabled }))
      await updateModules(changed)
      setMessage(t('admin_modules_saved', 'Modulos actualizados correctamente'))
    } catch (err) {
      setError(err.response?.data?.error || t('common_error', 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary" gutterBottom>
        {t('admin_modules_title', 'Modulos del Sistema')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('admin_modules_desc', 'Habilite o deshabilite los modulos disponibles en el sistema')}
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t('common_module', 'Modulo')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t('common_description', 'Descripcion')}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>{t('common_status', 'Estado')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {localModules.map((mod) => (
              <TableRow key={mod.module_key} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {t(mod.label_key, mod.label_fallback)}
                    </Typography>
                    {mod.is_core && (
                      <Chip label={t('admin_modules_required', 'Requerido')} size="small" color="primary" variant="outlined" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {mod.description}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={mod.enabled}
                    onChange={() => handleToggle(mod.module_key)}
                    disabled={mod.is_core}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? <CircularProgress size={20} /> : t('common_save', 'Guardar')}
        </Button>
      </Box>
      </Box>
    </Box>
  )
}
