"use client";

import { useMemo, useState } from "react";
import { Search, BookOpen, Users, Star, Wallet, ArrowRight } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";

export interface InstructorCourseSummary {
  id: string;
  title: string;
  category: string;
  published: boolean;
  thumbnailUrl: string | null;
  lessonCount: number;
  studentCount: number;
  rating: number;
  ratingCount: number;
  revenue: number;
}

// Mesmo padrão da search bar do dashboard do aluno (DashboardTabs.tsx) —
// filtro local, sem pedido ao servidor. Espaçamento entre cards subido pra
// space-y-4 (antes space-y-3, ficavam quase a tocar-se).
export function InstructorCourseList({ courses }: { courses: InstructorCourseSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [courses, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Procurar nos meus cursos..."
          className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
        />
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum curso encontrado para &quot;{query}&quot;.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((course) => (
            <FadeLink key={course.id} href={`/instructor/courses/${course.id}`} className="block">
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/20">
                {course.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="h-16 w-24 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-400 dark:bg-slate-900 dark:text-slate-600">
                    {course.title.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-slate-900 dark:text-white">{course.title}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        course.published
                          ? "bg-green-600/15 text-green-700 dark:text-green-400"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {course.published ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} /> {course.lessonCount} aula{course.lessonCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {course.studentCount} aluno{course.studentCount !== 1 ? "s" : ""}
                    </span>
                    {course.ratingCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={12} className="fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400" /> {course.rating.toFixed(1)} (
                        {course.ratingCount})
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Wallet size={12} /> {course.revenue.toFixed(2)}€
                    </span>
                  </div>
                </div>

                <ArrowRight size={16} className="shrink-0 text-slate-500" />
              </div>
            </FadeLink>
          ))}
        </div>
      )}
    </div>
  );
}
