"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Chrome de scroll partilhado (título + setas + trilho horizontal) extraído
// do CourseRow.tsx — sem o hover-zoom/push específico de cursos, que fica só
// lá. Usado por secções que precisam de uma linha horizontal "à Netflix" mas
// sem essa coreografia (pessoas, bundles, revendas).
export function HorizontalScrollRow({ title, children }: { title: string; children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 900, behavior: "smooth" });
  }

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
        className="scrollbar-hide flex items-start gap-3 overflow-x-auto overflow-y-visible scroll-smooth px-4 py-2 sm:gap-4 sm:px-8"
      >
        {children}
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
