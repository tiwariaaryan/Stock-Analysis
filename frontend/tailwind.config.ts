/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0B0F19",       // Deep Institutional Midnight Navy
          card: "#0E1524",          // Crisp elevated Midnight Blue Card
          hover: "#172138",         // Inset / Hover Slate-Navy
          input: "#121A2D",         // High-contrast Input container
          elevated: "#172138",
        },
        border: {
          DEFAULT: "#1F293D",       // Visible high-contrast border
          hover: "#38BDF8",         // Glowing cyan hover border
          accent: "#6366F1",        // Indigo accent
          glow: "rgba(56, 189, 248, 0.4)",
        },
        accent: {
          DEFAULT: "#6366F1",       // Electric Indigo
          light: "#38BDF8",         // Cyan light
          dark: "#4F46E5",
          muted: "rgba(99, 102, 241, 0.2)",
          cyan: "#38BDF8",
        },
        gain: {
          DEFAULT: "#10B981",       // Vivid Emerald Green
          bg: "rgba(16, 185, 129, 0.15)",
        },
        loss: {
          DEFAULT: "#F87171",       // Vivid Coral Red
          bg: "rgba(248, 113, 113, 0.15)",
        },
        txt: {
          primary: "#FFFFFF",       // Ultra-bright pure white
          secondary: "#E2E8F0",     // Crisp Slate-200 (11:1 contrast)
          muted: "#94A3B8",         // High-contrast Slate-400 (6.5:1 contrast)
          dim: "#7DD3FC",           // Light sky-slate / cyan hint for readable metadata
          label: "#CBD5E1",
        },
      },
      fontFamily: {
        mono: ["SF Mono", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
