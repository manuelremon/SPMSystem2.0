import { useState, useEffect, useCallback, useMemo } from 'react'
import { admin } from '../../services/spm'
import { formatCurrency } from '../../utils/formatters'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { ModernDataTable as DataTable } from '../../components/features/DataTable'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { SearchInput } from '../../components/ui/SearchInput'
import { useDebounced } from '../../hooks/useDebounced'
import {
  Plus, Edit3, Trash2, X, Save, History,
  TrendingUp, TrendingDown, RefreshCw, Clock,
  ArrowUpCircle, ArrowDownCircle, PlusCircle, MinusCircle
} from 'lucide-react'

const TIPO_CAMBIO_ICONS = {
  creacion: { icon: PlusCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
  aumento: { icon: ArrowUpCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  reduccion: { icon: ArrowDownCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
  ajuste: { icon: RefreshCw, color: 'text-slate-600', bg: 'bg-slate-100' },
  eliminacion: { icon: MinusCircle, color: 'text-red-600', bg: 'bg-red-100' },
}

export default function AdminPresupuestos() {
  const [tab, setTab] = useState('presupuestos')
  const [items, setItems] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q, 300)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ centro: '', sector: '', monto_usd: '', saldo_usd: '' })

  // Delete modal
  const [deleteModal, setDeleteModal] = useState({ open: false, row: null })

  const loadPresupuestos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await admin.list('presupuestos')
      const data = (res.data || []).map(r => ({ ...r, _id: `${r.centro}|${r.sector}` }))
      setItems(data)
    } catch (e) {
      const err = e.response?.data?.error
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHistorial = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await admin.historialPresupuestos({ limit: 100 })
      setHistorial(res.data || [])
    } catch (e) {
      const err = e.response?.data?.error
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'presupuestos') {
      loadPresupuestos()
    } else {
      loadHistorial()
    }
  }, [tab, loadPresupuestos, loadHistorial])

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase()
    if (!term) return tab === 'presupuestos' ? items : historial

    const data = tab === 'presupuestos' ? items : historial
    return data.filter(item =>
      (item.centro || '').toLowerCase().includes(term) ||
      (item.sector || '').toLowerCase().includes(term)
    )
  }, [items, historial, debouncedQ, tab])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.centro || !form.sector) {
      setError('Centro y Sector son requeridos')
      return
    }

    setLoading(true)
    setError('')
    try {
      const payload = {
        centro: form.centro,
        sector: form.sector,
        monto_usd: Number(form.monto_usd || 0),
        saldo_usd: Number(form.saldo_usd || form.monto_usd || 0),
      }

      if (editingId) {
        const [centro, sector] = editingId.split('|')
        await admin.updatePresupuesto(centro, sector, payload)
        setSuccess('Presupuesto actualizado')
      } else {
        await admin.create('presupuestos', payload)
        setSuccess('Presupuesto creado')
      }

      setShowForm(false)
      setForm({ centro: '', sector: '', monto_usd: '', saldo_usd: '' })
      setEditingId(null)
      loadPresupuestos()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      const err = e.response?.data?.error
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message))
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row) => {
    setEditingId(row._id)
    setForm({
      centro: row.centro,
      sector: row.sector,
      monto_usd: row.monto_usd || '',
      saldo_usd: row.saldo_usd || '',
    })
    setShowForm(true)
  }

  const handleDelete = (row) => {
    setDeleteModal({ open: true, row })
  }

  const confirmDelete = async () => {
    if (!deleteModal.row) return
    setLoading(true)
    try {
      const [centro, sector] = deleteModal.row._id.split('|')
      await admin.deletePresupuesto(centro, sector)
      setSuccess('Presupuesto eliminado')
      loadPresupuestos()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      const err = e.response?.data?.error
      setError(typeof err === 'object' ? (err.message || JSON.stringify(err)) : (err || e.message))
    } finally {
      setLoading(false)
      setDeleteModal({ open: false, row: null })
    }
  }

  const presupuestosColumns = [
    { key: 'centro', header: 'Centro' },
    { key: 'sector', header: 'Sector' },
    {
      key: 'monto_usd',
      header: 'Monto USD',
      render: (row) => <span className="font-mono">{formatCurrency(row.monto_usd)}</span>
    },
    {
      key: 'saldo_usd',
      header: 'Saldo USD',
      render: (row) => <span className="font-mono">{formatCurrency(row.saldo_usd)}</span>
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (row) => (
        <div className="flex gap-1.5 justify-center">
          <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => handleEdit(row)}>
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="danger" className="px-2.5 py-1.5 text-xs" onClick={() => handleDelete(row)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ]

  const historialColumns = [
    {
      key: 'tipo_cambio',
      header: 'Tipo',
      render: (row) => {
        const config = TIPO_CAMBIO_ICONS[row.tipo_cambio] || TIPO_CAMBIO_ICONS.ajuste
        const Icon = config.icon
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            <Icon className="w-3.5 h-3.5" />
            {row.tipo_cambio}
          </span>
        )
      }
    },
    { key: 'centro', header: 'Centro' },
    { key: 'sector', header: 'Sector' },
    {
      key: 'diferencia_usd',
      header: 'Cambio',
      render: (row) => {
        const diff = row.diferencia_usd || 0
        const isPositive = diff > 0
        return (
          <span className={`font-mono flex items-center gap-1 ${isPositive ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
            {isPositive ? '+' : ''}{formatCurrency(diff)}
          </span>
        )
      }
    },
    {
      key: 'monto_nuevo_usd',
      header: 'Monto Final',
      render: (row) => <span className="font-mono">{formatCurrency(row.monto_nuevo_usd)}</span>
    },
    {
      key: 'solicitante_nombre',
      header: 'Usuario',
      render: (row) => row.solicitante_nombre || '-'
    },
    {
      key: 'created_at',
      header: 'Fecha',
      render: (row) => {
        if (!row.created_at) return '-'
        const date = new Date(row.created_at)
        return (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {date.toLocaleDateString('es-AR')} {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )
      }
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="ADMINISTRACIÓN DE PRESUPUESTOS"
        actions={
          tab === 'presupuestos' && (
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ centro: '', sector: '', monto_usd: '', saldo_usd: '' }); }}>
              <Plus className="w-4 h-4" />
              Nuevo Presupuesto
            </Button>
          )
        }
      />

      {error && <Alert variant="danger" onDismiss={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess('')}>{success}</Alert>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100/70 backdrop-blur-sm rounded-xl w-fit">
        <button
          onClick={() => setTab('presupuestos')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'presupuestos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          Presupuestos
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'historial'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <History className="w-4 h-4" />
          Historial de Cambios
        </button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-3">
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por centro o sector..."
              className="flex-1"
            />
          </div>

          {loading ? (
            <TableSkeleton rows={5} columns={tab === 'presupuestos' ? 5 : 7} />
          ) : (
            <DataTable
              columns={tab === 'presupuestos' ? presupuestosColumns : historialColumns}
              rows={filtered}
              emptyMessage={tab === 'presupuestos' ? 'No hay presupuestos' : 'No hay historial de cambios'}
            />
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" /> Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              <Save className="w-4 h-4" /> Guardar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Centro"
              value={form.centro}
              onChange={(e) => setForm({ ...form, centro: e.target.value })}
              required
              disabled={!!editingId}
            />
            <Input
              label="Sector"
              value={form.sector}
              onChange={(e) => setForm({ ...form, sector: e.target.value })}
              required
              disabled={!!editingId}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monto USD"
              type="number"
              value={form.monto_usd}
              onChange={(e) => setForm({ ...form, monto_usd: e.target.value })}
              required
            />
            <Input
              label="Saldo USD"
              type="number"
              value={form.saldo_usd}
              onChange={(e) => setForm({ ...form, saldo_usd: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, row: null })}
        title="Confirmar Eliminación"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModal({ open: false, row: null })}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Trash2 className="w-4 h-4" /> Eliminar
            </Button>
          </>
        }
      >
        <p className="text-slate-600">
          ¿Eliminar presupuesto de <strong>{deleteModal.row?.centro}</strong> - <strong>{deleteModal.row?.sector}</strong>?
        </p>
      </Modal>
    </div>
  )
}
