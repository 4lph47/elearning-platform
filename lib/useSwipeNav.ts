"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "swipeNavDir";
// Depois do slide-out (900ms), o conteúdo fica a opacity-0 — se a próxima
// aula demorar a carregar, o ecrã ficava assim, sem nada, indefinidamente.
// Ao fim deste atraso mostra um spinner por cima (mesmo critério do
// FadeNavContext), só pra navegações rápidas nunca chegarem a vê-lo.
const SPINNER_DELAY_MS = 500;

export function useSwipeNav(previousHref?: string | null, nextHref?: string | null) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showSpinner, setShowSpinner] = useState(false);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const [swipeExit, setSwipeExit] = useState<"left" | "right" | null>(null);
  // Só leitura aqui (sem remover) — inicializador de useState tem de ser puro,
  // React Strict Mode chama-o 2x em dev; se a 1ª chamada já removesse o item,
  // a 2ª lia null e perdia a direção da entrada de forma intermitente.
  const [swipeEnter, setSwipeEnter] = useState<"left" | "right" | null>(() => {
    if (typeof window === "undefined") return null;
    const dir = sessionStorage.getItem(STORAGE_KEY);
    return dir === "left" || dir === "right" ? dir : null;
  });

  useEffect(() => {
    if (!swipeEnter) return;
    // Remover aqui (efeito, não no inicializador) — chamar 2x é inofensivo
    // (2ª chamada não encontra nada, no-op), ao contrário do inicializador.
    sessionStorage.removeItem(STORAGE_KEY);
    // double rAF: garante que o browser pinta a posição inicial deslocada
    // antes de assentar, senão a transição não anima (salta logo pro final).
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSwipeEnter(null));
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  // Mesma animação (esconde a atual, entra a seguinte) usada pelo gesto de
  // swipe e pelos botões "aula anterior"/"próxima aula" clicados — ambos
  // passam por aqui, nunca navegação simples sem transição.
  function goDirection(direction: "left" | "right", href: string) {
    setSwipeExit(direction);
    sessionStorage.setItem(STORAGE_KEY, direction);
    setTimeout(() => {
      startTransition(() => router.push(href));
    }, 900);
  }

  useEffect(() => {
    if (!isPending) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [isPending]);

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || window.innerWidth >= 1024) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.t;
    const isSwipe = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && elapsed < 600;
    if (!isSwipe) return;

    if (dx < 0 && nextHref) {
      goDirection("left", nextHref);
    } else if (dx > 0 && previousHref) {
      goDirection("right", previousHref);
    }
  }

  function goNext() {
    if (nextHref) goDirection("left", nextHref);
  }

  function goPrevious() {
    if (previousHref) goDirection("right", previousHref);
  }

  let swipeClassName: string;
  if (swipeExit === "left") {
    swipeClassName = "transition-all duration-[900ms] ease-in -translate-x-10 opacity-0";
  } else if (swipeExit === "right") {
    swipeClassName = "transition-all duration-[900ms] ease-in translate-x-10 opacity-0";
  } else if (swipeEnter === "left") {
    swipeClassName = "transition-all duration-[900ms] ease-out translate-x-10 opacity-0";
  } else if (swipeEnter === "right") {
    swipeClassName = "transition-all duration-[900ms] ease-out -translate-x-10 opacity-0";
  } else {
    swipeClassName = "transition-all duration-[900ms] ease-out translate-x-0 opacity-100";
  }

  return { handleTouchStart, handleTouchEnd, swipeClassName, goNext, goPrevious, showSpinner };
}
