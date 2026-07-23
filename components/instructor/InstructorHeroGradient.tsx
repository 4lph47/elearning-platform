"use client";

import type { ReactNode } from "react";
import { useInstructorAccent } from "@/components/instructor/InstructorAccentContext";

// "to transparent" (não to-white/to-black fixo): o próprio fundo da página
// por trás (bg-white dark:bg-black no wrapper do topo) já resolve a cor
// certa em cada tema — o gradiente em si é sempre igual (vem da foto), só o
// que aparece depois dele é que muda com o tema.
//
// Último stop é `rgba(mid, 0)`, NÃO a keyword `transparent` (que é
// rgba(0,0,0,0) — preto a 0 de alfa). Interpolar de uma cor opaca até preto
// transparente escurece o meio do desvanecimento, lendo como uma linha/faixa
// visível mesmo antes da opacidade chegar a 0. Manter o MESMO tom até ao
// fim, só a variar o alfa, funde sem essa faixa.
export function InstructorHeroGradient({ children }: { children: ReactNode }) {
  const { top, mid } = useInstructorAccent();

  return (
    // -mt-16: desliza por baixo do header fixed (mesmo truque do hero da
    // home/página de curso) para o header ficar mesmo por cima do
    // gradiente — só assim o overlay semi-transparente do header deixa
    // este gradiente aparecer "através" dele. Padding-top ganha os 64px do
    // header de volta, senão o avatar ficava escondido atrás dele.
    <div
      className="-mt-16 pb-10 pt-[7.5rem] transition-[background-image] duration-700 sm:pt-36"
      style={{ backgroundImage: `linear-gradient(to bottom, rgb(${top}) 0%, rgb(${mid}) 55%, rgba(${mid}, 0) 100%)` }}
    >
      {children}
    </div>
  );
}
