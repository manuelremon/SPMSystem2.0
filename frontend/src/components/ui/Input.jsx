import React from "react";
import clsx from "clsx";

export const Input = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-[var(--transition-fast)]",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
