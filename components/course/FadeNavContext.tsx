"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// Transição simples curso->aula (sem vídeo a voar, a página de aula não tem
// hero pra aterrar): tudo esmorece sob uma cortina opaca (mesma cor do fundo
// da página — visualmente idêntico a cada elemento a esmorecer).
//
// Cobrir começa já no clique (senão, numa navegação rápida/pré-carregada, a
// página nova troca por baixo antes da cortina sequer aparecer — dava pra
// ver a página seguinte antes da transição). Só a REVELAÇÃO (fade-out) é que
// espera duas coisas: a cortina ter mesmo acabado de cobrir (covered) e
// isPending ter voltado a false — router.push() dentro de startTransition()
// carrega a página nova em fundo, mantendo a atual montada; só quando
// isPending acaba é que o React já trocou por baixo, garantido.
const FADE_IN_MS = 350;
const BLANK_MS = 150;
const FADE_OUT_MS = 450;
// Se a página seguinte demorar a carregar (isPending fica true por muito
// tempo), a cortina sozinha parece ecrã morto — ao fim deste atraso mostra
// um spinner por cima, só pra navegações rápidas nunca chegarem a vê-lo.
const SPINNER_DELAY_MS = 500;

interface FadeNavContextValue {
  fadeNavigate: (href: string) => void;
  curtainActive: boolean;
}

const FadeNavContext = createContext<FadeNavContextValue | null>(null);

export function FadeNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [curtainOpacity, setCurtainOpacity] = useState(0);
  const [transitionMs, setTransitionMs] = useState(FADE_IN_MS);
  const [curtainActive, setCurtainActive] = useState(false);
  const [covered, setCovered] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  const fadeNavigate = useCallback(
    (href: string) => {
      setCurtainActive(true);
      setCovered(false);
      setTransitionMs(FADE_IN_MS);
      // 2 RAFs: garante que o browser pinta opacity:0 antes de subir pra 1
      // (senão a transição CSS não anima, salta logo pro valor final).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setCurtainOpacity(1));
      });
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  useEffect(() => {
    if (!covered || !isPending) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [covered, isPending]);

  useEffect(() => {
    if (!covered || isPending) return;
    const t1 = setTimeout(() => {
      setTransitionMs(FADE_OUT_MS);
      setCurtainOpacity(0);
    }, BLANK_MS);
    const t2 = setTimeout(() => setCurtainActive(false), BLANK_MS + FADE_OUT_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [covered, isPending]);

  return (
    <FadeNavContext.Provider value={{ fadeNavigate, curtainActive }}>
      {children}
      {curtainActive && (
        <div
          className="pointer-events-none fixed inset-0 top-16 z-[25] flex items-center justify-center bg-white dark:bg-black"
          style={{ opacity: curtainOpacity, transition: `opacity ${transitionMs}ms ease-out` }}
          onTransitionEnd={() => {
            if (curtainOpacity === 1) setCovered(true);
          }}
        >
          {showSpinner && (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-white/15 dark:border-t-white/70" />
          )}
        </div>
      )}
    </FadeNavContext.Provider>
  );
}

export function useFadeNav() {
  const ctx = useContext(FadeNavContext);
  if (!ctx) throw new Error("useFadeNav must be used within FadeNavProvider");
  return ctx;
}
