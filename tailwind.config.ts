import type { Config } from "tailwindcss";

/**
 * Portfolio Atlas design tokens.
 * Colours, radii and spacing are defined here so utilities and the component
 * layer share one source of truth. CSS variables in globals.css mirror these
 * for runtime theming (e.g. per-domain accent).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rail: "rgb(var(--rail) / <alpha-value>)",
        nav: "rgb(var(--nav) / <alpha-value>)",
        "rail-selected": "rgb(var(--rail-selected) / <alpha-value>)",
        workspace: "rgb(var(--workspace) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        purple: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
        },
        accent: {
          mortgage: "#7137F5",
          bus: "#F36A21",
          pet: "#08A3AA",
        },
        success: "#388664",
        warning: "#F2B544",
        critical: "#bc4d5c",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "10px",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["12px", { lineHeight: "18px" }],
      },
      boxShadow: {
        card: "0 0 0 2px rgb(128 128 128 / 0.025), 0 1px 2px rgb(0 0 0 / 0.025)",
        drawer: "-8px 0 24px rgba(7, 18, 38, 0.16)",
        pop: "0 8px 24px rgba(7, 18, 38, 0.14)",
      },
      transitionTimingFunction: {
        atlas: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
