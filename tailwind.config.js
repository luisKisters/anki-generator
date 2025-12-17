/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: "#002439",
          light: "#005066",
        },
        surface: {
          DEFAULT: "#005066",
          light: "#4e7988",
        },
        primary: {
          DEFAULT: "#78cce2",
          bright: "#e4eff0",
          glow: "rgba(120, 204, 226, 0.4)",
        },
        accent: {
          DEFAULT: "#78cce2",
          glow: "rgba(120, 204, 226, 0.3)",
        },
        text: {
          DEFAULT: "#e4eff0",
          muted: "#4e7988",
          dim: "#005066",
        },
        border: {
          DEFAULT: "rgba(78, 121, 136, 0.5)",
          bright: "rgba(120, 204, 226, 0.6)",
        },
      },
      fontFamily: {
        display: ["Rajdhani", "sans-serif"],
        mono: ["Share Tech Mono", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        scan: "scan 1.5s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 4px currentColor", opacity: "1" },
          "50%": { boxShadow: "0 0 12px currentColor", opacity: "0.7" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      boxShadow: {
        "glow-primary": "0 0 20px rgba(120, 204, 226, 0.4)",
      },
    },
  },
  plugins: [],
};
