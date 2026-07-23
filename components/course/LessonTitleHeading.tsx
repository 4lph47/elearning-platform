"use client";

import { useEffect, useRef } from "react";
import { textBoxFromElement } from "@/components/course/CardTransitionContext";
import { useTextFly } from "@/components/course/TextFlyContext";

// Título renderiza-se duas vezes em LessonBody.tsx (versão mobile e desktop,
// escondidas uma de cada vez por CSS) — só a visível tem tamanho não-nulo,
// só essa reporta arrive(). Fica invisível (visibility, não display, pra não
// alterar o layout) até o clone (TextFlyOverlay) terminar mesmo de aterrar.
export function LessonTitleHeading({ lessonId, title }: { lessonId: string; title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { state, arrive } = useTextFly();
  const pending = state?.id === lessonId && !state.arrived;
  const hidden = state?.id === lessonId && !state.revealed;

  useEffect(() => {
    if (!pending || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    arrive(lessonId, textBoxFromElement(ref.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, lessonId]);

  return (
    <h1
      ref={ref}
      className="text-2xl font-bold text-slate-900 dark:text-white"
      style={{ visibility: hidden ? "hidden" : "visible" }}
    >
      {title}
    </h1>
  );
}
