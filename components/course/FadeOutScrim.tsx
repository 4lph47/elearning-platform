"use client";

import { useCardTransition } from "@/components/course/CardTransitionContext";

const TO_DIM_MS = 300; // 100% -> 80% (rápido, logo ao clicar)
const TO_HIDDEN_MS = 1000; // 80% -> tapa tudo, coincide com o clone a assumir o card
const REVEAL_MS = 700; // wipe de cima para baixo ao mostrar a página seguinte
const DIM_OPACITY = 0.2; // scrim a 20% opaco = conteúdo por baixo a ~80% visível

// Este scrim (não o <main>) é quem esconde e revela tudo — por nunca tocar na
// opacidade do <main>, o card selecionado consegue escapar-lhe só com z-index
// (CourseTile.tsx), sem ficar preso num stacking context de um ancestral opaco.
export function FadeOutScrim() {
  const { state } = useCardTransition();
  if (!state) return null;

  const opacity = state.revealed ? 0 : state.arrived ? 1 : state.hidden ? DIM_OPACITY : 0;
  const clipPath = state.revealed ? "inset(100% 0 0 0)" : "inset(0 0 0 0)";
  const durationMs = state.revealed ? REVEAL_MS : state.arrived ? TO_HIDDEN_MS : TO_DIM_MS;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[900] bg-white dark:bg-black"
      style={{ opacity, clipPath, transition: `opacity ${durationMs}ms ease-out, clip-path ${durationMs}ms ease-out` }}
    />
  );
}
