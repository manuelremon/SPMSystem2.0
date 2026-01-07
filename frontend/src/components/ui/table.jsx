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
        // Fondo transparente - hereda del contenedor padre
        "bg-transparent",
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
      "bg-slate-50/50 dark:bg-slate-800/50",
      "border-b border-slate-200/50 dark:border-slate-700/50",
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
      "border-t border-slate-200/50 dark:border-slate-700/50",
      "bg-slate-50/30 dark:bg-slate-800/30",
      "font-medium",
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
      "border-b border-slate-200/50 dark:border-slate-700/50",
      "transition-colors duration-200",
      "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
      "data-[state=selected]:bg-blue-50/50 dark:data-[state=selected]:bg-blue-900/20",
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
      "text-slate-500 dark:text-slate-400",
      // Background - inherits from TableHeader
      "bg-transparent",
      // Sticky header
      "sticky top-0 z-10",
      // Alignment - Centrado global
      "text-center align-middle",
      // Sortable state
      "[&:has([role=button])]:cursor-pointer",
      "[&:has([role=button])]:hover:text-blue-600 dark:[&:has([role=button])]:hover:text-blue-400",
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
        "text-sm text-slate-700 dark:text-slate-200",
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
