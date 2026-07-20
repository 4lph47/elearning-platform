"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PosterCard } from "@/components/course/PosterCard";
import type { CourseCardData } from "@/components/course/CourseCard";

export function CourseRow({
  title,
  courses,
  hrefBySlug,
  progressBySlug,
  hidePriceBySlug,
}: {
  title: string;
  courses: CourseCardData[];
  hrefBySlug?: Record<string, string>;
  progressBySlug?: Record<string, number>;
  hidePriceBySlug?: Record<string, boolean>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
        {courses.map((course, i) => (
          <div
            key={course.slug}
            onMouseEnter={() => setHoveredIndex(i)}
            className="shrink-0 transition-transform duration-300 ease-out"
            style={{
              transform:
                hoveredIndex === i
                  ? "scale(1.15)"
                  : hoveredIndex !== null && i < hoveredIndex
                    ? "translateX(-28px)"
                    : hoveredIndex !== null && i > hoveredIndex
                      ? "translateX(28px)"
                      : undefined,
              zIndex: hoveredIndex === i ? 20 : 1,
            }}
          >
            <PosterCard
              course={course}
              href={hrefBySlug?.[course.slug]}
              progressPercent={progressBySlug?.[course.slug]}
              hidePrice={hidePriceBySlug?.[course.slug]}
            />
          </div>
        ))}
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
