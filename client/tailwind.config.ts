import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
      colors: {
        // Sampled from public/images/rophe-logo.png:
        //   brand-600 #485889 — the "ROPHE" wordmark navy (exact)
        //   brand-400 #7c8cbb — the stethoscope ring
        //   clinic-red-500 #e8171e — the cross / "SPECIALIST CARE"
        // Red is reserved for the logo and small accents; it never becomes a
        // primary action colour, since red reads as destructive in a UI.
        brand: {
          // The light end carries extra saturation on purpose: at these
          // lightness levels a low-chroma blue is indistinguishable from
          // slate (brand-100 vs slate-100 measured 1.08:1 before this), so
          // tints read as "greyed out" rather than "brand".
          50: "#f2f5fd",
          100: "#e1e7f9",
          200: "#c1cdf0",
          300: "#9aabdf",
          400: "#7c8cbb",
          500: "#586ca7",
          600: "#485889",
          700: "#384670",
          800: "#2b375a",
          900: "#202946",
          950: "#131a2f",
        },
        "clinic-red": {
          50: "#fef1f1",
          100: "#fde3e4",
          500: "#e8171e",
          600: "#c31d23",
          700: "#9c1c20",
        },
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(-150px, 200px)" },
          "66%": { transform: "translate(200px, -150px)" },
        },
        "float-alt": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "33%": { transform: "translate(200px, -200px)" },
          "66%": { transform: "translate(-150px, 150px)" },
        },
      },
      animation: {
        float: "float 20s ease-in-out infinite",
        "float-alt": "float-alt 25s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;