"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { pauseAllVideos } from "@/lib/pauseAllVideos";

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
  // Formulário com alterações por guardar regista aqui uma função que
  // devolve true enquanto isso for verdade (ver lib/useUnsavedChangesGuard.ts)
  // — fadeNavigate confirma com a pessoa antes de sair, em vez de perder o
  // que ela escreveu silenciosamente.
  setNavigationGuard: (guard: (() => boolean) | null) => void;
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
  const guardRef = useRef<(() => boolean) | null>(null);
  // href à espera de confirmação — window.confirm() é uma caixa nativa do
  // browser, sem nada a ver com o resto da UI da app (fácil de nem
  // reconhecer como "a app a perguntar algo"); isto troca por um card
  // próprio, com o resto da transição só a arrancar depois de confirmar.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setNavigationGuard = useCallback((guard: (() => boolean) | null) => {
    guardRef.current = guard;
  }, []);

  const runNavigation = useCallback(
    (href: string) => {
      pauseAllVideos();
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

  const fadeNavigate = useCallback(
    (href: string) => {
      if (guardRef.current?.()) {
        setPendingHref(href);
        return;
      }
      runNavigation(href);
    },
    [runNavigation]
  );

  function confirmLeave() {
    guardRef.current = null;
    const href = pendingHref;
    setPendingHref(null);
    if (href) runNavigation(href);
  }

  function cancelLeave() {
    setPendingHref(null);
  }

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
    <FadeNavContext.Provider value={{ fadeNavigate, curtainActive, setNavigationGuard }}>
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
      {pendingHref && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" onClick={cancelLeave}>
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Alterações por guardar</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              Tens alterações que ainda não guardaste. Se saíres agora, vais perdê-las.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelLeave}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmLeave}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
              >
                Sair sem guardar
              </button>
            </div>
          </div>
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
