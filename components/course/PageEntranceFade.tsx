"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCardTransition } from "@/components/course/CardTransitionContext";
import { useTextFly } from "@/components/course/TextFlyContext";

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
  const { state: textFlyState } = useTextFly();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [visible, setVisible] = useState(true);

  // Ajuste durante o render (não num efeito) — aplica-se ainda antes do
  // primeiro paint desta página, sem janela para aparecer visível.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setVisible(false);
  }

  // Numa transição de card, quem manda mostrar é o reveal() dela (sincronizado
  // com o FadeOutScrim); numa transição de texto (currículo/progresso/voltar),
  // é o revealed do TextFlyContext — a página só aparece 1ms depois do clone
  // ter mesmo aterrado no texto real, nunca durante o voo. Fora disso,
  // mostra-se sozinha pouco depois de montar.
  useEffect(() => {
    if (visible || state || textFlyState) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf1);
  }, [visible, state, textFlyState]);

  useEffect(() => {
    if (state?.revealed) setVisible(true);
  }, [state?.revealed]);

  useEffect(() => {
    if (textFlyState?.revealed) setVisible(true);
  }, [textFlyState?.revealed]);

  // Durante a transição de card/texto o wipe visível é o do scrim/clone —
  // aqui só precisa de aparecer por baixo sem fade próprio (evita duplo-fade).
  const instant = Boolean(state) || Boolean(textFlyState);

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: instant ? "none" : `opacity ${FADE_MS}ms ease-out` }}>
      {children}
    </div>
  );
}
