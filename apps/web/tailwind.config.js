/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Custom Font Families
      fontFamily: {
        display: ["var(--font-display)", "Crimson Pro", "Georgia", "serif"],
        body: ["var(--font-body)", "Source Sans 3", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "Source Sans 3", "system-ui", "sans-serif"],
      },
      // Extended Color Palette
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Craft Heritage Extended Palette
        copper: {
          DEFAULT: "hsl(var(--copper))",
          50: "#fdf6ed",
          100: "#f9e8d1",
          200: "#f2cda0",
          300: "#ebac66",
          400: "#e58f3b",
          500: "#b87333",
          600: "#9a5a28",
          700: "#7d4423",
          800: "#673822",
          900: "#56301f",
        },
        oak: {
          DEFAULT: "hsl(var(--oak))",
          50: "#f9f6f3",
          100: "#f0e9e1",
          200: "#e0d2c2",
          300: "#cdb59c",
          400: "#b89474",
          500: "#a87c5a",
          600: "#9a6b4e",
          700: "#805642",
          800: "#6a483a",
          900: "#583d32",
        },
        orchard: {
          DEFAULT: "hsl(var(--orchard))",
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#3d8b5a",
          600: "#2d7247",
          700: "#255d3a",
          800: "#224c32",
          900: "#1f3f2b",
        },
        barrel: "hsl(var(--barrel))",
        cream: "hsl(var(--cream))",
        parchment: "hsl(var(--parchment))",
        // Semantic colors for status
        fermenting: {
          DEFAULT: "#d97706",
          light: "#fef3c7",
          dark: "#92400e",
        },
        aging: {
          DEFAULT: "#ea580c",
          light: "#ffedd5",
          dark: "#9a3412",
        },
        ready: {
          DEFAULT: "#059669",
          light: "#d1fae5",
          dark: "#065f46",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      // Enhanced Shadows
      boxShadow: {
        "craft": "0 1px 2px rgba(139, 90, 43, 0.04), 0 4px 12px rgba(139, 90, 43, 0.06)",
        "craft-md": "0 2px 4px rgba(139, 90, 43, 0.06), 0 8px 24px rgba(139, 90, 43, 0.1)",
        "craft-lg": "0 4px 8px rgba(139, 90, 43, 0.08), 0 16px 40px rgba(139, 90, 43, 0.12)",
        "warm": "0 4px 14px 0 rgba(139, 90, 43, 0.1)",
        "warm-lg": "0 10px 40px 0 rgba(139, 90, 43, 0.15)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(217, 119, 6, 0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(217, 119, 6, 0.15)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-in-up": "fade-in-up 0.4s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
      },
      // Spacing and sizing
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      // Typography scale
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      // Backdrop blur
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
