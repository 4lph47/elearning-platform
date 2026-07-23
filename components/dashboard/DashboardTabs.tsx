"use client";

import { useMemo, useState } from "react";
import { Search, Activity, BookOpen, SlidersHorizontal, X } from "lucide-react";
import { CourseRow } from "@/components/course/CourseRow";
import type { CourseCardData } from "@/components/course/CourseCard";
import type { TransitionKind } from "@/components/course/CardTransitionContext";
import {
  FilterPanel,
  SORT_OPTIONS,
  LEVEL_OPTIONS,
  MAX_PRICE_CEIL,
  DEFAULT_FILTER_VALUES,
  type FilterValues,
} from "@/components/course/FilterPanel";

type Tab = "cursos" | "atividade";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "cursos", label: "Os meus cursos", icon: BookOpen },
  { id: "atividade", label: "Atividade", icon: Activity },
];

export interface CourseStats {
  enrollmentCount: number;
  totalDurationSeconds: number;
  commentCount: number;
  likeCount: number;
  favoriteScore: number;
  createdAt: string;
}

// Pesquisa + separação por abas (tipo as pastilhas de categoria da página
// principal) — evita ter estatísticas, gráficos e a lista de cursos todos
// amontoados na mesma vista. Pesquisa só faz sentido em "Os meus cursos" —
// fica escondida (e por baixo das abas, não acima) na aba de atividade.
// Filtros iguais aos do catálogo (mesmo FilterPanel), mas em modo local —
// sem router/URL, tudo em useState, aplicado em memória sobre os cursos já
// carregados (não há pedido ao servidor).
export function DashboardTabs({
  activityContent,
  courses,
  hrefBySlug,
  progressBySlug,
  destinationKindBySlug,
  hidePriceBySlug,
  courseStatsBySlug,
}: {
  activityContent: React.ReactNode;
  courses: CourseCardData[];
  hrefBySlug: Record<string, string>;
  progressBySlug: Record<string, number>;
  destinationKindBySlug: Record<string, TransitionKind>;
  hidePriceBySlug: Record<string, boolean>;
  courseStatsBySlug: Record<string, CourseStats>;
}) {
  const [tab, setTab] = useState<Tab>("cursos");
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTER_VALUES);

  const categories = useMemo(() => Array.from(new Set(courses.map((c) => c.category))), [courses]);

  const stats = (slug: string) => courseStatsBySlug[slug];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minDurationSeconds = filters.minDuration * 3600;
    return courses.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(c.category)) return false;
      if (filters.level && c.level !== filters.level) return false;
      if (c.price > filters.maxPrice) return false;
      const s = stats(c.slug);
      if (s) {
        if (s.totalDurationSeconds < minDurationSeconds) return false;
        if (s.enrollmentCount < filters.minEnrollments) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, query, filters, courseStatsBySlug]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (filters.sort) {
      case "recent":
        list.sort((a, b) => Date.parse(stats(b.slug)?.createdAt ?? "0") - Date.parse(stats(a.slug)?.createdAt ?? "0"));
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "reviews":
        list.sort((a, b) => b.ratingCount - a.ratingCount);
        break;
      case "popular":
        list.sort((a, b) => (stats(b.slug)?.enrollmentCount ?? 0) - (stats(a.slug)?.enrollmentCount ?? 0));
        break;
      case "favorites":
        list.sort((a, b) => (stats(b.slug)?.favoriteScore ?? 0) - (stats(a.slug)?.favoriteScore ?? 0));
        break;
      case "comments":
        list.sort((a, b) => (stats(b.slug)?.commentCount ?? 0) - (stats(a.slug)?.commentCount ?? 0));
        break;
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      default:
        break;
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, filters.sort, courseStatsBySlug]);

  const rankBySlug: Record<string, number> =
    filters.sort === "favorites" ? Object.fromEntries(sorted.map((c, i) => [c.slug, i + 1])) : {};

  // Ordenação ativa mostra uma lista só (#1 até ao último) — separar por
  // categoria só faz sentido sem ordenação explícita.
  const byCategory = useMemo(() => {
    const map = new Map<string, CourseCardData[]>();
    for (const c of sorted) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  }, [sorted]);

  const activeFilters = [
    ...filters.categories.map((c) => ({ key: `category:${c}`, label: c })),
    filters.level ? { key: "level", label: LEVEL_OPTIONS.find((l) => l.value === filters.level)?.label ?? filters.level } : null,
    filters.sort ? { key: "sort", label: SORT_OPTIONS.find((s) => s.value === filters.sort)?.label ?? filters.sort } : null,
    filters.maxPrice < MAX_PRICE_CEIL ? { key: "maxPrice", label: `Até ${filters.maxPrice}€` } : null,
    filters.minDuration > 0 ? { key: "minDuration", label: `${filters.minDuration}h+` } : null,
    filters.minEnrollments > 0 ? { key: "minEnrollments", label: `${filters.minEnrollments}+ alunos` } : null,
  ].filter((f): f is { key: string; label: string } => f !== null);

  function clearFilter(key: string) {
    if (key.startsWith("category:")) {
      const removed = key.slice("category:".length);
      setFilters((f) => ({ ...f, categories: f.categories.filter((c) => c !== removed) }));
      return;
    }
    setFilters((f) => ({ ...f, [key]: DEFAULT_FILTER_VALUES[key as keyof FilterValues] }));
  }

  return (
    <div className="mt-6">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
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

      {tab === "cursos" && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative max-w-md flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar nos meus cursos..."
                className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
              />
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>

            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                activeFilters.length > 0
                  ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <SlidersHorizontal size={15} />
              Filtros
              {activeFilters.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => clearFilter(f.key)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-400 bg-slate-200 px-3 py-1 text-xs font-medium text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
                >
                  {f.label}
                  <X size={12} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTER_VALUES)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        {tab === "atividade" ? (
          activityContent
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum curso encontrado.</p>
        ) : (
          // -mx cancela o padding do container pai (px-4 sm:px-8 na página) —
          // CourseRow já traz o seu próprio, igual ao da página principal.
          <div className="-mx-4 -mt-4 space-y-1 sm:-mx-8">
            {filters.sort ? (
              <CourseRow
                title="Resultados"
                courses={sorted}
                hrefBySlug={hrefBySlug}
                progressBySlug={progressBySlug}
                destinationKindBySlug={destinationKindBySlug}
                hidePriceBySlug={hidePriceBySlug}
                rankBySlug={rankBySlug}
              />
            ) : (
              Array.from(byCategory.entries()).map(([category, list]) => (
                <CourseRow
                  key={category}
                  title={category}
                  courses={list}
                  hrefBySlug={hrefBySlug}
                  progressBySlug={progressBySlug}
                  destinationKindBySlug={destinationKindBySlug}
                  hidePriceBySlug={hidePriceBySlug}
                />
              ))
            )}
          </div>
        )}
      </div>

      {panelOpen && (
        <FilterPanel
          categories={categories}
          values={filters}
          onApply={setFilters}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
