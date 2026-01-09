/**
 * AnalisisPuntualHome - Centro de importacion de datos temporales
 *
 * Permite a administradores:
 * - Importar archivo Excel con datos para analisis
 * - Ver estado actual de datos temporales
 * - Acceder a MRP y Forecast temporales
 */

import React, { useState, useCallback } from 'react'
import Layout from '../../components/Layout'
import { Button } from '../../components/ui/Button'
import { TempDataBanner } from '../../components/ui/TempDataBanner'
import { ImportExcelModal } from '../../components/admin/ImportExcelModal'
import { useI18n } from '../../context/i18n'
import { useNavigate } from 'react-router-dom'

export default function AnalisisPuntualHome() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [showImportModal, setShowImportModal] = useState(false)
  const [tempDataActive, setTempDataActive] = useState(false)

  const handleImportSuccess = useCallback((result) => {
    setTempDataActive(true)
    setShowImportModal(false)
  }, [])

  const handleStatusChange = useCallback((active) => {
    setTempDataActive(active)
  }, [])

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {t('admin_ap_titulo', 'Analisis Puntual con Datos Excel')}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {t('admin_ap_descripcion', 'Importa un archivo Excel para analizar MRP y Forecast sin afectar los datos del sistema.')}
          </p>
        </div>

        {/* Banner de estado */}
        <TempDataBanner onStatusChange={handleStatusChange} />

        {/* Contenido segun estado */}
        {tempDataActive ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Card MRP */}
            <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    {t('admin_ap_mrp', 'MRP Temporal')}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">Alertas y KPIs con datos importados</p>
                </div>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate('/admin/analisis-puntual/mrp')}
              >
                {t('admin_ap_abrir_mrp', 'Abrir MRP Temporal')}
              </Button>
            </div>

            {/* Card Forecast */}
            <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    {t('admin_ap_forecast', 'Forecast Temporal')}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">Pronosticos con consumo historico importado</p>
                </div>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => navigate('/admin/analisis-puntual/forecast')}
              >
                {t('admin_ap_abrir_forecast', 'Abrir Forecast Temporal')}
              </Button>
            </div>
          </div>
        ) : (
          /* Estado sin datos */
          <div className="bg-[var(--card)] rounded-xl p-8 border border-[var(--border)] text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {t('admin_ap_sin_datos', 'Sin datos temporales cargados')}
            </h3>
            <p className="text-[var(--text-muted)] mb-6">
              {t('admin_ap_sin_datos_desc', 'Importa un archivo Excel para comenzar el analisis.')}
            </p>
            <Button variant="primary" onClick={() => setShowImportModal(true)}>
              {t('admin_ap_importar_excel', 'Importar Excel')}
            </Button>
          </div>
        )}

        {/* Modal de importacion */}
        <ImportExcelModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      </div>
    </Layout>
  )
}
