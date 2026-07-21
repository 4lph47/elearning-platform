"use client";

import type { ReactNode } from "react";
import { useCardTransition } from "@/components/course/CardTransitionContext";

// Qualquer ancestral posicionado com z-index próprio (mesmo baixo, tipo z-10)
// cria o seu próprio stacking context e prende lá dentro qualquer z-index dos
// filhos — por isso o card selecionado nunca conseguia escapar ao FadeOutScrim
// (z-900) enquanto estivesse dentro de um destes. Este wrapper sobe o SEU
// próprio z-index acima do scrim sempre que há uma transição de card em espera,
// deixando o z-index elevado do CourseTile lá dentro finalmente fazer efeito.
export function ZIndexEscapeLayer({ children, className }: { children: ReactNode; className: string }) {
  const { state } = useCardTransition();
  const escaping = state ? !state.arrived : false;

  return (
    <div className={className} style={escaping ? { zIndex: 950 } : undefined}>
      {children}
    </div>
  );
}
