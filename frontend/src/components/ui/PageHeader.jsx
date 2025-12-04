import React from "react";

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  meta, // Legacy support
  eyebrow, // Legacy support
  className = ""
}) {
  // Support legacy props
  const displayBadge = badge || eyebrow;
  const displayMeta = meta || actions;

  return (
    <div className={`relative ${className}`}>
      {/* Ambient glow de fondo */}
      <div className="absolute -top-20 -left-20 w-64 h-64 ambient-orb primary opacity-30" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          {displayBadge && (
            <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--primary)] bg-[var(--primary-glow)] rounded-full border border-[var(--primary)]/30">
              {displayBadge}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-black text-[var(--fg-strong)] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[var(--fg-muted)]">{subtitle}</p>
          )}
        </div>

        {displayMeta && (
          <div className="flex items-center gap-3">
            {displayMeta}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
