import AdminCrudTemplate from '../../components/AdminCrudTemplate'
import { admin } from '../../services/spm'
import { formatCurrency } from '../../utils/formatters'

export default function AdminPresupuestos() {
  return (
    <AdminCrudTemplate
      title="Presupuestos"
      resource="presupuestos"
      idKey="_id"
      parseList={(rows) => (rows || []).map((r) => ({ ...r, _id: `${r.centro}|${r.sector}` }))}
      columns={[
        { key: 'centro', label: 'Centro' },
        { key: 'sector', label: 'Sector' },
        { key: 'monto_usd', label: 'Monto USD', render: (row) => <span className="font-mono">{formatCurrency(row.monto_usd)}</span> },
        { key: 'saldo_usd', label: 'Saldo USD', render: (row) => <span className="font-mono">{formatCurrency(row.saldo_usd)}</span> }
      ]}
      fields={[
        { name: 'centro', label: 'Centro', required: true },
        { name: 'sector', label: 'Sector', required: true },
        { name: 'monto_usd', label: 'Monto USD', type: 'number', required: true },
        { name: 'saldo_usd', label: 'Saldo USD', type: 'number', required: true }
      ]}
      transformSubmit={(form) => ({
        centro: form.centro,
        sector: form.sector,
        monto_usd: Number(form.monto_usd || 0),
        saldo_usd: Number(form.saldo_usd || form.monto_usd || 0)
      })}
      customUpdate={(id, payload) => {
        const [centro, sector] = id.split('|')
        return admin.updatePresupuesto(centro, sector, payload)
      }}
    />
  )
}
