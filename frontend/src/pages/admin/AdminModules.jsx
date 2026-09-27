import React, { useEffect, useState } from 'react'
import {
  Paper, Typography, Box, Switch, Chip, Button, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress
} from '@mui/material'
import { useModuleStore } from '../../store/moduleStore'
import { useI18n } from '../../context/i18n'
import PageLayout from '../../components/ui/PageLayout'

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
      setMessage(t('admin_modules_saved', 'Módulos actualizados correctamente'))
    } catch (err) {
      setError(err.response?.data?.error || t('common_error', 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded) {
    return (
      <PageLayout title={t('admin_modules_title', 'Módulos del sistema')} backTo="/admin">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={t('admin_modules_title', 'Módulos del sistema')}
      subtitle={t('admin_modules_desc', 'Habilita o deshabilita los módulos disponibles en el sistema')}
      backTo="/admin"
      actions={
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          sx={{ textTransform: 'none' }}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : t('common_save', 'Guardar')}
        </Button>
      }
    >
      {message && <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t('common_module', 'Módulo')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t('common_description', 'Descripción')}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>{t('common_status', 'Estado')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {localModules.map((mod) => {
              // Submodulo ("padre.hijo"): sin efecto si el padre esta apagado
              const parentKey = mod.module_key.includes('.') ? mod.module_key.split('.')[0] : null
              const parentOff = parentKey && localModules.some(m => m.module_key === parentKey && !m.enabled)
              return (
              <TableRow key={mod.module_key} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: mod.module_key.includes('.') ? 3 : 0 }}>
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
                    checked={mod.enabled && !parentOff}
                    onChange={() => handleToggle(mod.module_key)}
                    disabled={mod.is_core || parentOff}
                    size="small"
                  />
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </PageLayout>
  )
}
