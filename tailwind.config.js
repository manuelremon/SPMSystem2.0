/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Aptos", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Space Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Fondos - Sincronizado con CSS Variables
        bg: "var(--bg)",
        "bg-soft": "var(--bg-soft)",
        "bg-elevated": "var(--bg-elevated)",
        surface: "var(--surface)",
        card: "var(--card)",
        "card-hover": "var(--card-hover)",

        // Textos
        fg: "var(--fg)",
        "fg-strong": "var(--fg-strong)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",

        // Primary (Naranja TensorStax)
        primary: {
          DEFAULT: "var(--primary)",
          strong: "var(--primary-strong)",
          muted: "var(--primary-muted)",
          glow: "var(--primary-glow)",
        },

        // Accent (Cyan)
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          glow: "var(--accent-glow)",
        },

        // Secondary (Púrpura)
        secondary: {
          DEFAULT: "var(--secondary)",
          glow: "var(--secondary-glow)",
        },

        // Estados
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
          border: "var(--success-border)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
          border: "var(--warning-border)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          bg: "var(--danger-bg)",
          border: "var(--danger-border)",
        },
        info: {
          DEFAULT: "var(--info)",
          bg: "var(--info-bg)",
          border: "var(--info-border)",
        },

        // Bordes
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          subtle: "var(--border-subtle)",
          hover: "var(--border-hover)",
        },

        // Input
        input: {
          bg: "var(--input-bg)",
          border: "var(--input-border)",
          focus: "var(--input-focus)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      spacing: {
        // Mantener escala Tailwind por defecto y añadir semánticas
        "xs": "var(--space-xs)",
        "sm": "var(--space-sm)",
        "md": "var(--space-md)",
        "lg": "var(--space-lg)",
        "xl": "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
        // Component spacing
        "button-x": "var(--space-button-x)",
        "button-y": "var(--space-button-y)",
        "input-x": "var(--space-input-x)",
        "input-y": "var(--space-input-y)",
        "card": "var(--space-card)",
        "section": "var(--space-section)",
        "page": "var(--space-page)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        strong: "var(--shadow-strong)",
        glow: "var(--shadow-glow)",
        "glow-strong": "var(--shadow-glow-strong)",
        "glow-cyan": "var(--shadow-glow-cyan)",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        base: "var(--transition-base)",
        slow: "var(--transition-slow)",
      },
      animation: {
        "fade-in": "fadeIn var(--animation-base) var(--ease-out) forwards",
        "fade-out": "fadeOut var(--animation-base) var(--ease-in) forwards",
        "slide-up": "slideUp var(--animation-base) var(--ease-out) forwards",
        "slide-down": "slideDown var(--animation-base) var(--ease-out) forwards",
        "slide-left": "slideLeft var(--animation-base) var(--ease-out) forwards",
        "slide-right": "slideRight var(--animation-base) var(--ease-out) forwards",
        "scale-in": "scaleIn var(--animation-fast) var(--ease-out) forwards",
        "scale-out": "scaleOut var(--animation-fast) var(--ease-in) forwards",
        "expand-in": "expandIn var(--animation-slow) var(--ease-bounce) forwards",
        "bounce": "bounce 1s var(--ease-in-out) infinite",
        "shake": "shake 0.5s var(--ease-in-out)",
        "wiggle": "wiggle 0.5s var(--ease-in-out)",
        "pulse-glow": "pulse-glow 2s infinite",
        "float": "float 3s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "heartbeat": "heartbeat 1.5s var(--ease-in-out) infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeOut: { from: { opacity: 1 }, to: { opacity: 0 } },
        slideUp: { from: { opacity: 0, transform: "translateY(20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideDown: { from: { opacity: 0, transform: "translateY(-20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideLeft: { from: { opacity: 0, transform: "translateX(20px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        slideRight: { from: { opacity: 0, transform: "translateX(-20px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        scaleIn: { from: { opacity: 0, transform: "scale(0.95)" }, to: { opacity: 1, transform: "scale(1)" } },
        scaleOut: { from: { opacity: 1, transform: "scale(1)" }, to: { opacity: 0, transform: "scale(0.95)" } },
        expandIn: { from: { opacity: 0, transform: "scale(0.5)" }, to: { opacity: 1, transform: "scale(1)" } },
        bounce: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shake: { "0%, 100%": { transform: "translateX(0)" }, "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" }, "20%, 40%, 60%, 80%": { transform: "translateX(4px)" } },
        wiggle: { "0%, 100%": { transform: "rotate(0deg)" }, "25%": { transform: "rotate(-3deg)" }, "75%": { transform: "rotate(3deg)" } },
        heartbeat: { "0%, 100%": { transform: "scale(1)" }, "14%": { transform: "scale(1.1)" }, "28%": { transform: "scale(1)" }, "42%": { transform: "scale(1.1)" }, "70%": { transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};
