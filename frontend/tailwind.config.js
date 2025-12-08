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
        // Inter - Modern, clean typography for everything
        sans: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
      },

      // Glass Morphism Colors
      colors: {
        // Primary - iOS Blue
        primary: {
          DEFAULT: "hsl(217, 91%, 60%)",
          50: "hsl(217, 91%, 97%)",
          100: "hsl(217, 91%, 95%)",
          200: "hsl(217, 91%, 85%)",
          300: "hsl(217, 91%, 75%)",
          400: "hsl(217, 91%, 65%)",
          500: "hsl(217, 91%, 60%)",
          600: "hsl(217, 91%, 50%)",
          700: "hsl(217, 91%, 40%)",
          800: "hsl(217, 91%, 30%)",
          900: "hsl(217, 91%, 20%)",
        },
        // Accent - Pink/Magenta
        accent: {
          DEFAULT: "hsl(330, 81%, 60%)",
          50: "hsl(330, 81%, 97%)",
          100: "hsl(330, 81%, 95%)",
          200: "hsl(330, 81%, 85%)",
          300: "hsl(330, 81%, 75%)",
          400: "hsl(330, 81%, 65%)",
          500: "hsl(330, 81%, 60%)",
          600: "hsl(330, 81%, 50%)",
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

      // Larger border radius for Glass style
      borderRadius: {
        DEFAULT: "12px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
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
