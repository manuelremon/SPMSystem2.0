/**
 * Tooltip Component - Glass Morphism Style
 * Translucent tooltips with backdrop blur
 * Uses portal to render outside overflow containers
 */

import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import clsx from "clsx";

export function Tooltip({ children, content, position = "top", delay = 200, className = "" }) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const triggerRef = useRef(null);

  if (!content) {
    return children;
  }

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        let style = {};

        switch (position) {
          case "right":
            style = {
              top: rect.top + rect.height / 2,
              left: rect.right + 8,
              transform: "translateY(-50%)",
            };
            break;
          case "left":
            style = {
              top: rect.top + rect.height / 2,
              right: window.innerWidth - rect.left + 8,
              transform: "translateY(-50%)",
            };
            break;
          case "bottom":
            style = {
              top: rect.bottom + 8,
              left: rect.left + rect.width / 2,
              transform: "translateX(-50%)",
            };
            break;
          case "top":
          default:
            style = {
              bottom: window.innerHeight - rect.top + 8,
              left: rect.left + rect.width / 2,
              transform: "translateX(-50%)",
            };
            break;
        }

        setTooltipStyle(style);
      }
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      className={clsx("relative", className || "inline-flex")}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && createPortal(
        <div
          className={clsx(
            "fixed z-[9999] pointer-events-none",
            // Glass style
            "px-3 py-1.5 rounded-md",
            "bg-slate-900 text-white",
            "shadow-lg",
            // Text
            "text-xs font-medium whitespace-nowrap",
            // Animation
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
          style={tooltipStyle}
          role="tooltip"
        >
          {content}
        </div>,
        document.body
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
          className={clsx(
            "absolute z-50",
            positionClasses[position],
            // Glass style
            "min-w-[200px] max-w-[280px]",
            "px-3 py-2.5 rounded-xl",
            "bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl",
            "border border-white/50 dark:border-white/10",
            "shadow-glass",
            // Text
            "text-xs",
            // Animation
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          role="tooltip"
        >
          {title && (
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5 pb-1.5 border-b border-white/30 dark:border-white/10">
              {title}
            </p>
          )}
          <div className="space-y-1">
            {lines.map((line, idx) => (
              <p key={idx} className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Tooltip.propTypes = {
  children: PropTypes.node,
  content: PropTypes.node,
  position: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  delay: PropTypes.number,
  className: PropTypes.string,
};

Tooltip.defaultProps = {
  position: "top",
  delay: 200,
  className: "",
};

InfoTooltip.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  lines: PropTypes.arrayOf(PropTypes.string),
  position: PropTypes.oneOf(["top", "bottom", "left", "right"]),
};

InfoTooltip.defaultProps = {
  lines: [],
  position: "top",
};

export default Tooltip;
