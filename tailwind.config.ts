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
        "center-pause": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.6)" },
          "20%": { opacity: "1", transform: "translate(-50%, -50%) scale(1.15)" },
          "35%": { transform: "translate(-50%, -50%) scale(1)" },
          "75%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(1)" },
        },
        // Ícone de play virado ao contrário (scaleX(-1), mantido em TODOS os
        // passos — senão desmirrorava a meio da animação): cai de 30º até
        // ficar reto (0º), passa por baixo até -15º, e sobe de novo os
        // mesmos 15º até assentar reto — efeito de balanço/pêndulo a
        // assentar, não um simples fade.
        "center-play": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scaleX(-1) rotate(30deg)" },
          "12%": { opacity: "1" },
          "45%": { transform: "translate(-50%, -50%) scaleX(-1) rotate(0deg)" },
          "70%": { transform: "translate(-50%, -50%) scaleX(-1) rotate(-15deg)" },
          "90%": { opacity: "1", transform: "translate(-50%, -50%) scaleX(-1) rotate(0deg)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scaleX(-1) rotate(0deg)" },
        },
      },
      animation: {
        "like-pop": "like-pop 800ms ease-out forwards",
        "seek-flash": "seek-flash 500ms ease-out forwards",
        "corner-card-in": "corner-card-in 220ms ease-out",
        "center-pause": "center-pause 700ms ease-out forwards",
        "center-play": "center-play 1000ms ease-in-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
