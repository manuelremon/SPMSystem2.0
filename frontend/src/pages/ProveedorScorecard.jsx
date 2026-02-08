import React, { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../context/i18n'
import api from '../services/api'

export default function ProveedorScorecard() {
  const { t } = useI18n()
  const [proveedores, setProveedores] = useState([])
  const [selectedProveedor, setSelectedProveedor] = useState(null)
  const [scorecard, setScorecard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const res = await api.get('/procurement/proveedores')
        setProveedores(res.data?.data || res.data?.proveedores || [])
      } catch { setProveedores([]) }
      finally { setListLoading(false) }
    }
    fetchProveedores()
  }, [])

  const loadScorecard = useCallback(async (proveedor) => {
    setSelectedProveedor(proveedor)
    setLoading(true)
    setError('')
    try {
      const id = proveedor.cuit || proveedor.id || proveedor.codigo
      const res = await api.get(`/procurement/scorecard/${id}`)
      setScorecard(res.data?.data || res.data)
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Error al cargar scorecard')
      setScorecard(null)
    } finally { setLoading(false) }
  }, [])

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981'
    if (score >= 70) return '#f59e0b'
    if (score >= 50) return '#f97316'
    return '#ef4444'
  }

  const GaugeBar = ({ label, value, max = 100, unit = '%' }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: getScoreColor(value) }}>{value?.toFixed(1)}{unit}</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min((value / max) * 100, 100)}%`, background: getScoreColor(value), transition: 'width 0.5s' }} />
      </div>
    </div>
  )

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        {t('scorecard_title', 'Scorecard de Proveedores')}
      </h1>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 24, fontSize: 14 }}>
        Evaluacion de rendimiento de proveedores: OTIF, lead times, costos y tendencias.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* Provider list */}
        <div style={{ border: '1px solid var(--border)', maxHeight: 600, overflowY: 'auto' }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg-soft)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
            Proveedores ({proveedores.length})
          </div>
          {listLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)' }}>Cargando...</div>
          ) : proveedores.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)' }}>Sin proveedores</div>
          ) : (
            proveedores.map((p, i) => (
              <div key={p.id || p.cuit || i} onClick={() => loadScorecard(p)}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13, background: selectedProveedor?.id === p.id ? 'var(--primary)' : 'transparent', color: selectedProveedor?.id === p.id ? 'white' : 'inherit' }}
                onMouseEnter={e => { if (selectedProveedor?.id !== p.id) e.currentTarget.style.background = 'var(--bg-soft)' }}
                onMouseLeave={e => { if (selectedProveedor?.id !== p.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontWeight: 600 }}>{p.nombre || p.razon_social || `Proveedor ${p.id}`}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{p.cuit || p.codigo || ''}</div>
              </div>
            ))
          )}
        </div>

        {/* Scorecard detail */}
        <div>
          {!selectedProveedor ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
              Seleccione un proveedor para ver su scorecard
            </div>
          ) : loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
              Cargando scorecard...
            </div>
          ) : error ? (
            <div style={{ padding: 24, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', fontSize: 14 }}>{error}</div>
          ) : scorecard ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedProveedor.nombre || selectedProveedor.razon_social}</h2>
                <p style={{ fontSize: 12, color: 'var(--fg-muted)' }}>CUIT: {selectedProveedor.cuit || '-'}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ padding: 16, border: '1px solid var(--border)' }}>
                  <GaugeBar label="OTIF" value={scorecard.otif || 0} />
                  <GaugeBar label="On-Time" value={scorecard.on_time || 0} />
                  <GaugeBar label="In-Full" value={scorecard.in_full || 0} />
                </div>
                <div style={{ padding: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>Lead Times</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{scorecard.lead_time_promedio?.toFixed(1) || '-'} dias</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>Promedio</div>
                  <div style={{ fontSize: 14, marginTop: 8 }}>Min: {scorecard.lead_time_min || '-'} / Max: {scorecard.lead_time_max || '-'} dias</div>
                </div>
                <div style={{ padding: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8 }}>Ordenes</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{scorecard.total_ordenes || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>Total ordenes de compra</div>
                  <div style={{ fontSize: 14, marginTop: 8 }}>Valor total: <strong>USD {(scorecard.valor_total || 0).toLocaleString('es-AR')}</strong></div>
                </div>
              </div>

              {scorecard.materiales_top && (
                <div style={{ border: '1px solid var(--border)' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-soft)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                    Top Materiales
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-soft)' }}>
                        <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Material</th>
                        <th style={{ padding: '6px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Ordenes</th>
                        <th style={{ padding: '6px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Valor USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorecard.materiales_top?.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 12px' }}>{m.codigo || m.material} - {m.descripcion || ''}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>{m.ordenes || 0}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>${(m.valor || 0).toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
