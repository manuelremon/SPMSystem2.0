import React from "react";
import { useParallax } from "../../hooks/useParallax";

export function PageHeader({
  title,
  subtitle, // Deprecated - no longer rendered
  description, // Deprecated - no longer rendered
  badge,
  actions,
  meta, // Legacy support
  eyebrow, // Legacy support
  className = ""
}) {
  // Support legacy props
  const displayBadge = badge || eyebrow;
  const displayMeta = meta || actions;

  // Parallax effect - light preset (offset: 0.35)
  const { ref, style, isDisabled } = useParallax({ offset: 0.35 });

  return (
    <div
      ref={ref}
      className={`relative parallax-element ${className}`}
      style={isDisabled ? {} : style}
    >
      {/* Ambient glow de fondo */}
      <div className="absolute -top-20 -left-20 w-64 h-64 ambient-orb primary opacity-30" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          {displayBadge && (
            <span className="inline-flex items-center px-2.5 py-1 mb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50/70 rounded-full border border-blue-200/50">
              {displayBadge}
            </span>
          )}
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">
            {title}
          </h1>
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
