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
        // Ícone de like virado ao contrário (scaleX(-1), mantido em TODOS os
        // passos — senão desmirrorava a meio da animação): cai de 30º até
        // ficar reto (0º), passa por baixo até -15º, e sobe de novo até
        // assentar reto — efeito de balanço/pêndulo. Cada troço tem a SUA
        // própria curva (não a mesma ease-in-out repetida em cada troço, que
        // ficava com um travão-e-arranca mecânico em cada paragem
        // intermédia): sai a acelerar (ease-out), cai a acelerar por baixo
        // do ponto de repouso (ease-in), volta a assentar a desacelerar
        // (ease-out) — só assim fica um movimento contínuo, não aos
        // solavancos.
        "like-swing": {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, -50%) scaleX(-1) rotate(30deg)",
            animationTimingFunction: "ease-out",
          },
          "40%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scaleX(-1) rotate(0deg)",
            animationTimingFunction: "ease-in",
          },
          "65%": {
            opacity: "1",
            transform: "translate(-50%, -50%) scaleX(-1) rotate(-15deg)",
            animationTimingFunction: "ease-out",
          },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scaleX(-1) rotate(0deg)" },
        },
      },
      animation: {
        "seek-flash": "seek-flash 500ms ease-out forwards",
        "corner-card-in": "corner-card-in 220ms ease-out",
        "center-pop": "center-pop 700ms ease-out forwards",
        "like-swing": "like-swing 1000ms linear forwards",
      },
    },
  },
  plugins: [],
};
export default config;
