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
            <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-900/40 rounded-full border border-blue-200/50 dark:border-blue-700/50">
              {displayBadge}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
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
