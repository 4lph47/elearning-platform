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

export interface CornerCardIssue {
  message: string;
  field?: string;
}

const FIELD_HIGHLIGHT_CLASSES = ["ring-2", "ring-red-500", "ring-offset-2", "dark:ring-offset-neutral-900", "rounded-md"];
const FIELD_HIGHLIGHT_MS = 2500;
let fieldHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
let fieldHighlightEl: HTMLElement | null = null;

function clearFieldHighlight() {
  if (fieldHighlightEl) fieldHighlightEl.classList.remove(...FIELD_HIGHLIGHT_CLASSES);
  fieldHighlightEl = null;
  if (fieldHighlightTimeout) {
    clearTimeout(fieldHighlightTimeout);
    fieldHighlightTimeout = null;
  }
}

function revealAndHighlight(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.focus({ preventScroll: true });
  }
  el.classList.add(...FIELD_HIGHLIGHT_CLASSES);
  fieldHighlightEl = el;
  fieldHighlightTimeout = setTimeout(clearFieldHighlight, FIELD_HIGHLIGHT_MS);
}

// Chamado ao clicar num item da lista de "Falta preencher" — leva o campo em
// causa pro centro do ecrã, foca-o e desenha um contorno vermelho à volta
// por uns segundos, pra ser óbvio qual campo é mesmo sem depender só do
// focus (nem todo o alvo é um input focável, ex.: o card do upload de vídeo).
// Se o campo estiver dentro dum CollapsibleCard fechado (ver
// components/ui/CollapsibleCard.tsx — conteúdo fica montado mas escondido),
// expande-o primeiro e só salta depois de o layout assentar.
export function focusField(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  clearFieldHighlight();
  const toggle = el
    .closest("[data-collapsible-root]")
    ?.querySelector('[data-collapsible-toggle][aria-expanded="false"]');
  if (toggle instanceof HTMLElement) {
    toggle.click();
    requestAnimationFrame(() => requestAnimationFrame(() => revealAndHighlight(el)));
  } else {
    revealAndHighlight(el);
  }
}

// Lista usada dentro do CornerCard "Falta preencher" — cada item vira botão
// clicável quando vem com o campo associado (ver focusField acima); sem
// campo (ex.: erro genérico do servidor), fica só texto.
export function CornerCardIssueList({
  issues,
  onIssueClick,
}: {
  issues: (string | CornerCardIssue)[];
  onIssueClick?: (field: string) => void;
}) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-300">
      {issues.map((issue, i) => {
        const message = typeof issue === "string" ? issue : issue.message;
        const field = typeof issue === "string" ? undefined : issue.field;
        if (!field || !onIssueClick) {
          return <li key={i}>{message}</li>;
        }
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onIssueClick(field)}
              className="text-left underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:hover:text-white"
            >
              {message}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
