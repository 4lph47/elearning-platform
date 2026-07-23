"use client";

import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LazyMount } from "@/components/course/LazyMount";
import { PosterCard } from "@/components/course/PosterCard";
import type { CourseCardData } from "@/components/course/CourseCard";
import { useCardTransition, type TransitionKind } from "@/components/course/CardTransitionContext";

// Card w-64/sm:w-72 (256px/288px) a scale(1.15) com origem ao centro cresce
// 7.5% do próprio largura para cada lado — os vizinhos têm de se afastar essa
// mesma quantidade (19px/22px) para o espaço entre cards ficar igual ao que
// era antes. Classes literais (não construídas por template string) porque o
// Tailwind JIT só gera CSS para valores arbitrários que aparecem tal e qual
// no código-fonte.
export function CourseRow({
  title,
  courses,
  hrefBySlug,
  progressBySlug,
  hidePriceBySlug,
  destinationKindBySlug,
  rankBySlug,
}: {
  title: string;
  courses: CourseCardData[];
  hrefBySlug?: Record<string, string>;
  progressBySlug?: Record<string, number>;
  hidePriceBySlug?: Record<string, boolean>;
  destinationKindBySlug?: Record<string, TransitionKind>;
  rankBySlug?: Record<string, number>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { state } = useCardTransition();
  const rowId = useId();

  // O mesmo curso pode aparecer em várias rows (Populares, Recentes, categoria...)
  // — comparar por slug faria todas essas instâncias expandirem juntas. Cada
  // card tem aqui um cardId próprio (rowId+índice), único mesmo repetido.
  // Trava o zoom no card clicado (tap no mobile não passa por hoveredIndex,
  // que só existe com mouse) — CourseTile.tsx força este mesmo scale (sem
  // transição) só para medir a posição final antes de chamar start(), por
  // isso não há corrida entre o card real e o clone.
  const transitioningIndex = state && !state.arrived ? courses.findIndex((_, i) => state.cardId === `${rowId}-${i}`) : -1;
  const activeIndex = transitioningIndex !== -1 ? transitioningIndex : hoveredIndex;

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 900, behavior: "smooth" });
  }

  if (courses.length === 0) return null;

  return (
    <section className="group/row relative py-5">
      <h2 className="mb-3 px-4 text-lg font-semibold text-slate-900 dark:text-white sm:px-8 sm:text-xl">{title}</h2>

      <button
        onClick={() => scrollBy(-1)}
        aria-label="Recuar"
        className="absolute left-0 top-9 z-20 hidden h-36 w-10 items-center justify-center bg-gradient-to-r from-white/90 to-transparent text-slate-900 opacity-0 transition-opacity hover:from-white group-hover/row:opacity-100 dark:from-black/80 dark:text-white dark:hover:from-black/90 sm:flex sm:h-40"
      >
        <ChevronLeft size={22} />
      </button>

      <div
        ref={scrollRef}
        // items-start: sem isto, o default (stretch) esticava cada wrapper até
        // à altura do card mais alto da linha (ex: cursos com rating vs sem
        // rating têm alturas diferentes) — o centro vertical do
        // transform-origin real ficava mais abaixo do que a altura do próprio
        // <Link>, desalinhando a matemática do zoom (CourseTile.tsx) que usa
        // a rect do Link como proxy do wrapper.
        className="scrollbar-hide flex items-start gap-3 overflow-x-auto overflow-y-visible scroll-smooth px-4 py-8 sm:gap-4 sm:px-8"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {courses.map((course, i) => {
          const cardId = `${rowId}-${i}`;
          const scaled = activeIndex === i;
          // Card numa ponta cresce só para um lado (origem left/right, não
          // center) — toda a expansão (não metade) cai em cima desse lado.
          // É uma cadeia rígida de larguras/gaps fixos: o vizinho imediato
          // absorve o deslocamento inteiro, e todos os cards mais além dele
          // têm de herdar o MESMO deslocamento (não diminui com a distância)
          // para os gaps entre eles continuarem constantes — só o lado
          // oposto à ponta é que nunca cresce, esse fica sem empurrão.
          const activeIsLeftEdge = activeIndex === 0;
          const activeIsRightEdge = activeIndex === courses.length - 1;
          const pushClass = scaled
            ? "scale-[1.15]"
            : activeIndex !== null && i < activeIndex
              ? activeIsRightEdge
                ? "-translate-x-[38px] sm:-translate-x-[44px]"
                : "-translate-x-[19px] sm:-translate-x-[22px]"
              : activeIndex !== null && i > activeIndex
                ? activeIsLeftEdge
                  ? "translate-x-[38px] sm:translate-x-[44px]"
                  : "translate-x-[19px] sm:translate-x-[22px]"
                : "";
          const zoomOrigin = i === 0 ? "left" : i === courses.length - 1 ? "right" : "center";
          return (
            <div
              key={course.slug}
              onMouseEnter={() => setHoveredIndex(i)}
              className={`shrink-0 transition-transform duration-300 ease-out ${pushClass}`}
              style={{
                transformOrigin: `${zoomOrigin} center`,
                zIndex: scaled ? 20 : 1,
              }}
            >
              <LazyMount className="w-64 shrink-0 sm:w-72" minHeight={230}>
                <PosterCard
                  course={course}
                  href={hrefBySlug?.[course.slug]}
                  progressPercent={progressBySlug?.[course.slug]}
                  hidePrice={hidePriceBySlug?.[course.slug]}
                  destinationKind={destinationKindBySlug?.[course.slug]}
                  cardId={cardId}
                  rowZoom
                  rank={rankBySlug?.[course.slug]}
                />
              </LazyMount>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => scrollBy(1)}
        aria-label="Avançar"
        className="absolute right-0 top-9 z-20 hidden h-36 w-10 items-center justify-center bg-gradient-to-l from-white/90 to-transparent text-slate-900 opacity-0 transition-opacity hover:from-white group-hover/row:opacity-100 dark:from-black/80 dark:text-white dark:hover:from-black/90 sm:flex sm:h-40"
      >
        <ChevronRight size={22} />
      </button>
    </section>
  );
}
