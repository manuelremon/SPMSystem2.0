import React from "react";

export function Card({ className = "", children, hover = true, glow = false, interactive, ...props }) {
  // Support legacy 'interactive' prop
  const shouldHover = interactive !== undefined ? interactive : hover;

  return (
    <div
      className={`
        relative overflow-hidden
        bg-[var(--card)]
        border border-[var(--border)]
        rounded-[var(--radius-lg)]
        transition-all duration-[var(--transition-base)]
        ${shouldHover ? 'hover:border-[var(--border-hover)] hover:bg-[var(--card-hover)]' : ''}
        ${glow ? 'shadow-[var(--shadow-glow)]' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Gradient overlay sutil */}
      <div className="absolute inset-0 bg-[var(--gradient-card)] pointer-events-none opacity-50" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div
      className={`px-6 pt-6 pb-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3
      className={`text-lg font-bold text-[var(--fg-strong)] tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p
      className={`text-sm text-[var(--fg-muted)] mt-1 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div
      className={`px-6 pb-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
