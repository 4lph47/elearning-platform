"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

// Container fixo, canto inferior esquerdo — usado pro banner de rascunho
// restaurado e pro aviso de campos em falta ao guardar/publicar (curso e
// aula). Um só container por ecrã, os cards lá dentro empilham com gap.
export function CornerCardStack({ children }: { children: ReactNode }) {
  return <div className="fixed bottom-4 left-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">{children}</div>;
}

// Cores neutras de propósito (cinzentos só, sem azul/vermelho no card em si
// — o card muda com o tema, claro/escuro) — mesmo pra avisos, pra não competir
// visualmente com o resto da UI.
export function CornerCard({ children }: { children: ReactNode }) {
  return (
    <div className="animate-corner-card-in rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-white/10 dark:bg-neutral-900">
      {children}
    </div>
  );
}

// Ação secundária dum par (ex.: "Descartar") — só contorno, sem preenchimento.
export function CornerCardButtonNeutral({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/5 ${className}`}
    />
  );
}

// Ação primária dum par (ex.: "Continuar") — única cor viva do card, de
// propósito, pra puxar o olho pra ação recomendada.
export function CornerCardButtonPrimary({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 ${className}`}
    />
  );
}
