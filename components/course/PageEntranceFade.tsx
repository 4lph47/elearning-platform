"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCardTransition } from "@/components/course/CardTransitionContext";

const FADE_MS = 1400;

// Fade-in em qualquer troca de página, começando de uma tela em branco.
// Esconde SEMPRE no instante em que o pathname muda — mesmo durante uma
// transição de card, porque nessa altura o card de origem já nem existe (foi
// substituído pela página nova); o truque do z-index só interessa antes da
// troca acontecer, nunca depois. Isto garante opacity:0 real na página nova,
// em vez de depender só do FadeOutScrim (que fica a 20% durante a espera —
// o suficiente para a página nova ainda aparecer bem visível se a troca
// acontecer nessa janela).
export function PageEntranceFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useCardTransition();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [visible, setVisible] = useState(true);

  // Ajuste durante o render (não num efeito) — aplica-se ainda antes do
  // primeiro paint desta página, sem janela para aparecer visível.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setVisible(false);
  }

  // Numa transição de card, quem manda mostrar é o reveal() dela (sincronizado
  // com o FadeOutScrim); fora disso, mostra-se sozinho pouco depois de montar.
  useEffect(() => {
    if (visible || state) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf1);
  }, [visible, state]);

  useEffect(() => {
    if (state?.revealed) setVisible(true);
  }, [state?.revealed]);

  // Durante a transição de card o wipe visível é o do scrim — aqui só precisa
  // de aparecer por baixo dele sem fade próprio (evita um duplo-fade).
  const instant = Boolean(state);

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: instant ? "none" : `opacity ${FADE_MS}ms ease-out` }}>
      {children}
    </div>
  );
}
