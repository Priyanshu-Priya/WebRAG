/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class", // Enables class-based dark mode
  theme: {
    extend: {
      colors: {
        // Deep modern palette
        brand: {
          50: "#f0f4ff",
          100: "#d9e2ff",
          200: "#b8c9ff",
          300: "#8ca6ff",
          400: "#5975ff",
          500: "#3249f6",
          600: "#212cdb",
          700: "#1a21b4",
          800: "#191d92",
          900: "#181d75",
          950: "#0e0f45",
        },
        dark: {
          50: "#f6f6f7",
          100: "#ebeeef",
          200: "#d4dade",
          300: "#afbac1",
          400: "#80929c",
          500: "#627580",
          600: "#4f5f69",
          700: "#414e56",
          800: "#2d353a",
          900: "#1e2225",
          950: "#0d0f11", // Sleek black/gray background
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }
    },
  },
  plugins: [],
}
