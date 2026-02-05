/**
 * MaterialsTable - Table component for displaying added materials
 * ✨ Migrated to SPMAgGrid for better performance
 * Handles quantity editing, comments, and deletion
 */
import { useState, useMemo } from 'react'
import { useI18n } from '../../context/i18n'
import { formatCurrency } from '../../utils/formatters'
import { SPMAgGrid } from '../ui/SPMAgGrid'
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import DeleteIcon from '@mui/icons-material/Delete'
import { ConfirmModal } from '../ui/ConfirmModal'

export function MaterialsTable({
  items,
  onQtyChange,
  onDelete,
  onOpenComment,
}) {
  const { t } = useI18n()
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, codigo: null, descripcion: '' })

  const rows = useMemo(() => {
    return items.map((it, idx) => ({
      ...it,
      id: it.codigo,
      subtotal: (it.cantidad || 0) * (it.precio_unitario || 0),
    }))
  }, [items])

  const columnDefs = useMemo(
    () => [
      {
        field: 'codigo',
        headerName: t('materials_col_codigo', 'Código'),
        flex: 0.2,
        minWidth: 80,
        valueFormatter: (params) => params.value || '-',
      },
      {
        field: 'descripcion',
        headerName: t('materials_col_descripcion', 'Descripción'),
        flex: 0.5,
        minWidth: 150,
        valueFormatter: (params) => params.value || '-',
      },
      {
        field: 'unidad',
        headerName: t('materials_col_unidad', 'Unidad'),
        flex: 0.15,
        minWidth: 70,
        valueFormatter: (params) => params.value || '-',
      },
      {
        field: 'cantidad',
        headerName: t('materials_col_cantidad', 'Cant.'),
        flex: 0.15,
        minWidth: 80,
        cellRenderer: (params) => (
          <TextField
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={params.data?.cantidad || 0}
            onChange={(e) => onQtyChange(params.data?.codigo, e.target.value)}
            size="small"
            sx={{
              width: 64,
              '& .MuiInputBase-input': {
                textAlign: 'center',
                py: 0.5,
                px: 1,
                fontSize: '0.875rem',
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'primary.main',
                  borderWidth: 2,
                },
              },
            }}
            aria-label={t('materials_cantidad_label', 'Cantidad del material')}
          />
        ),
      },
      {
        field: 'precio_unitario',
        headerName: t('materials_col_precio', 'Precio USD'),
        flex: 0.18,
        minWidth: 100,
        type: 'numericColumn',
        cellStyle: { textAlign: 'right', paddingRight: '16px' },
        valueFormatter: (params) => formatCurrency(params.value || 0),
      },
      {
        field: 'subtotal',
        headerName: t('materials_col_subtotal', 'Subtotal'),
        flex: 0.18,
        minWidth: 100,
        type: 'numericColumn',
        cellStyle: { textAlign: 'right', paddingRight: '16px' },
        cellRenderer: (params) => formatCurrency(params.data?.subtotal || 0),
      },
      {
        field: 'comentario',
        headerName: t('materials_col_nota', 'Nota'),
        flex: 0.12,
        minWidth: 60,
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Tooltip title={params.data?.comentario || t('materials_agregar_nota', 'Agregar nota')}>
            <IconButton
              size="small"
              onClick={() => onOpenComment(params.data?.codigo)}
              color={params.data?.comentario ? 'primary' : 'default'}
              aria-label={`${t('materials_nota_label', 'Nota para')} ${params.data?.codigo}`}
              sx={{
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ChatIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        field: 'acciones',
        headerName: '',
        flex: 0.1,
        minWidth: 50,
        sortable: false,
        filter: false,
        cellRenderer: (params) => (
          <Tooltip title={t('materials_eliminar', 'Eliminar')}>
            <IconButton
              size="small"
              onClick={() => setDeleteConfirm({ show: true, codigo: params.data?.codigo, descripcion: params.data?.descripcion })}
              color="error"
              aria-label={`${t('materials_eliminar', 'Eliminar')} ${params.data?.codigo}`}
              sx={{
                '&:hover': {
                  bgcolor: 'error.lighter',
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [t, onQtyChange, onOpenComment]
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SPMAgGrid
        rowData={rows}
        columnDefs={columnDefs}
        height={300}
        pagination={false}
        enableQuickFilter={false}
        emptyMessage={t('materials_sin_materiales', 'Sin materiales agregados')}
      />

      {/* Modal de confirmacion de eliminacion */}
      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, codigo: null, descripcion: '' })}
        onConfirm={() => {
          onDelete(deleteConfirm.codigo)
          setDeleteConfirm({ show: false, codigo: null, descripcion: '' })
        }}
        title={t('materials_confirmar_eliminar', '¿Eliminar material?')}
        message={`${t('materials_confirmar_eliminar_msg', '¿Esta seguro que desea eliminar el material')} ${deleteConfirm.codigo} - ${deleteConfirm.descripcion}?`}
        confirmText={t('materials_eliminar', 'Eliminar')}
        cancelText={t('common_cancelar', 'Cancelar')}
        variant="danger"
      />
    </Box>
  )
}
