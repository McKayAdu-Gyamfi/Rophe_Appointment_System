import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// ---------------------------------------------------------------------------
// Design system.
//
// Palette, spacing and shape are taken from the Medlink admin-dashboard
// reference design (Figma "01. Dashboard - Desktop"). The reference file is a
// flattened export with no published variables, so these values were sampled
// off the 2880x3092 render rather than read from Figma tokens.
//
// `teal`, `slate` and `rose` deliberately OVERRIDE Tailwind's defaults instead
// of living under new names. Every screen in the app was already written
// against those scales, so overriding re-skins the whole product from one
// place — no sweep through fifteen page files, and no drift between screens
// that were updated and screens that weren't.
//
// Where the reference's own text-on-tint pairs measure 2.1-2.8:1 (its teal and
// pink pills), the hue is kept but the text step is darkened to clear 4.5:1.
// The look survives; the contrast failure doesn't.
// ---------------------------------------------------------------------------

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // lib/status-styles.ts is where every badge and dot class in the app is
    // written. Without this glob Tailwind never sees them, and a class only
    // survives if some component happens to spell it out too — which is why
    // the teal and rose pills rendered while the channel and delivery ones
    // silently came out unstyled.
    "./src/lib/**/*.{js,ts}",
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
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Accent. 600 (#479aa8) is the reference's primary — active nav, the
        // selected calendar day, chart series 1. 700 is the same hue pushed
        // dark enough to carry white text at 4.7:1; 800 is the badge-text step.
        // 900 (#1f4a51) is the reference's "ink": headline numerals and the
        // dark series in every chart.
        teal: {
          50: "#f3f9fa",
          100: "#def1ef",
          200: "#c2e3e6",
          300: "#98cdd5",
          400: "#7fbcc7",
          500: "#5aa6b3",
          600: "#479aa8",
          700: "#3a7d89",
          800: "#326770",
          900: "#1f4a51",
          950: "#143238",
        },
        // Neutral. Near-achromatic on purpose: the reference's greys carry no
        // blue cast, which is most of why its whitespace reads as calm rather
        // than cold. Tailwind's stock slate is noticeably blue by comparison.
        slate: {
          50: "#fafafb",
          100: "#f5f5f7",
          200: "#e2e2e4",
          300: "#cdcdd1",
          400: "#a1a1a8",
          500: "#76767d",
          600: "#5c5c63",
          700: "#45454b",
          800: "#303035",
          900: "#222222",
          950: "#141416",
        },
        // Danger. Soft coral rather than a fire-alarm red, so a cancelled or
        // missed visit reads as information and not as an error state.
        rose: {
          50: "#fff5f6",
          100: "#ffdfe4",
          200: "#ffc4cc",
          300: "#ff9dad",
          400: "#fb7186",
          500: "#ef4e67",
          600: "#d93753",
          700: "#b62943",
          800: "#942438",
          900: "#7c2333",
        },
        // Sampled from public/images/rophe-logo.png:
        //   brand-600 #485889 — the "ROPHE" wordmark navy (exact)
        //   brand-400 #7c8cbb — the stethoscope ring
        //   clinic-red-500 #e8171e — the cross / "SPECIALIST CARE"
        // Retained for the logo lockup and the login screen. The product
        // chrome runs on the accent scale above; red is never an action colour.
        brand: {
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
        // Panels in the reference are 16px; the surface that wraps them is 20px.
        panel: "1rem",
        surface: "1.25rem",
      },
      boxShadow: {
        // The reference has no card borders and no drop shadows — cards are
        // separated from the surface by value alone (white on #f5f5f7). This
        // is kept for the few things that genuinely float: menus and popovers.
        pop: "0 12px 32px -12px rgb(31 74 81 / 0.22), 0 2px 6px -2px rgb(31 74 81 / 0.1)",
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
