import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Inspired by Agadir: Atlantic ocean, sand dunes, terracotta walls, palm green
        sand: {
          50: "#FBF7F1",
          100: "#F5EDDD",
          200: "#EAD9B7",
          300: "#DBBE85",
          400: "#C99F58",
          500: "#B88239",
          600: "#9C6829",
          700: "#7C5022",
          800: "#5A3A1A",
          900: "#3D2812",
        },
        terracotta: {
          50: "#FDF4EE",
          100: "#FAE5D3",
          200: "#F4C7A4",
          300: "#ECA06C",
          400: "#E27842",
          500: "#D85A24",
          600: "#C2410C",
          700: "#A03309",
          800: "#7E290B",
          900: "#65240D",
        },
        atlantic: {
          50: "#EFF8FC",
          100: "#DAEEF6",
          200: "#B6DDEE",
          300: "#82C2E0",
          400: "#48A2CD",
          500: "#2986B6",
          600: "#1A6A99",
          700: "#15547B",
          800: "#134866",
          900: "#0F3A53",
        },
        navy: {
          50: "#EFECF7",
          100: "#D5CDE8",
          200: "#A99BC8",
          300: "#7C68A6",
          400: "#553F84",
          500: "#3A2962",
          600: "#291F52",
          700: "#1E1640",
          800: "#140E2E",
          900: "#0A071C",
        },
        ink: "#1C1917",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
