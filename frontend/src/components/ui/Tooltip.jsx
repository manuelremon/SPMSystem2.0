/**
 * Tooltip Component - Shows info on hover
 * Lightweight, CSS-only tooltip with smooth transitions
 */

import React, { useState } from "react";

export function Tooltip({ children, content, position = "top", delay = 200 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  if (!content) {
    return children;
  }

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-[var(--tooltip-bg)] border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--tooltip-bg)] border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-[var(--tooltip-bg)] border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-[var(--tooltip-bg)] border-t-transparent border-b-transparent border-l-transparent",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className={`
            absolute z-50 ${positionClasses[position]}
            px-3 py-2 rounded-lg shadow-lg
            bg-[var(--tooltip-bg,#1f2937)] text-[var(--tooltip-text,#f9fafb)]
            text-xs font-medium whitespace-nowrap
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
          role="tooltip"
        >
          {content}
          <span
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            style={{ borderWidth: "5px" }}
          />
        </div>
      )}
    </div>
  );
}

// Rich tooltip for more complex content (like status info)
export function InfoTooltip({ children, title, lines = [], position = "top" }) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  const hasContent = title || lines.length > 0;
  if (!hasContent) {
    return children;
  }

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), 150);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-block cursor-help"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className={`
            absolute z-50 ${positionClasses[position]}
            min-w-[200px] max-w-[280px]
            px-3 py-2.5 rounded-lg shadow-xl border
            bg-[var(--card)] border-[var(--border)]
            text-xs
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
          role="tooltip"
        >
          {title && (
            <p className="font-semibold text-[var(--fg)] mb-1.5 pb-1.5 border-b border-[var(--border)]">
              {title}
            </p>
          )}
          <div className="space-y-1">
            {lines.map((line, idx) => (
              <p key={idx} className="text-[var(--fg-muted)] leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Tooltip;
