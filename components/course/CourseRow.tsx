"use client";

import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
}: {
  title: string;
  courses: CourseCardData[];
  hrefBySlug?: Record<string, string>;
  progressBySlug?: Record<string, number>;
  hidePriceBySlug?: Record<string, boolean>;
  destinationKindBySlug?: Record<string, TransitionKind>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { state } = useCardTransition();
  const rowId = useId();

  // O mesmo curso pode aparecer em várias rows (Populares, Recentes, categoria...)
  // — comparar por slug faria todas essas instâncias expandirem juntas. Cada
  // card tem aqui um cardId próprio (rowId+índice), único mesmo repetido.
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
        className="absolute left-0 top-9 z-20 hidden h-36 w-10 items-center justify-center bg-gradient-to-r from-black/80 to-transparent text-white opacity-0 transition-opacity hover:from-black/90 group-hover/row:opacity-100 sm:flex sm:h-40"
      >
        <ChevronLeft size={22} />
      </button>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-3 overflow-x-auto overflow-y-visible scroll-smooth px-4 py-8 sm:gap-4 sm:px-8"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {courses.map((course, i) => {
          const cardId = `${rowId}-${i}`;
          // Esta wrapper (item de flex) cria o seu próprio stacking context por causa
          // do zIndex inline — se não subir o dela também, o z-index elevado do
          // CourseTile fica preso cá dentro e não escapa ao FadeOutScrim lá fora.
          const isTransitioning = state?.cardId === cardId && !state.arrived;
          const scaled = activeIndex === i;
          // Cards nas pontas crescem só para um lado (origem left/right, não
          // center) — toda a expansão cai em cima do vizinho desse lado, por
          // isso só ele (o imediato) precisa do dobro do afastamento, não a
          // linha toda.
          const activeIsLeftEdge = activeIndex === 0;
          const activeIsRightEdge = activeIndex === courses.length - 1;
          const isDoubleLeftPush = activeIsRightEdge && i === (activeIndex as number) - 1;
          const isDoubleRightPush = activeIsLeftEdge && i === (activeIndex as number) + 1;
          const pushClass = scaled
            ? "scale-[1.15]"
            : activeIndex !== null && i < activeIndex
              ? isDoubleLeftPush
                ? "-translate-x-[38px] sm:-translate-x-[44px]"
                : "-translate-x-[19px] sm:-translate-x-[22px]"
              : activeIndex !== null && i > activeIndex
                ? isDoubleRightPush
                  ? "translate-x-[38px] sm:translate-x-[44px]"
                  : "translate-x-[19px] sm:translate-x-[22px]"
                : "";
          return (
            <div
              key={course.slug}
              onMouseEnter={() => setHoveredIndex(i)}
              className={`shrink-0 transition-transform duration-300 ease-out ${pushClass}`}
              style={{
                transformOrigin: i === 0 ? "left center" : i === courses.length - 1 ? "right center" : "center center",
                zIndex: isTransitioning ? 950 : scaled ? 20 : 1,
              }}
            >
              <PosterCard
                course={course}
                href={hrefBySlug?.[course.slug]}
                progressPercent={progressBySlug?.[course.slug]}
                hidePrice={hidePriceBySlug?.[course.slug]}
                destinationKind={destinationKindBySlug?.[course.slug]}
                cardId={cardId}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={() => scrollBy(1)}
        aria-label="Avançar"
        className="absolute right-0 top-9 z-20 hidden h-36 w-10 items-center justify-center bg-gradient-to-l from-black/80 to-transparent text-white opacity-0 transition-opacity hover:from-black/90 group-hover/row:opacity-100 sm:flex sm:h-40"
      >
        <ChevronRight size={22} />
      </button>
    </section>
  );
}
