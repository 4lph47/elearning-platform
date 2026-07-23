"use client";

import { useId } from "react";
import Link from "next/link";
import { useCardTransition, type TransitionKind } from "@/components/course/CardTransitionContext";
import { useFadeNav } from "@/components/course/FadeNavContext";

// Link de curso pra aula/hero (botão "Continuar curso", item da lista de
// aulas, título no dashboard). Destino "hero" tem um vídeo pra aterrar
// (CourseHero) — vídeo voa até lá (registerSource). Destino "lesson-video"/
// "lesson-text" não tem onde aterrar (a página de aula não tem hero) — fade
// simples em vez disso (FadeNavContext): esmorece, branco, entra a aula.
export function ContinueCourseLink({
  courseSlug,
  href,
  destinationKind,
  className,
  children,
}: {
  courseSlug: string;
  href: string;
  destinationKind: TransitionKind;
  className?: string;
  children: React.ReactNode;
}) {
  const { startFromSource } = useCardTransition();
  const { fadeNavigate } = useFadeNav();
  const cardId = useId();

  function handleClick(e: React.MouseEvent) {
    if (destinationKind === "hero") {
      startFromSource({ cardId, slug: courseSlug, destinationKind });
      return;
    }
    e.preventDefault();
    fadeNavigate(href);
  }

  return (
    <Link href={href} prefetch className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
