/**
 * SEO Component - Meta tags dinámicos para cada página
 * Usa react-helmet-async para gestionar el <head>
 */
import { Helmet } from 'react-helmet-async'

const DEFAULT_TITLE = 'SPM - Sistema de Gestión de Solicitudes'
const DEFAULT_DESCRIPTION = 'Sistema de Planificación de Materiales - Gestiona solicitudes, aprobaciones y planificación de materiales de forma eficiente.'

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  noIndex = false
}) {
  const fullTitle = title ? `${title} | SPM` : DEFAULT_TITLE

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="es_ES" />
    </Helmet>
  )
}

// Hook para usar en páginas
export function usePageTitle(title) {
  return title ? `${title} | SPM` : DEFAULT_TITLE
}
