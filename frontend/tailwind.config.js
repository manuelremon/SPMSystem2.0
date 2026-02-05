/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Dark mode: detecta data-theme="dark" en :root
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        // Roboto - Material UI typography
        sans: ["'Roboto'", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "'Helvetica Neue'", "Arial", "sans-serif"],
        mono: ["'Roboto Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["'Roboto'", "system-ui", "-apple-system", "sans-serif"],
      },

      // MUI Palette Colors - Synchronized with CSS variables
      colors: {
        // Primary - MUI Blue (uses CSS variables for consistency)
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
          dark: "var(--primary-dark)",
          50: "#e3f2fd",
          100: "#bbdefb",
          200: "#90caf9",
          300: "#64b5f6",
          400: "#42a5f5",
          500: "#2196f3",
          600: "#1e88e5",
          700: "#1976d2",
          800: "#1565c0",
          900: "#0d47a1",
        },
        // Secondary - MUI Purple
        secondary: {
          DEFAULT: "var(--secondary)",
          light: "var(--secondary-light)",
          dark: "var(--secondary-dark)",
          50: "#f3e5f5",
          100: "#e1bee7",
          200: "#ce93d8",
          300: "#ba68c8",
          400: "#ab47bc",
          500: "#9c27b0",
          600: "#8e24aa",
          700: "#7b1fa2",
          800: "#6a1b9a",
          900: "#4a148c",
        },
        // Success - MUI Green
        success: {
          DEFAULT: "var(--success)",
          light: "var(--success-light)",
          bg: "var(--success-bg)",
          50: "#e8f5e9",
          100: "#c8e6c9",
          200: "#a5d6a7",
          300: "#81c784",
          400: "#66bb6a",
          500: "#4caf50",
          600: "#43a047",
          700: "#388e3c",
          800: "#2e7d32",
          900: "#1b5e20",
        },
        // Danger/Error - MUI Red
        danger: {
          DEFAULT: "var(--danger)",
          light: "var(--danger-light)",
          bg: "var(--danger-bg)",
          50: "#ffebee",
          100: "#ffcdd2",
          200: "#ef9a9a",
          300: "#e57373",
          400: "#ef5350",
          500: "#f44336",
          600: "#e53935",
          700: "#d32f2f",
          800: "#c62828",
          900: "#b71c1c",
        },
        // Warning - MUI Orange
        warning: {
          DEFAULT: "var(--warning)",
          light: "var(--warning-light)",
          bg: "var(--warning-bg)",
          50: "#fff3e0",
          100: "#ffe0b2",
          200: "#ffcc80",
          300: "#ffb74d",
          400: "#ffa726",
          500: "#ff9800",
          600: "#fb8c00",
          700: "#f57c00",
          800: "#ef6c00",
          900: "#e65100",
        },
        // Info - MUI Light Blue
        info: {
          DEFAULT: "var(--info)",
          light: "var(--info-light)",
          bg: "var(--info-bg)",
          50: "#e1f5fe",
          100: "#b3e5fc",
          200: "#81d4fa",
          300: "#4fc3f7",
          400: "#29b6f6",
          500: "#03a9f4",
          600: "#039be5",
          700: "#0288d1",
          800: "#0277bd",
          900: "#01579b",
        },
        // Accent - MUI Pink
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          muted: "var(--accent-muted)",
          50: "#fce4ec",
          100: "#f8bbd9",
          200: "#f48fb1",
          300: "#f06292",
          400: "#ec407a",
          500: "#e91e63",
          600: "#d81b60",
          700: "#c2185b",
          800: "#ad1457",
          900: "#880e4f",
        },
        // Glass backgrounds
        glass: {
          white: "rgba(255, 255, 255, 0.7)",
          "white-strong": "rgba(255, 255, 255, 0.85)",
          "white-subtle": "rgba(255, 255, 255, 0.5)",
          border: "rgba(255, 255, 255, 0.3)",
          "border-strong": "rgba(255, 255, 255, 0.5)",
        },
      },

      // Border radius - All set to 0 (no rounded corners)
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "0",
      },

      // Glass Morphism Shadows
      boxShadow: {
        // Glass shadows - colored and diffuse
        glass: "0 8px 32px rgba(31, 38, 135, 0.15)",
        "glass-sm": "0 4px 16px rgba(31, 38, 135, 0.1)",
        "glass-lg": "0 12px 48px rgba(31, 38, 135, 0.2)",

        // Glow effects
        glow: "0 0 40px rgba(59, 130, 246, 0.15)",
        "glow-primary": "0 0 30px rgba(59, 130, 246, 0.2)",
        "glow-accent": "0 0 30px rgba(236, 72, 153, 0.2)",
        "glow-strong": "0 0 50px rgba(59, 130, 246, 0.25)",

        // Card shadows
        soft: "0 4px 16px rgba(0, 0, 0, 0.06)",
        strong: "0 8px 32px rgba(31, 38, 135, 0.12)",
        elevated: "0 12px 48px rgba(31, 38, 135, 0.18)",
        card: "0 4px 24px rgba(0, 0, 0, 0.08)",

        // Standard elevation
        sm: "0 2px 8px rgba(0, 0, 0, 0.04)",
        md: "0 4px 16px rgba(0, 0, 0, 0.06)",
        lg: "0 8px 24px rgba(0, 0, 0, 0.08)",
        xl: "0 12px 32px rgba(0, 0, 0, 0.1)",
        "2xl": "0 20px 48px rgba(0, 0, 0, 0.12)",

        inner: "inset 0 2px 4px rgba(0, 0, 0, 0.04)",
      },

      // Blur values for glass effect
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        DEFAULT: "12px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        "2xl": "64px",
      },

      // Spring easings for smooth animations
      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "bounce-soft": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
        "elastic": "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
      },

      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },

      // Glass Morphism Animations
      animation: {
        // Entrance animations
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "slide-down": "slideDown 0.4s ease-out",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "expand-in": "expandIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",

        // Glass specific
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "glass-shimmer": "glassShimmer 3s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",

        // Legacy
        fadeIn: "fadeIn 0.3s ease-out",
        slideUp: "slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        slideDown: "slideDown 0.3s ease-out",
        scaleIn: "scaleIn 0.25s ease-out",
        "pulse-glow": "pulse-glow 2s infinite",
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
        expandIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Glass Morphism specific keyframes
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(59, 130, 246, 0.4)" },
        },
        glassShimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(59, 130, 246, 0)" },
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
        // Enterprise Typography Scale (modular 1.25 ratio) - Synchronized with index.css --text-*
        "micro": ["0.6875rem", { lineHeight: "1rem" }],        // 11px - Tags, badges, labels
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],          // 11px - Synced with --text-2xs
        "xs": ["0.75rem", { lineHeight: "1rem" }],             // 12px - Captions
        "sm": ["0.875rem", { lineHeight: "1.25rem" }],         // 14px - Secondary body
        "base": ["1rem", { lineHeight: "1.5rem" }],            // 16px - Primary body
        "lg": ["1.125rem", { lineHeight: "1.75rem" }],         // 18px - Lead text
        "xl": ["1.25rem", { lineHeight: "1.75rem" }],          // 20px - H4 / Card titles
        "2xl": ["1.5rem", { lineHeight: "2rem" }],             // 24px - H3 / Section titles
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],  // 30px - H2
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],    // 36px - H1
        "5xl": ["3rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],          // 48px - Display
        "6xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.025em" }],      // 60px - Hero
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
