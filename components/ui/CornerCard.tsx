"use client";

import type { ReactNode } from "react";

// Container fixo, canto inferior esquerdo — usado pro banner de rascunho
// restaurado e pro aviso de campos em falta ao guardar/publicar (curso e
// aula). Um só container por ecrã, os cards lá dentro empilham com gap.
export function CornerCardStack({ children }: { children: ReactNode }) {
  return <div className="fixed bottom-4 left-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">{children}</div>;
}

// Cores neutras de propósito (cinzentos só, sem azul/vermelho) — mesmo pra
// avisos, pra não competir visualmente com o resto da UI.
export function CornerCard({ children }: { children: ReactNode }) {
  return (
    <div className="animate-corner-card-in rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-white/10 dark:bg-neutral-900">
      {children}
    </div>
  );
}
