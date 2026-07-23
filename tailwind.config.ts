import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        "like-pop": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.5)" },
          "25%": { opacity: "1", transform: "translate(-50%, -50%) scale(1.15)" },
          "40%": { transform: "translate(-50%, -50%) scale(1)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(1)" },
        },
        "seek-flash": {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "corner-card-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "like-pop": "like-pop 800ms ease-out forwards",
        "seek-flash": "seek-flash 500ms ease-out forwards",
        "corner-card-in": "corner-card-in 220ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
