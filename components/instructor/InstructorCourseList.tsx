"use client";

import { useMemo, useState } from "react";
import { Search, BookOpen, Users, Star, Wallet, ArrowRight, Package } from "lucide-react";
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

export interface InstructorBundleSummary {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  courseTitles: string[];
  price: number;
}

type Tab = "cursos" | "bundles";

// Mesmo padrão da search bar do dashboard do aluno (DashboardTabs.tsx) —
// filtro local, sem pedido ao servidor. Espaçamento entre cards subido pra
// space-y-4 (antes space-y-3, ficavam quase a tocar-se). Tabs Cursos/Bundles
// só aparecem se houver bundles — mesmo espírito do tab Cursos/À venda do
// InstructorCourseGrid (perfil público), aqui pros próprios bundles do
// instrutor (Bundle, não ResaleBundle).
export function InstructorCourseList({
  courses,
  bundles = [],
}: {
  courses: InstructorCourseSummary[];
  bundles?: InstructorBundleSummary[];
}) {
  const [tab, setTab] = useState<Tab>("cursos");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [courses, query]);

  const filteredBundles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bundles;
    return bundles.filter(
      (b) => b.name.toLowerCase().includes(q) || b.courseTitles.some((t) => t.toLowerCase().includes(q))
    );
  }, [bundles, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "cursos" ? "Procurar nos meus cursos..." : "Procurar nos meus bundles..."}
          className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
        />
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>

      {bundles.length > 0 && (
        <div className="flex gap-2">
          {(
            [
              { id: "cursos" as const, label: "Cursos", icon: BookOpen },
              { id: "bundles" as const, label: "Bundles", icon: Package },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "bundles" ? (
        filteredBundles.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {bundles.length === 0 ? "Ainda não criaste nenhum bundle." : `Nenhum bundle encontrado para "${query}".`}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredBundles.map((bundle) => (
              <div
                key={bundle.id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
              >
                {bundle.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bundle.thumbnailUrl} alt={bundle.name} className="h-16 w-24 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-400 dark:bg-slate-900 dark:text-slate-600">
                    {bundle.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-slate-900 dark:text-white">{bundle.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} /> {bundle.courseTitles.length} curso{bundle.courseTitles.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wallet size={12} /> {bundle.price.toFixed(2)}€
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{bundle.courseTitles.join(", ")}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
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
