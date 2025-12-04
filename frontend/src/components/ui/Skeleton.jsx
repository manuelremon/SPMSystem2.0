import React from "react";
import clsx from "clsx";

/**
 * Skeleton - Loading placeholder component with shimmer animation
 *
 * @param {string} variant - Type of skeleton: 'text' | 'circular' | 'rectangular' | 'card' | 'avatar' | 'button' | 'input' | 'badge'
 * @param {string} width - Custom width (e.g., "100px", "50%")
 * @param {string} height - Custom height (e.g., "20px", "100%")
 * @param {string} className - Additional classes
 * @param {number} count - Number of skeleton items to render
 * @param {boolean} shimmer - Use shimmer animation instead of pulse (default: true)
 */
export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  count = 1,
  shimmer = true,
}) {
  const baseClasses = clsx(
    shimmer
      ? "bg-gradient-to-r from-[var(--bg-elevated)] via-[var(--card-hover)] to-[var(--bg-elevated)] bg-[length:200%_100%] animate-shimmer"
      : "animate-pulse bg-[var(--bg-elevated)]"
  );

  const variantClasses = {
    text: "h-4 rounded-[var(--radius-sm)]",
    circular: "rounded-full",
    rectangular: "rounded-[var(--radius-md)]",
    card: "rounded-[var(--radius-lg)]",
    avatar: "w-10 h-10 rounded-full",
    "avatar-sm": "w-8 h-8 rounded-full",
    "avatar-lg": "w-14 h-14 rounded-full",
    button: "h-10 w-24 rounded-[var(--radius-md)]",
    input: "h-12 w-full rounded-[var(--radius-md)]",
    badge: "h-6 w-16 rounded-full",
    icon: "w-5 h-5 rounded-[var(--radius-sm)]",
  };

  const defaultSizes = {
    circular: { width: "40px", height: "40px" },
    avatar: { width: "40px", height: "40px" },
    "avatar-sm": { width: "32px", height: "32px" },
    "avatar-lg": { width: "56px", height: "56px" },
    text: { width: "100%", height: "16px" },
    rectangular: { width: "100%", height: "100px" },
    card: { width: "100%", height: "200px" },
    button: { width: "96px", height: "40px" },
    input: { width: "100%", height: "48px" },
    badge: { width: "64px", height: "24px" },
    icon: { width: "20px", height: "20px" },
  };

  const defaults = defaultSizes[variant] || defaultSizes.text;
  const style = {
    width: width || defaults.width,
    height: height || defaults.height,
  };

  const items = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={clsx(baseClasses, variantClasses[variant], className)}
      style={style}
      role="status"
      aria-label="Cargando..."
    />
  ));

  return count === 1 ? items[0] : <div className="space-y-2">{items}</div>;
}

/**
 * TableSkeleton - Pre-configured skeleton for tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Cargando tabla...">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-[var(--border)]">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} variant="text" height="12px" width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              height="16px"
              width={`${100 / columns}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton - Pre-configured skeleton for cards
 */
export function CardSkeleton({ showImage = false, lines = 3 }) {
  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-4"
      role="status"
      aria-label="Cargando..."
    >
      {showImage && (
        <Skeleton variant="rectangular" height="150px" className="mb-4" />
      )}
      <Skeleton variant="text" width="60%" height="24px" />
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={i === lines - 1 ? "80%" : "100%"}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * StatCardSkeleton - Pre-configured skeleton for stat cards
 */
export function StatCardSkeleton() {
  return (
    <div
      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6"
      role="status"
      aria-label="Cargando..."
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width="80px" height="12px" />
          <Skeleton variant="text" width="60px" height="28px" />
        </div>
        <Skeleton variant="circular" width="48px" height="48px" />
      </div>
    </div>
  );
}

/**
 * FormSkeleton - Pre-configured skeleton for forms
 */
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando formulario...">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" width="100px" height="14px" />
          <Skeleton variant="rectangular" height="44px" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton variant="rectangular" width="100px" height="40px" />
        <Skeleton variant="rectangular" width="80px" height="40px" />
      </div>
    </div>
  );
}

export default Skeleton;
