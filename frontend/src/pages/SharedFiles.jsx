import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, Button, IconButton, Stack, Chip, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Breadcrumbs, Link
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  InsertDriveFile as FileIcon,
  CreateNewFolder as NewFolderIcon,
  Home as HomeIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../context/i18n'
import api from '../services/api'

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SharedFiles() {
  const { user } = useAuthStore()
  const { t } = useI18n()

  const [files, setFiles] = useState([])
  const [carpetas, setCarpetas] = useState([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [newFolderDialog, setNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = currentFolder ? { carpeta: currentFolder } : {}
      const res = await api.get('/api/shared-files', { params })
      setFiles(res.data.files || [])
      if (!currentFolder) {
        setCarpetas(res.data.carpetas || [])
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al cargar archivos')
    } finally {
      setLoading(false)
    }
  }, [currentFolder])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i])
    }
    if (currentFolder) {
      formData.append('carpeta', currentFolder)
    }

    try {
      const res = await api.post('/api/shared-files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total))
        }
      })
      setSuccess(`${res.data.count} archivo(s) subido(s) correctamente`)
      fetchFiles()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error al subir archivos')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Eliminar "${fileName}"?`)) return
    try {
      await api.delete(`/api/shared-files/${fileId}`)
      setSuccess('Archivo eliminado')
      fetchFiles()
    } catch (err) {
      setError('Error al eliminar archivo')
    }
  }

  const handleDownload = (fileId) => {
    window.open(`/api/shared-files/download/${fileId}`, '_blank')
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const items = e.dataTransfer.items
    if (items) {
      const fileList = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') fileList.push(items[i].getAsFile())
      }
      if (fileList.length) handleUpload(fileList)
    } else if (e.dataTransfer.files.length) {
      handleUpload(e.dataTransfer.files)
    }
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    setCurrentFolder(newFolderName.trim())
    setNewFolderDialog(false)
    setNewFolderName('')
  }

  const navigateToFolder = (folder) => setCurrentFolder(folder)
  const navigateHome = () => setCurrentFolder('')

  // Files in current view (filter by folder when at root)
  const displayFiles = currentFolder
    ? files
    : files.filter(f => !f.carpeta)

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {t('shared_files_title', 'Archivos Compartidos')}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<NewFolderIcon />}
            onClick={() => setNewFolderDialog(true)}
          >
            {t('shared_new_folder', 'Nueva Carpeta')}
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('shared_upload_files', 'Subir Archivos')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => folderInputRef.current?.click()}
          >
            {t('shared_upload_folder', 'Subir Carpeta')}
          </Button>
        </Stack>
      </Stack>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }}
      />
      <input
        type="file"
        ref={folderInputRef}
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }}
      />

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          onClick={navigateHome}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        >
          <HomeIcon fontSize="small" />
          {t('shared_root', 'Inicio')}
        </Link>
        {currentFolder && (
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FolderIcon fontSize="small" />
            {currentFolder}
          </Typography>
        )}
      </Breadcrumbs>

      {/* Alerts */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Upload progress */}
      {uploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary">{t('shared_uploading', 'Subiendo...')} {uploadProgress}%</Typography>
        </Box>
      )}

      {/* Drop zone */}
      <Paper
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          borderRadius: 2,
          p: 4,
          mb: 3,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          {t('shared_drop_hint', 'Arrastra archivos o carpetas aqui, o haz clic para seleccionar')}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t('shared_no_restrictions', 'Sin restriccion de formato ni tamanio')}
        </Typography>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Folders (only at root) */}
      {!currentFolder && carpetas.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {t('shared_folders', 'Carpetas')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {carpetas.map((c) => (
              <Chip
                key={c}
                icon={<FolderIcon />}
                label={c}
                onClick={() => navigateToFolder(c)}
                variant="outlined"
                clickable
                sx={{ mb: 1 }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Back button when in folder */}
      {currentFolder && (
        <Button startIcon={<BackIcon />} onClick={navigateHome} sx={{ mb: 2 }}>
          {t('shared_back', 'Volver')}
        </Button>
      )}

      {/* File list */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t('shared_col_name', 'Nombre')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t('shared_col_size', 'Tamanio')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t('shared_col_type', 'Tipo')}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t('shared_col_date', 'Fecha')}</TableCell>
              {!currentFolder && <TableCell sx={{ fontWeight: 700 }}>{t('shared_col_folder', 'Carpeta')}</TableCell>}
              <TableCell align="right" sx={{ fontWeight: 700 }}>{t('shared_col_actions', 'Acciones')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayFiles.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={currentFolder ? 5 : 6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('shared_empty', 'No hay archivos')}
                </TableCell>
              </TableRow>
            ) : (
              displayFiles.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FileIcon fontSize="small" color="action" />
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {f.nombre_original}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{formatFileSize(f.tamanio)}</TableCell>
                  <TableCell>
                    <Chip label={f.mime_type?.split('/')[1] || 'archivo'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{formatDate(f.created_at)}</TableCell>
                  {!currentFolder && (
                    <TableCell>
                      {f.carpeta ? (
                        <Chip
                          icon={<FolderIcon />}
                          label={f.carpeta}
                          size="small"
                          onClick={() => navigateToFolder(f.carpeta)}
                          clickable
                        />
                      ) : '—'}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <Tooltip title={t('shared_download', 'Descargar')}>
                      <IconButton size="small" onClick={() => handleDownload(f.id)} color="primary">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('shared_delete', 'Eliminar')}>
                      <IconButton size="small" onClick={() => handleDelete(f.id, f.nombre_original)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New folder dialog */}
      <Dialog open={newFolderDialog} onClose={() => setNewFolderDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('shared_new_folder', 'Nueva Carpeta')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('shared_folder_name', 'Nombre de la carpeta')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleCreateFolder}>{t('common_create', 'Crear')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
