import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { solicitudes } from '../services/spm'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useI18n } from '../context/i18n'
import { Button } from '../components/ui/Button'
import { CustomSelect } from '../components/ui/CustomSelect'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { FormSkeleton } from '../components/ui/Skeleton'
import { FileUploader } from '../components/ui/FileUploader'

function getDefaultNeedDate() {
  const d = new Date()
  d.setDate(d.getDate() + 120)
  return d.toISOString().slice(0, 10)
}

export default function CreateSolicitud() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t } = useI18n()
  const [form, setForm] = useState({
    centro: '',
    sector: '',
    centro_costos: '',
    almacen_virtual: '',
    criticidad: 'Normal',
    fecha_necesidad: getDefaultNeedDate(),
    justificacion: '',
    archivos: [],
  })
  const [catalogos, setCatalogos] = useState({ centros: [], sectores: [], almacenes: [] })
  const [loadingCatalogos, setLoadingCatalogos] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const token = useMemo(() => localStorage.getItem('token'), [])

  const loadFormCatalogsForNuevaSolicitud = async () => {
    setLoadingCatalogos(true)
    try {
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

      let catalogosData = {}
      try {
        const resCatalogos = await api.get('/catalogos', { headers: authHeaders })
        catalogosData = resCatalogos.data || {}
      } catch (errCombined) {
        if (!errCombined.response) {
          throw errCombined
        }
        const [centrosRes, sectoresRes, almacenesRes] = await Promise.all([
          api.get('/catalogos/centros'),
          api.get('/catalogos/sectores'),
          api.get('/catalogos/almacenes'),
        ])
        catalogosData = {
          centros: centrosRes.data || [],
          sectores: sectoresRes.data || [],
          almacenes: almacenesRes.data || [],
        }
      }

      const acceso = await api.get('/auth/mi-acceso', { headers: authHeaders })
      const vista = acceso.data || {}
      const centrosPermitidos = vista.centros_permitidos || []
      const sectoresPermitidos = vista.sectores_permitidos || []
      const almacenesPermitidos = vista.almacenes_permitidos || []

      const hasAccessControlCentros = Array.isArray(centrosPermitidos) && centrosPermitidos.length > 0
      const hasAccessControlSectores = Array.isArray(sectoresPermitidos) && sectoresPermitidos.length > 0
      const hasAccessControlAlmacenes = Array.isArray(almacenesPermitidos) && almacenesPermitidos.length > 0

      const centrosFiltrados = (catalogosData.centros || []).filter(
        (c) => !hasAccessControlCentros || centrosPermitidos.includes(c.id)
      )
      const sectoresFiltrados = (catalogosData.sectores || []).filter(
        (s) => !hasAccessControlSectores || sectoresPermitidos.includes(s.id)
      )
      const almacenesFiltrados = (catalogosData.almacenes || []).filter(
        (a) => !hasAccessControlAlmacenes || almacenesPermitidos.includes(a.id)
      )

      setCatalogos({
        centros: centrosFiltrados,
        sectores: sectoresFiltrados,
        almacenes: almacenesFiltrados,
      })
    } catch (err) {
      console.error('Error catalogos:', err)
      setError('Error al cargar catalogos. Intenta recargar la pagina o reintenta en unos segundos.')
    } finally {
      setLoadingCatalogos(false)
    }
  }

  const preloadUserDataForNuevaSolicitud = async () => {
    try {
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.get('/auth/me', { headers: authHeaders })
      const currentUser = res.data?.user || {}

      setForm((prev) => {
        const next = { ...prev }
        if (currentUser.sector_id && catalogos.sectores.some((s) => s.id === currentUser.sector_id)) {
          next.sector = currentUser.sector_id
        }
        if (currentUser.centro_id && catalogos.centros.some((c) => c.id === currentUser.centro_id)) {
          next.centro = currentUser.centro_id
        }
        return next
      })
    } catch (err) {
      console.error('Error preload user:', err)
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadFormCatalogsForNuevaSolicitud()
      await preloadUserDataForNuevaSolicitud()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChange = useCallback((e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  const onSubmit = useCallback(async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      let res

      // Si hay archivos adjuntos, usar FormData (multipart/form-data)
      if (form.archivos && form.archivos.length > 0) {
        const formData = new FormData()
        formData.append('centro', form.centro)
        formData.append('sector', form.sector)
        formData.append('centro_costos', form.centro_costos)
        formData.append('almacen_virtual', form.almacen_virtual)
        formData.append('criticidad', form.criticidad)
        formData.append('fecha_necesidad', form.fecha_necesidad)
        formData.append('justificacion', form.justificacion)
        formData.append('usuario_id', user?.id || '')

        // Agregar cada archivo
        form.archivos.forEach((file) => {
          formData.append('archivos', file)
        })

        res = await solicitudes.crearConArchivos(formData)
      } else {
        // Sin archivos, usar JSON tradicional
        const payload = {
          centro: form.centro,
          sector: form.sector,
          centro_costos: form.centro_costos,
          almacen_virtual: form.almacen_virtual,
          criticidad: form.criticidad,
          fecha_necesidad: form.fecha_necesidad,
          justificacion: form.justificacion,
          usuario_id: user?.id,
        }
        res = await solicitudes.crear(payload)
      }

      const data = res.data
      const id = data.id || data.solicitud?.id
      if (!id) throw new Error(t('create_no_id', 'No se recibió id de solicitud'))
      navigate(`/solicitudes/${id}/materiales`)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSubmitting(false)
    }
  }, [form, user?.id, navigate, t])

  const handleCancel = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title={t('create_title', 'NUEVA SOLICITUD')} />

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{t('create_header', 'Crear Nueva Solicitud')}</CardTitle>
          <CardDescription>
            {t('create_desc', 'Completa los datos básicos para crear una nueva solicitud de materiales')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {loadingCatalogos ? (
            <FormSkeleton rows={6} />
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {/* Fila 1: Centro y Sector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="centro"
                    className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                  >
                    {t('create_centro', 'Centro')} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <CustomSelect
                    id="centro"
                    name="centro"
                    value={form.centro}
                    onChange={onChange}
                    required
                    placeholder={t('create_select_centro', 'Selecciona centro')}
                    options={catalogos.centros.map((c) => ({
                      value: c.id,
                      label: `${c.id} - ${c.nombre || c.descripcion || ''}`,
                    }))}
                    aria-label={t('create_centro', 'Centro')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="sector"
                    className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                  >
                    {t('create_sector', 'Sector')} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <CustomSelect
                    id="sector"
                    name="sector"
                    value={form.sector}
                    onChange={onChange}
                    required
                    placeholder={t('create_select_sector', 'Selecciona sector')}
                    options={catalogos.sectores.map((s) => ({
                      value: s.nombre,
                      label: s.nombre || s.descripcion || '',
                    }))}
                    aria-label={t('create_sector', 'Sector')}
                  />
                </div>
              </div>

              {/* Fila 2: Centro de Costos y Almacén */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="centro_costos"
                    className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                  >
                    {t('create_centro_costos', 'Centro de costos')} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <Input
                    id="centro_costos"
                    name="centro_costos"
                    value={form.centro_costos}
                    onChange={onChange}
                    required
                    placeholder="Ej: CC001"
                    aria-label={t('create_centro_costos', 'Centro de costos')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="almacen"
                    className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                  >
                    {t('create_almacen', 'Almacén')} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <CustomSelect
                    id="almacen"
                    name="almacen_virtual"
                    value={form.almacen_virtual}
                    onChange={onChange}
                    required
                    placeholder={t('create_select_almacen', 'Selecciona almacén')}
                    options={catalogos.almacenes.map((a) => ({
                      value: a.id,
                      label: `${a.id} - ${a.nombre || a.descripcion || ''}`,
                    }))}
                    aria-label={t('create_almacen', 'Almacén')}
                  />
                </div>
              </div>

              {/* Fila 3: Criticidad y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="criticidad"
                    className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                  >
                    {t('create_criticidad', 'Criticidad')}
                  </label>
                  <CustomSelect
                    id="criticidad"
                    name="criticidad"
                    value={form.criticidad}
                    onChange={onChange}
                    options={[
                      { value: 'Normal', label: t('create_normal', 'Normal') },
                      { value: 'Alta', label: t('create_alta', 'Alta') },
                      { value: 'Critica', label: t('create_critica', 'Crítica') },
                    ]}
                    aria-label={t('create_criticidad', 'Criticidad')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="fecha_necesidad"
                    className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                  >
                    {t('create_fecha', 'Fecha de Necesidad')} <span className="text-[var(--danger)]">*</span>
                  </label>
                  <Input
                    type="date"
                    id="fecha_necesidad"
                    name="fecha_necesidad"
                    value={form.fecha_necesidad}
                    onChange={onChange}
                    required
                    aria-label={t('create_fecha', 'Fecha de Necesidad')}
                  />
                </div>
              </div>

              {/* Justificación */}
              <div className="space-y-1.5">
                <label
                  htmlFor="justificacion"
                  className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
                >
                  {t('create_justificacion', 'Justificación')} <span className="text-[var(--danger)]">*</span>
                </label>
                <textarea
                  id="justificacion"
                  name="justificacion"
                  value={form.justificacion}
                  onChange={onChange}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:ring-2 focus:ring-[var(--input-focus)] focus:border-[var(--primary)] outline-none transition-all resize-none"
                  rows={3}
                  required
                  placeholder={t('create_justificacion_placeholder', 'Describe brevemente el motivo de la solicitud...')}
                  aria-label={t('create_justificacion', 'Justificación')}
                />
              </div>

              {/* Archivos Adjuntos */}
              <div className="space-y-1.5">
                <label className="block text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]">
                  {t('create_adjuntos', 'Archivos Adjuntos')}
                  <span className="text-[var(--fg-subtle)] normal-case font-normal ml-1">
                    {t('common_optional', '(opcional)')}
                  </span>
                </label>
                <FileUploader
                  files={form.archivos}
                  onChange={(archivos) => setForm((prev) => ({ ...prev, archivos }))}
                  maxFiles={5}
                  maxSize={10 * 1024 * 1024}
                  placeholder={t('create_adjuntos_placeholder', 'Arrastra archivos aquí o haz clic para seleccionar')}
                />
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleCancel}
                  aria-label={t('create_cancelar', 'Cancelar y volver al dashboard')}
                >
                  {t('common_cancelar', 'Cancelar')}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  aria-label={t('create_submit', 'Crear solicitud y agregar materiales')}
                >
                  {submitting
                    ? t('create_submitting', 'Creando...')
                    : t('create_btn', 'Crear y agregar materiales')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
