import { clsx } from "clsx";

/**
 * Utility function for merging Tailwind CSS classes
 * Combines clsx for conditional classes
 *
 * @param {...(string|object|array)} inputs - Class names or conditional objects
 * @returns {string} - Merged class string
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-primary", { "opacity-50": disabled })
 */
export function cn(...inputs) {
  return clsx(inputs);
}
