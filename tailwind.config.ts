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
        "seek-flash": {
          "0%": { opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "corner-card-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "center-pop": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.6)" },
          "20%": { opacity: "1", transform: "translate(-50%, -50%) scale(1.15)" },
          "35%": { transform: "translate(-50%, -50%) scale(1)" },
          "75%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(1)" },
        },
        // Ícone de like: cai de 30º até ficar reto (0º), passa por baixo até
        // -15º, e sobe de novo até assentar reto — efeito de balanço/pêndulo.
        // Cada troço tem a SUA
        // própria curva (não a mesma ease-in-out repetida em cada troço, que
        // ficava com um travão-e-arranca mecânico em cada paragem
        // intermédia): sai a acelerar (ease-out), cai a acelerar por baixo
        // do ponto de repouso (ease-in), volta a assentar a desacelerar
        // (ease-out) — só assim fica um movimento contínuo, não aos
        // solavancos.
        // Scale-pop tipo Instagram/TikTok — entra nivelado e já visível
        // (0-20%, sem rotação nenhuma), só DEPOIS sobe até ao pico e volta a
        // assentar nivelado. Rotação só começa quando já dá pra ver o
        // ícone parado, senão o 1º frame visível já vinha inclinado.
        "like-pop": {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, -50%) scale(0.3) rotate(0deg)",
            animationTimingFunction: "ease-out",
          },
          "20%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1.4) rotate(0deg)",
            animationTimingFunction: "ease-in",
          },
          "35%": {
            transform: "translate(-50%, -50%) scale(0.85) rotate(-8deg)",
            animationTimingFunction: "ease-out",
          },
          "50%": {
            transform: "translate(-50%, -50%) scale(1.15) rotate(-14deg)",
            animationTimingFunction: "ease-in",
          },
          "63%": {
            transform: "translate(-50%, -50%) scale(0.95) rotate(-6deg)",
            animationTimingFunction: "ease-out",
          },
          "75%": {
            transform: "translate(-50%, -50%) scale(1.05) rotate(2deg)",
            animationTimingFunction: "ease-in",
          },
          "87%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1) rotate(0deg)",
            animationTimingFunction: "ease-out",
          },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(1) rotate(0deg)" },
        },
      },
      animation: {
        "seek-flash": "seek-flash 500ms ease-out forwards",
        "corner-card-in": "corner-card-in 220ms ease-out",
        "center-pop": "center-pop 700ms ease-out forwards",
        "like-pop": "like-pop 700ms linear forwards",
      },
    },
  },
  plugins: [],
};
export default config;
