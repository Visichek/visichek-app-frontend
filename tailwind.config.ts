import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],          // Moderat Serif
        sans: ["var(--font-sans)", "system-ui", "Arial", "Helvetica", "sans-serif"], // TWK Lausanne
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],        // SF Mono
        handwritten: ["var(--font-handwritten)", "cursive"],            // Rock Salt
      },
      spacing: {
        "space-1": "4px",
        "space-2": "8px",
        "space-3": "12px",
        "space-4": "16px",
        "space-5": "20px",
        "space-6": "24px",
        "space-7": "28px",
        "space-8": "32px",
        "space-9": "36px",
        "space-10": "40px",
        "space-11": "44px",
        "space-12": "48px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      zIndex: {
        base: "1",
        sticky: "20",
        dropdown: "40",
        drawer: "50",
        modal: "60",
        popup: "65", // Select/Popover/Combobox portals that must float above modals
        toast: "70",
      },
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        brand: {
          200: "hsl(var(--brand-200))",
          500: "hsl(var(--brand-500))",
          600: "hsl(var(--brand-600))",
        },
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.16, 1, 0.3, 1)",  // website nav resize / reveal
        snap: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        button: "180ms",  // website button 150-200ms
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
        "bell-pop": {
          "0%": { transform: "translateY(0) rotate(0deg)" },
          "30%": { transform: "translateY(-5px) rotate(-6deg)" },
          "70%": { transform: "translateY(1px) rotate(5deg)" },
          "100%": { transform: "translateY(0) rotate(0deg)" },
        },
        "bell-pulse": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        "badge-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "icon-swap-in": {
          "0%": { transform: "rotate(-30deg) scale(0.9)", opacity: "0" },
          "100%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
        },
        "padlock-shake": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "10%": { transform: "translateX(-1.5px) rotate(-6deg)" },
          "20%": { transform: "translateX(2px) rotate(6deg)" },
          "30%": { transform: "translateX(-2px) rotate(-5deg)" },
          "40%": { transform: "translateX(2px) rotate(5deg)" },
          "50%": { transform: "translateX(-1.5px) rotate(-3deg)" },
          "60%": { transform: "translateX(1.5px) rotate(3deg)" },
          "70%": { transform: "translateX(-1px) rotate(-2deg)" },
          "80%": { transform: "translateX(1px) rotate(2deg)" },
          "90%": { transform: "translateX(-0.5px) rotate(-1deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "bell-pop": "bell-pop 0.42s ease-out",
        "bell-pulse": "bell-pulse 0.3s ease-out",
        "badge-pop": "badge-pop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "icon-swap-in": "icon-swap-in 0.2s ease-out",
        "padlock-shake": "padlock-shake 0.55s cubic-bezier(.36,.07,.19,.97) both",
        "padlock-shake-loop": "padlock-shake 1.6s cubic-bezier(.36,.07,.19,.97) infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
