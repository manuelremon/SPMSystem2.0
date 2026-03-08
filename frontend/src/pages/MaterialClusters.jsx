import React, { useState, useCallback } from 'react'
import { useI18n } from '../context/i18n'
import { getClustering } from '../services/ai'

export default function MaterialClusters() {
  const { t } = useI18n()
  const [centro, setCentro] = useState('')
  const [nClusters, setNClusters] = useState(5)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [expandedCluster, setExpandedCluster] = useState(null)

  const ejecutar = useCallback(async () => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const result = await getClustering({ centro, nClusters })
      setData(result)
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Error al ejecutar clustering')
    } finally { setLoading(false) }
  }, [centro, nClusters])

  const clusterColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        {t('clusters_title', 'Clustering de Materiales')}
      </h1>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 24, fontSize: 14 }}>
        Agrupa materiales por similitud (consumo, stock, precio) usando K-Means para identificar patrones de compra.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Centro</label>
          <input type="text" value={centro} onChange={e => setCentro(e.target.value)} placeholder="Ej: AA101 (todos)"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontSize: 14, background: 'var(--bg-base)' }} />
        </div>
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clusters</label>
          <select value={nClusters} onChange={e => setNClusters(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontSize: 14, background: 'var(--bg-base)' }}>
            {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} grupos</option>)}
          </select>
        </div>
        <button onClick={ejecutar} disabled={loading}
          style={{ padding: '8px 24px', background: loading ? 'var(--fg-muted)' : 'var(--primary)', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', height: 38 }}>
          {loading ? 'Procesando...' : 'Ejecutar Clustering'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)', marginBottom: 24, fontSize: 14 }}>{error}</div>
      )}

      {data && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--fg-muted)' }}>
            {data.total_materiales} materiales agrupados en {data.n_clusters} clusters
          </div>

          {/* Cluster cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(data.clusters || {}).map(([key, cluster]) => (
              <div key={key} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${clusterColors[cluster.id % clusterColors.length]}` }}>
                <div
                  onClick={() => setExpandedCluster(expandedCluster === key ? null : key)}
                  style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-soft)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: clusterColors[cluster.id % clusterColors.length] }}>
                      Cluster {cluster.id + 1}
                    </span>
                    <span style={{ fontSize: 13, padding: '2px 8px', background: clusterColors[cluster.id % clusterColors.length], color: 'white', fontWeight: 600 }}>
                      {cluster.total_materiales} materiales
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span>Consumo Prom: <strong>${cluster.consumo_promedio?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong></span>
                    <span>Precio Prom: <strong>${cluster.precio_promedio?.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</strong></span>
                    <span>Stock Prom: <strong>{cluster.stock_promedio?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong></span>
                    <span style={{ fontWeight: 600 }}>{expandedCluster === key ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expandedCluster === key && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-soft)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Codigo</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Descripcion</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Consumo Anual</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Stock</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>Precio USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cluster.miembros?.map((m, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 12px', fontWeight: 600 }}>{m.codigo}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--fg-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>{m.consumo_anual?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>{m.stock_actual?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>${m.precio_unitario?.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
