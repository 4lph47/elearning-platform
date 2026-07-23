"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePageAccent } from "@/components/layout/PageAccentContext";

interface AccentColors {
  top: string;
  mid: string;
}

// Tailwind blue-600 / indigo-600 em rgb — usado enquanto a foto não carrega
// (ou não tem foto/CORS falha) para o gradiente nunca ficar sem cor.
const DEFAULT_ACCENT: AccentColors = { top: "37, 99, 235", mid: "79, 70, 229" };

const InstructorAccentContext = createContext<AccentColors>(DEFAULT_ACCENT);

// Amostra a foto de perfil do instrutor (topo/meio) para o gradiente do
// hero E a borda do searchbar dos cursos partilharem as mesmas cores —
// contexto em vez de prop drilling porque estão em blocos irmãos separados
// na página (hero acima, grelha de cursos abaixo). Mesma técnica de amostrar
// pixels via canvas do lib/useAmbientColor.ts, mas para uma imagem estática
// (uma vez, não por frame de vídeo).
export function InstructorAccentProvider({ imageUrl, children }: { imageUrl: string | null; children: ReactNode }) {
  const [accent, setAccent] = useState<AccentColors>(DEFAULT_ACCENT);
  const { setAccent: setPageAccent } = usePageAccent();

  // Header também fica com o gradiente do instrutor, mesmo antes de rolar a
  // página (a navbar já é transparente nessa altura) — propaga pro contexto
  // global que o Navbar lê. Limpa ao sair da página para não vazar a cor
  // deste instrutor para as páginas seguintes.
  useEffect(() => {
    setPageAccent(accent);
    return () => setPageAccent(null);
  }, [accent, setPageAccent]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const avg = (y0: number, y1: number) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = 0; x < size; x++) {
              const i = (y * size + x) * 4;
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              n++;
            }
          }
          return `${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}`;
        };
        setAccent({ top: avg(0, 8), mid: avg(10, 18) });
      } catch {
        // origem da imagem sem CORS habilitado — canvas fica tainted, mantém o accent por defeito
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  return <InstructorAccentContext.Provider value={accent}>{children}</InstructorAccentContext.Provider>;
}

export function useInstructorAccent() {
  return useContext(InstructorAccentContext);
}
