"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useCardTransition } from "@/components/course/CardTransitionContext";

// Têm de bater com CourseHero.tsx: o texto que se sobrepõe ao vídeo (breadcrumb,
// descrição, "alunos matriculados", etc.) só aparece REMAINING_START_DELAY_MS
// depois do arrive(), e demora REMAINING_FADE_MS a ficar 100% visível.
const FLY_MS = 450;
const SETTLE_MS = 1;
const HOLD_MS = 1000;
const REVEAL_MS = 700;
const REMAINING_START_DELAY_MS = FLY_MS + SETTLE_MS + HOLD_MS + REVEAL_MS;
const REMAINING_FADE_MS = 500;
const BELOW_START_DELAY_MS = REMAINING_START_DELAY_MS + REMAINING_FADE_MS;
const FADE_MS = 500;

// PageEntranceFade (layout.tsx) revela a página inteira (hero real + isto)
// assim que o wipe do FadeOutScrim termina — cedo demais para o conteúdo
// abaixo do hero, que ficava visível antes do próprio texto do hero (que se
// sobrepõe ao vídeo) ter acabado de aparecer. Este wrapper, só para o
// conteúdo abaixo do hero, atrasa a revelação até esse texto estar completo.
export function CourseBelowFoldReveal({ slug, children }: { slug: string; children: ReactNode }) {
  const { state } = useCardTransition();
  const [visible, setVisible] = useState(() => state?.slug !== slug);
  // Uma vez true, nunca volta a false — precisa de sobreviver ao finish()
  // (que zera `state` ~700ms antes deste atraso terminar). Se o timer
  // abaixo dependesse de `state` diretamente, o zerar cancelava-o (efeito
  // limpa o setTimeout pendente sempre que uma dependência muda) antes de
  // disparar, e o conteúdo nunca aparecia.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (state?.slug === slug && state.arrived) setArmed(true);
  }, [state?.slug, state?.arrived, slug]);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setVisible(true), BELOW_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease-out` }}>
      {children}
    </div>
  );
}
