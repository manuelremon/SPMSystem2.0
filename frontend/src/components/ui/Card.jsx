import React from "react";
import PropTypes from "prop-types";

/**
 * Card Component - Glass Morphism Style
 * Apple/iOS inspired translucent cards with backdrop blur
 * Soporta Dark Mode con variantes dark:
 */
export function Card({ className = "", children, hover = false, glow = false, interactive, ...props }) {
  // Support legacy 'interactive' prop
  const shouldHover = interactive !== undefined ? interactive : hover;

  return (
    <div
      className={`
        relative
        bg-[var(--card-glass)]
        backdrop-blur-md
        border border-[var(--border-glass)]
        rounded-lg
        shadow-glass
        ${shouldHover ? 'transition-all duration-300 ease-spring hover:bg-[var(--card-glass-strong)] hover:shadow-glow-primary' : ''}
        ${glow ? 'shadow-glow-primary' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
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
      className={`text-lg font-bold text-[var(--text-primary)] tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p
      className={`text-sm text-[var(--text-muted)] mt-1 ${className}`}
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

Card.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  hover: PropTypes.bool,
  glow: PropTypes.bool,
  interactive: PropTypes.bool,
};

CardHeader.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardTitle.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardDescription.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};
