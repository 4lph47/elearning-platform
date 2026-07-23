"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CourseTile } from "@/components/course/CourseTile";
import type { CourseCardData } from "@/components/course/CourseCard";
import { useInstructorAccent } from "@/components/instructor/InstructorAccentContext";

const HEADER_HEIGHT = 64;
const SCROLL_GAP = 12;

export function InstructorCourseGrid({
  instructorFirstName,
  courses,
  hidePriceBySlug,
}: {
  instructorFirstName: string;
  courses: CourseCardData[];
  hidePriceBySlug: Record<string, boolean>;
}) {
  const [query, setQuery] = useState("");
  const { mid } = useInstructorAccent();
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, query]);

  // Mobile: tocar no campo traz o teclado, que come metade do ecrã — sem
  // aproximar a barra do header primeiro, ela ficava escondida atrás dele.
  // Só no mobile (desktop já tem espaço de sobra e hover, não precisa disto).
  function handleSearchFocus() {
    if (typeof window === "undefined" || window.innerWidth >= 640) return;
    const el = searchWrapRef.current;
    if (!el) return;
    const targetY = window.scrollY + el.getBoundingClientRect().top - HEADER_HEIGHT - SCROLL_GAP;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="order-2 text-lg font-semibold text-slate-900 dark:text-white sm:order-1">
          Cursos de {instructorFirstName}
        </h2>
        {courses.length > 0 && (
          <div
            ref={searchWrapRef}
            className="relative order-1 w-full sm:order-2 sm:max-w-xs"
            style={{ "--instructor-accent": `rgb(${mid})` } as React.CSSProperties}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleSearchFocus}
              placeholder={`Procurar nos cursos de ${instructorFirstName}...`}
              className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[var(--instructor-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--instructor-accent)] dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
            />
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ainda não tem cursos publicados.</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Nenhum curso encontrado para &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseTile key={course.slug} course={course} hidePrice={hidePriceBySlug[course.slug]} />
          ))}
        </div>
      )}
    </div>
  );
}
