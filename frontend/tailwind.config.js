/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Aptos Light typography
        sans: ["'Aptos Light'", "'Aptos'", "'Segoe UI'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'Space Mono'", "'Consolas'", "'Monaco'", "monospace"],
        display: ["'Aptos Light'", "'Aptos'", "'Segoe UI'", "system-ui", "sans-serif"],
      },
      colors: {
        // TensorStax dark palette
        background: "#000000",
        surface: "#0d0d0d",
        elevated: "#111111",

        // Primary accent - TensorStax orange
        primary: {
          50: "rgba(255, 107, 53, 0.08)",
          100: "rgba(255, 107, 53, 0.15)",
          200: "rgba(255, 107, 53, 0.25)",
          300: "#FF8C5A",
          400: "#FF7A47",
          500: "#FF6B35",
          600: "#E85A25",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },

        // Neutral grays
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },

        // Status colors
        danger: {
          50: "rgba(239, 68, 68, 0.12)",
          100: "rgba(239, 68, 68, 0.2)",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
        success: {
          50: "rgba(34, 197, 94, 0.12)",
          100: "rgba(34, 197, 94, 0.2)",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
        },
        warning: {
          50: "rgba(245, 158, 11, 0.12)",
          100: "rgba(245, 158, 11, 0.2)",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        info: {
          50: "rgba(59, 130, 246, 0.12)",
          100: "rgba(59, 130, 246, 0.2)",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },

        // Accent colors
        accent: {
          orange: "#FF6B35",
          blue: "#3B82F6",
          green: "#22C55E",
          amber: "#F59E0B",
          red: "#EF4444",
        },
      },

      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
      },

      boxShadow: {
        // TensorStax-inspired shadows
        soft: "0 4px 24px rgba(0, 0, 0, 0.5)",
        strong: "0 12px 48px rgba(0, 0, 0, 0.7)",
        glow: "0 0 40px rgba(255, 107, 53, 0.15)",
        "glow-strong": "0 0 60px rgba(255, 107, 53, 0.25)",
        "glow-orange": "0 0 30px rgba(255, 107, 53, 0.3)",
        inner: "inset 0 2px 4px rgba(0, 0, 0, 0.1)",

        // Elevation levels
        sm: "0 2px 8px rgba(0, 0, 0, 0.3)",
        md: "0 4px 16px rgba(0, 0, 0, 0.4)",
        lg: "0 8px 32px rgba(0, 0, 0, 0.5)",
        xl: "0 16px 48px rgba(0, 0, 0, 0.6)",
        "2xl": "0 24px 64px rgba(0, 0, 0, 0.7)",
      },

      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "40px",
      },

      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "bounce-soft": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },

      transitionDuration: {
        "600": "600ms",
        "800": "800ms",
      },

      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        slideUp: "slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        slideDown: "slideDown 0.3s ease-out",
        scaleIn: "scaleIn 0.25s ease-out",
        "pulse-glow": "pulse-glow 2s infinite",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        marquee: "marquee 20s linear infinite",
        "spin-slow": "spin 3s linear infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 107, 53, 0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(255, 107, 53, 0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },

      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "30": "7.5rem",
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        "3xl": ["2rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.5rem", { lineHeight: "2.75rem", letterSpacing: "-0.02em" }],
        "5xl": ["3rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "6xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
      },

      letterSpacing: {
        tighter: "-0.05em",
        tight: "-0.025em",
        normal: "0",
        wide: "0.025em",
        wider: "0.05em",
        widest: "0.1em",
        "ultra-wide": "0.2em",
      },
    },
  },
  plugins: [],
};
