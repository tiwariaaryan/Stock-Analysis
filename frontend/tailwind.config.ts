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
          primary: "#0d0d14",
          card: "#151520",
          hover: "#1c1c2e",
          input: "#111118",
        },
        border: {
          DEFAULT: "#1f1f32",
          hover: "#2d2d48",
          accent: "#5b3acd",
        },
        accent: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
          dark: "#5b21b6",
          muted: "rgba(124, 58, 237, 0.15)",
        },
        gain: {
          DEFAULT: "#00c853",
          bg: "rgba(0, 200, 83, 0.1)",
        },
        loss: {
          DEFAULT: "#ff5252",
          bg: "rgba(255, 82, 82, 0.1)",
        },
        txt: {
          primary: "#ffffff",
          secondary: "#94a3b8",
          muted: "#4a5568",
          dim: "#334155",
        },
      },
      fontFamily: {
        mono: ["SF Mono", "Menlo", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
