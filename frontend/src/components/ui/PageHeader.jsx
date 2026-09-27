import { PageTitleBar } from "./PageLayout";

/**
 * Compatibilidad: encabezado de pagina con el estilo canonico (ver PageLayout).
 * Props legacy (badge/eyebrow/meta/description) se mantienen para no romper usos existentes.
 */
export function PageHeader({ title, subtitle, actions, meta, badge, eyebrow, backTo, status }) {
  return (
    <PageTitleBar
      title={title}
      subtitle={subtitle}
      actions={actions || meta}
      status={status || badge || eyebrow}
      backTo={backTo}
    />
  );
}

export default PageHeader;
