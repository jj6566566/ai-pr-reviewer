/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        surface: {
          primary: "#0a0e1a",
          secondary: "#0f1324",
          tertiary: "#131829",
          hover: "#1a2140",
        },
        edge: {
          DEFAULT: "#1e2440",
          hover: "#2d3560",
        },
        content: {
          primary: "#e4e8f1",
          secondary: "#7b829c",
          muted: "#585e74",
        },
        accent: {
          DEFAULT: "#06d6a0",
          muted: "rgba(6, 214, 160, 0.1)",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "rgba(239, 68, 68, 0.1)",
        },
      },
    },
  },
  plugins: [],
};
