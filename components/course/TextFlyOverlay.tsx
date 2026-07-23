"use client";

import { useEffect, useState } from "react";
import { useTextFly } from "@/components/course/TextFlyContext";

const FLY_MS = 400;
const FALLBACK_MS = 4000;

// Título real na página de destino (LessonTitleHeading.tsx) fica escondido
// até "revealed" — este componente é quem decide esse momento, FLY_MS depois
// de arrive() (quando o clone termina mesmo de aterrar), nunca antes.
export function TextFlyOverlay() {
  const { state, reveal, finish } = useTextFly();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!state || state.arrived) return;
    const giveUp = setTimeout(() => finish(), FALLBACK_MS);
    return () => clearTimeout(giveUp);
  }, [state, finish]);

  useEffect(() => {
    setAnimate(false);
    if (!state?.arrived) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    const revealTimer = setTimeout(() => reveal(), FLY_MS);
    const finishTimer = setTimeout(() => finish(), FLY_MS + 150);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(revealTimer);
      clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.arrived]);

  if (!state) return null;
  const box = animate ? state.targetBox : state.sourceBox;

  return (
    <div
      className="pointer-events-none fixed z-[997] overflow-hidden"
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        fontSize: box.fontSize,
        lineHeight: `${box.lineHeight}px`,
        // Peso real do elemento medido (não uma classe font-bold adivinhada)
        // — negrito é mais largo que normal, cortava a última letra se o
        // clone usasse um peso mais pesado do que a largura capturada previa.
        fontWeight: box.fontWeight,
        color: box.color,
        // nowrap só antes de aterrar (origem é sempre 1 linha); o <h1> real
        // de destino quebra linha se o título for longo — a caixa de alvo já
        // tem a altura para isso, deixar quebrar aqui também, senão o texto
        // fica espremido numa linha só, mais largo do que a caixa permite.
        whiteSpace: animate ? "normal" : "nowrap",
        opacity: state.revealed ? 0 : 1,
        // width fora do "all": animar a largura com texto a quebrar linha faz
        // o nº de linhas mudar a meio da transição (só estabiliza mesmo no
        // valor final) — visível como um glitch perto do fim. width assume já
        // o valor final assim que anima, sem transição própria; o resto
        // (posição/altura/tamanho de letra) continua suave.
        transition: `top ${FLY_MS}ms ease-out, left ${FLY_MS}ms ease-out, height ${FLY_MS}ms ease-out, font-size ${FLY_MS}ms ease-out, opacity 150ms ease-out`,
      }}
    >
      {state.text}
    </div>
  );
}
