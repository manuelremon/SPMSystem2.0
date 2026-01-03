import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Table Primitives - SPM Design System
 * Usa CSS variables para consistencia global
 */

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm",
        // Glass table container
        "bg-[var(--card-glass)] backdrop-blur-md",
        "border border-[var(--border-glass)]",
        "rounded-[16px] overflow-hidden",
        className
      )}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-[var(--bg-soft)] backdrop-blur-sm",
      "border-b-2 border-[var(--border)]",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-[var(--border-glass)] bg-[var(--card-glass)] font-medium",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-slate-200 dark:border-slate-700",
      "transition-colors duration-200",
      "hover:bg-[var(--bg-elevated)]",
      "data-[state=selected]:bg-[var(--primary-muted)]",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      // Spacing
      "h-11 px-4 py-3",
      // Typography
      "text-xs font-semibold uppercase tracking-wider",
      "text-[var(--fg-muted)]",
      // Background - inherits from TableHeader
      "bg-transparent",
      // Grid lines - gray
      "border-r border-b border-slate-200 dark:border-slate-700 last:border-r-0",
      // Sticky header
      "sticky top-0 z-10",
      // Alignment - Centrado global
      "text-center align-middle",
      // Sortable state
      "[&:has([role=button])]:cursor-pointer",
      "[&:has([role=button])]:hover:text-[var(--primary)]",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, align = "left", ...props }, ref) => {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align] || "text-left";

  return (
    <td
      ref={ref}
      className={cn(
        // Spacing
        "px-4 py-3",
        // Typography
        "text-sm text-[var(--fg)]",
        // Grid lines - gray
        "border-r border-b border-slate-200 dark:border-slate-700 last:border-r-0",
        // Alignment
        "align-middle",
        alignClass,
        className
      )}
      {...props}
    />
  );
});
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-[var(--fg-muted)]", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
