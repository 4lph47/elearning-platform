"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Search, SlidersHorizontal, X, ShoppingBag } from "lucide-react";
import { CourseRow } from "@/components/course/CourseRow";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import type { CourseCardData } from "@/components/course/CourseCard";
import { useInstructorAccent } from "@/components/instructor/InstructorAccentContext";
import { ResaleListingTile, ResaleBundleTile } from "@/components/resale/ResaleTile";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

type Tab = "cursos" | "venda";

const HEADER_HEIGHT = 64;
const SCROLL_GAP = 12;

const SORT_OPTIONS = [
  { value: "", label: "Relevância" },
  { value: "rating", label: "Melhor avaliação" },
  { value: "reviews", label: "Mais avaliações" },
  { value: "price_asc", label: "Preço: menor primeiro" },
  { value: "price_desc", label: "Preço: maior primeiro" },
] as const;

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Iniciante" },
  { value: "intermediate", label: "Intermédio" },
  { value: "advanced", label: "Avançado" },
] as const;

function pillClass(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    active
      ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
  }`;
}

export function InstructorCourseGrid({
  instructorFirstName,
  courses,
  hidePriceBySlug,
  resaleListings = [],
  resaleBundles = [],
  belowSearch,
}: {
  instructorFirstName: string;
  courses: CourseCardData[];
  hidePriceBySlug: Record<string, boolean>;
  resaleListings?: ResaleListingCardData[];
  resaleBundles?: ResaleBundleCardData[];
  belowSearch?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("cursos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const { mid } = useInstructorAccent();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const allCategories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category))).sort((a, b) => a.localeCompare(b)),
    [courses]
  );

  useEffect(() => {
    if (!panelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const activeFilters = [
    ...categories.map((c) => ({ key: `category:${c}`, label: c })),
    level ? { key: "level", label: LEVEL_OPTIONS.find((l) => l.value === level)?.label ?? level } : null,
    sort ? { key: "sort", label: SORT_OPTIONS.find((s) => s.value === sort)?.label ?? sort } : null,
  ].filter((f): f is { key: string; label: string } => f !== null);

  function removeFilter(key: string) {
    if (key.startsWith("category:")) toggleCategory(key.slice("category:".length));
    else if (key === "level") setLevel("");
    else if (key === "sort") setSort("");
  }

  function clearAll() {
    setCategories([]);
    setLevel("");
    setSort("");
  }

  const filtered = useMemo(() => {
    let list = courses;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    if (categories.length > 0) list = list.filter((c) => categories.includes(c.category));
    if (level) list = list.filter((c) => c.level === level);
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    else if (sort === "reviews") list = [...list].sort((a, b) => b.ratingCount - a.ratingCount);
    else if (sort === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [courses, query, categories, level, sort]);

  const filteredResaleListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resaleListings;
    return resaleListings.filter((l) => l.courseTitle.toLowerCase().includes(q) || l.courseCategory.toLowerCase().includes(q));
  }, [resaleListings, query]);
  const filteredResaleBundles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resaleBundles;
    return resaleBundles.filter(
      (b) => b.name.toLowerCase().includes(q) || b.courseTitles.some((t) => t.toLowerCase().includes(q))
    );
  }, [resaleBundles, query]);

  // Sem ordenação explícita, separa por categoria (linhas horizontais, como
  // no catálogo) — com ordenação ativa a progressão #1→último ficaria
  // partida por várias linhas, por isso aí é uma lista só.
  const coursesByCategory = useMemo(() => {
    const map = new Map<string, CourseCardData[]>();
    for (const c of filtered) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  }, [filtered]);

  const resaleListingsByCategory = useMemo(() => {
    const map = new Map<string, ResaleListingCardData[]>();
    for (const l of filteredResaleListings) {
      if (!map.has(l.courseCategory)) map.set(l.courseCategory, []);
      map.get(l.courseCategory)!.push(l);
    }
    return map;
  }, [filteredResaleListings]);

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

  function handleFilterToggle() {
    setPanelOpen((v) => !v);
    if (typeof window === "undefined" || window.innerWidth >= 640) return;
    const el = searchWrapRef.current;
    if (!el) return;
    const targetY = window.scrollY + el.getBoundingClientRect().top - HEADER_HEIGHT - SCROLL_GAP;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }

  const hasResale = resaleListings.length > 0 || resaleBundles.length > 0;

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="order-2 text-lg font-semibold text-slate-900 dark:text-white sm:order-1">
          Cursos de {instructorFirstName}
        </h2>
        {(courses.length > 0 || hasResale) && (
          <div className="relative order-1 flex w-full gap-2 sm:order-2 sm:w-auto sm:max-w-xl">
            <div
              ref={searchWrapRef}
              className="relative min-w-0 flex-1"
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

            {tab === "cursos" && (
              <div ref={panelRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={handleFilterToggle}
                  className={`flex h-full shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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

                {panelOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-neutral-900">
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar por</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {SORT_OPTIONS.map((o) => (
                          <button key={o.value} type="button" onClick={() => setSort(o.value)} className={pillClass(sort === o.value)}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {allCategories.length > 1 && (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {allCategories.map((c) => (
                            <button key={c} type="button" onClick={() => toggleCategory(c)} className={pillClass(categories.includes(c))}>
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nível</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setLevel("")} className={pillClass(level === "")}>
                          Todos
                        </button>
                        {LEVEL_OPTIONS.map((l) => (
                          <button key={l.value} type="button" onClick={() => setLevel(l.value)} className={pillClass(level === l.value)}>
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {belowSearch}

      {hasResale && (
        <div className="mb-4 flex gap-2">
          {(
            [
              { id: "cursos" as const, label: "Cursos" },
              { id: "venda" as const, label: "À venda" },
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
              {t.id === "venda" && <ShoppingBag size={14} />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "venda" ? (
        <div>
          {filteredResaleBundles.length === 0 && filteredResaleListings.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">
              {resaleListings.length === 0 && resaleBundles.length === 0 ? "Nada à venda de momento." : "Nenhum resultado encontrado."}
            </p>
          ) : (
            <div className="-mx-4 space-y-1 sm:-mx-8">
              {filteredResaleBundles.length > 0 && (
                <HorizontalScrollRow title="Bundles">
                  {filteredResaleBundles.map((bundle) => (
                    <div key={bundle.id} className="w-64 shrink-0 sm:w-72">
                      <ResaleBundleTile bundle={bundle} />
                    </div>
                  ))}
                </HorizontalScrollRow>
              )}
              {Array.from(resaleListingsByCategory.entries()).map(([cat, list]) => (
                <HorizontalScrollRow key={cat} title={cat}>
                  {list.map((listing) => (
                    <div key={listing.id} className="w-64 shrink-0 sm:w-72">
                      <ResaleListingTile listing={listing} />
                    </div>
                  ))}
                </HorizontalScrollRow>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {activeFilters.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => removeFilter(f.key)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-400 bg-slate-200 px-3 py-1 text-xs font-medium text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
                >
                  {f.label}
                  <X size={12} />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Limpar tudo
              </button>
            </div>
          )}

          {courses.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">Ainda não tem cursos publicados.</p>
          ) : filtered.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">Nenhum curso encontrado.</p>
          ) : sort ? (
            <div className="-mx-4 sm:-mx-8">
              <CourseRow title="Resultados" courses={filtered} hidePriceBySlug={hidePriceBySlug} />
            </div>
          ) : (
            <div className="-mx-4 space-y-1 sm:-mx-8">
              {Array.from(coursesByCategory.entries()).map(([cat, list]) => (
                <CourseRow key={cat} title={cat} courses={list} hidePriceBySlug={hidePriceBySlug} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
