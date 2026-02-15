/**
 * ContractDocuments - Document management for contracts
 *
 * Lists, uploads, downloads, and deletes documents attached to a contract.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import { SPMAgGrid } from '../ui/SPMAgGrid';

const TIPO_DOC_OPTIONS = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'anexo', label: 'Anexo' },
  { value: 'adenda', label: 'Adenda' },
  { value: 'otro', label: 'Otro' },
];

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ContractDocuments({ contractId }) {
  const { t } = useI18n();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [tipoDoc, setTipoDoc] = useState('contrato');

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/contracts/${contractId}/documents`);
      if (res.data?.ok) {
        setDocs(res.data.documents || []);
      }
    } catch {
      toast.error(t('contracts_docs_error', 'Error al cargar documentos'));
    } finally {
      setLoading(false);
    }
  }, [contractId, t, toast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast.warning(t('contracts_docs_file_required', 'Seleccione un archivo'));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('tipo', tipoDoc);
      await api.post(`/contracts/${contractId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('contracts_docs_uploaded', 'Documento subido'));
      setUploadOpen(false);
      setSelectedFile(null);
      setTipoDoc('contrato');
      fetchDocs();
    } catch (err) {
      toast.error(err.response?.data?.error || t('contracts_docs_error_upload', 'Error al subir documento'));
    } finally {
      setUploading(false);
    }
  }, [contractId, selectedFile, tipoDoc, fetchDocs, t, toast]);

  const handleDownload = useCallback(async (docId, filename) => {
    try {
      const res = await api.get(`/contracts/${contractId}/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'documento';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('contracts_docs_error_download', 'Error al descargar'));
    }
  }, [contractId, t, toast]);

  const handleDelete = useCallback(async (docId) => {
    try {
      await api.delete(`/contracts/${contractId}/documents/${docId}`);
      toast.success(t('contracts_docs_deleted', 'Documento eliminado'));
      fetchDocs();
    } catch {
      toast.error(t('contracts_docs_error_delete', 'Error al eliminar documento'));
    }
  }, [contractId, fetchDocs, t, toast]);

  const columnDefs = useMemo(() => [
    { field: 'nombre_archivo', headerName: t('contracts_docs_nombre', 'Archivo'), flex: 2, minWidth: 200 },
    {
      field: 'tipo', headerName: t('contracts_docs_tipo', 'Tipo'), width: 120,
      cellRenderer: (p) => <Chip size="small" label={TIPO_DOC_OPTIONS.find(o => o.value === p.value)?.label || p.value} variant="outlined" />,
    },
    { field: 'tamanio', headerName: t('contracts_docs_size', 'Tamano'), width: 100, valueFormatter: (p) => formatFileSize(p.value) },
    { field: 'fecha', headerName: t('contracts_docs_fecha', 'Fecha'), width: 110, valueFormatter: (p) => formatDate(p.value) },
    { field: 'usuario', headerName: t('contracts_docs_usuario', 'Subido por'), flex: 1, minWidth: 120 },
    {
      headerName: '', width: 100, sortable: false, filter: false,
      cellRenderer: (p) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
          <IconButton size="small" onClick={() => handleDownload(p.data.id, p.data.nombre_archivo)} aria-label={t('contracts_docs_download', 'Descargar')}>
            <DownloadIcon fontSize="small" color="primary" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(p.data.id)} aria-label={t('common_eliminar', 'Eliminar')}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Stack>
      ),
    },
  ], [t, handleDownload, handleDelete]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('contracts_tab_docs', 'Documentos')} ({docs.length})</Typography>
        <Button size="small" variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setUploadOpen(true)}>
          {t('contracts_docs_upload', 'Subir Documento')}
        </Button>
      </Stack>

      <SPMAgGrid columnDefs={columnDefs} rowData={docs} loading={loading} height={300} emptyMessage={t('contracts_docs_empty', 'Sin documentos')} getRowId={(params) => String(params.data.id)} />

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('contracts_docs_upload', 'Subir Documento')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('contracts_docs_tipo', 'Tipo')}</InputLabel>
              <Select value={tipoDoc} label={t('contracts_docs_tipo', 'Tipo')} onChange={(e) => setTipoDoc(e.target.value)}>
                {TIPO_DOC_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" component="label" fullWidth startIcon={<UploadFileIcon />}>
              {selectedFile ? selectedFile.name : t('contracts_docs_select', 'Seleccionar archivo')}
              <input ref={fileInputRef} type="file" hidden accept=".pdf,.docx,.xlsx,.doc,.xls" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setUploadOpen(false); setSelectedFile(null); }}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleUpload} disabled={uploading || !selectedFile} startIcon={uploading && <CircularProgress size={16} />}>
            {t('contracts_docs_upload_btn', 'Subir')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
