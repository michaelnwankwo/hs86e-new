import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0B0E14",
          raised: "#161B22",
          overlay: "#1C232D",
          glass: "rgba(22, 27, 34, 0.82)",
        },
        ink: {
          DEFAULT: "#F8FAFC",
          muted: "#94A3B8",
          dim: "#64748B",
        },
        emerald: {
          DEFAULT: "#043927",
          mid: "#0A5C3E",
          bright: "#0E7A52",
          glow: "rgba(4, 57, 39, 0.55)",
        },
        gold: {
          DEFAULT: "#DFB260",
          metallic: "#D4AF37",
          champagne: "#F5D68D",
          border: "rgba(223, 178, 96, 0.20)",
          glow: "rgba(223, 178, 96, 0.15)",
        },
        danger: {
          DEFAULT: "#8B2E2A",
          bright: "#C4453C",
        },
        amber: {
          DEFAULT: "#9A7228",
          bright: "#E0B14A",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(223, 178, 96, 0.20), 0 18px 50px rgba(0, 0, 0, 0.45)",
        glow: "0 0 80px rgba(223, 178, 96, 0.15)",
        emerald: "0 10px 30px rgba(4, 57, 39, 0.45)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(ellipse 70% 50% at 50% 28%, rgba(223, 178, 96, 0.15), transparent 62%)",
        "field-vignette":
          "radial-gradient(ellipse at center, #161B22 0%, #0B0E14 72%)",
      },
      animation: {
        "pulse-glow": "pulseGlow 2.8s ease-in-out infinite",
        "flash-in": "flashIn 300ms ease-out",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.12" },
          "50%": { opacity: "0.28" },
        },
        flashIn: {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
