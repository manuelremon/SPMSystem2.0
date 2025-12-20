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
        bg-white/70 dark:bg-slate-800/70
        backdrop-blur-md
        border border-white/30 dark:border-white/10
        rounded-[20px]
        shadow-glass
        ${shouldHover ? 'transition-all duration-300 hover:bg-white/85 dark:hover:bg-slate-700/80 hover:shadow-glow-primary' : ''}
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
      className={`text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p
      className={`text-sm text-slate-500 dark:text-slate-400 mt-1 ${className}`}
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

Card.defaultProps = {
  className: "",
  hover: false,
  glow: false,
};

CardHeader.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardHeader.defaultProps = {
  className: "",
};

CardTitle.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardTitle.defaultProps = {
  className: "",
};

CardDescription.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardDescription.defaultProps = {
  className: "",
};

CardContent.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

CardContent.defaultProps = {
  className: "",
};
