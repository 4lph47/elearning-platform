"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  FilterPanel,
  SORT_OPTIONS,
  LEVEL_OPTIONS,
  RESULT_TYPE_OPTIONS,
  MAX_PRICE_CEIL,
  type FilterValues,
} from "@/components/course/FilterPanel";
import { useFadeNav } from "@/components/course/FadeNavContext";

const SEARCH_DEBOUNCE_MS = 400;
const SUGGEST_DEBOUNCE_MS = 250;

interface CourseSuggestion {
  slug: string;
  title: string;
  thumbnailUrl: string | null;
}
interface BundleSuggestion {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  kind: "resale" | "instructor";
  instructorId: string | null;
}
interface InstructorSuggestion {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}
interface Suggestions {
  courses: CourseSuggestion[];
  bundles: BundleSuggestion[];
  instructors: InstructorSuggestion[];
}
const EMPTY_SUGGESTIONS: Suggestions = { courses: [], bundles: [], instructors: [] };

export function SearchBar({ categories: allCategories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { fadeNavigate } = useFadeNav();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY_SUGGESTIONS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLFormElement>(null);

  const selectedCategories = (searchParams.get("category") ?? "").split(",").filter(Boolean);
  const level = searchParams.get("level") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const resultType = searchParams.get("type") ?? "";
  const maxPrice = searchParams.get("maxPrice");
  const minDuration = searchParams.get("minDuration");
  const minEnrollments = searchParams.get("minEnrollments");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Remover um filtro já aplicado muda a lista de cursos visível (ao
  // contrário de digitar no campo de texto, que só atualiza depois do
  // debounce) — por isso passa por fadeNavigate, igual ao "Aplicar filtros"
  // do painel, em vez do router.push instantâneo do updateParam acima.
  function removeFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    fadeNavigate(`${pathname}?${params.toString()}`);
  }

  // Atualiza sozinho pouco depois de parar de escrever — sem esperar por
  // Enter/submit, mas também sem disparar um pedido a cada letra.
  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return; // sem mudança real (ex.: no mount) — não navega à toa
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", q), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("q", q);
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  // Dropdown de atalho direto (curso/instrutor/bundle específico) por cima
  // da lista de cursos que já vai encolhendo sozinha por baixo — mesma ideia
  // do dropdown da Navbar (pesquisa ao vivo), só que sem recentes/melhores
  // ofertas/voz, que já não fazem sentido dentro do próprio catálogo.
  useEffect(() => {
    if (!focused) return;
    const term = q.trim();
    if (!term) {
      setSuggestions(EMPTY_SUGGESTIONS);
      return;
    }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(term)}`)
        .then((res) => (res.ok ? res.json() : EMPTY_SUGGESTIONS))
        .then((data) => setSuggestions({ courses: data.courses ?? [], bundles: data.bundles ?? [], instructors: data.instructors ?? [] }))
        .catch(() => setSuggestions(EMPTY_SUGGESTIONS));
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [q, focused]);

  useEffect(() => {
    if (!focused) return;
    function onOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [focused]);

  function closeSuggestions() {
    setFocused(false);
    setSuggestions(EMPTY_SUGGESTIONS);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function selectCourse(item: CourseSuggestion) {
    closeSuggestions();
    fadeNavigate(`/courses/${item.slug}`);
  }

  function selectBundle(item: BundleSuggestion) {
    closeSuggestions();
    fadeNavigate(item.kind === "resale" ? `/resale/bundles/${item.id}` : `/instructors/${item.instructorId}`);
  }

  function selectInstructor(item: InstructorSuggestion) {
    closeSuggestions();
    fadeNavigate(`/instructors/${item.id}`);
  }

  const hasSuggestions =
    suggestions.courses.length > 0 || suggestions.bundles.length > 0 || suggestions.instructors.length > 0;

  // fadeNavigate (não router.push direto): a próxima página carrega em fundo
  // (startTransition) e só quando acabar de processar é que a cortina
  // esmorece — nunca mostra a página nova a meio de carregar.
  function applyFilters(values: FilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    set("sort", values.sort);
    set("type", values.resultType);
    set("category", values.categories.join(","));
    set("level", values.level);
    set("maxPrice", values.maxPrice < MAX_PRICE_CEIL ? String(values.maxPrice) : "");
    set("minDuration", values.minDuration > 0 ? String(values.minDuration) : "");
    set("minEnrollments", values.minEnrollments > 0 ? String(values.minEnrollments) : "");
    fadeNavigate(`${pathname}?${params.toString()}`);
  }

  const activeFilters = [
    resultType ? { key: "type", label: RESULT_TYPE_OPTIONS.find((t) => t.value === resultType)?.label ?? resultType } : null,
    ...selectedCategories.map((c) => ({ key: `category:${c}`, label: c })),
    level ? { key: "level", label: LEVEL_OPTIONS.find((l) => l.value === level)?.label ?? level } : null,
    sort ? { key: "sort", label: SORT_OPTIONS.find((s) => s.value === sort)?.label ?? sort } : null,
    maxPrice ? { key: "maxPrice", label: `Até ${maxPrice}€` } : null,
    minDuration ? { key: "minDuration", label: `${minDuration}h+` } : null,
    minEnrollments ? { key: "minEnrollments", label: `${minEnrollments}+ alunos` } : null,
  ].filter((f): f is { key: string; label: string } => f !== null);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form ref={wrapRef} onSubmit={submit} className="relative flex-1 sm:max-w-md">
          <input
            placeholder="Procurar cursos..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />

          {focused && hasSuggestions && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
              {suggestions.courses.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCourse(item)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
                    {item.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.title}</span>
                </button>
              ))}
              {suggestions.instructors.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectInstructor(u)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {u.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
                    <span className="block truncate text-xs text-slate-400 dark:text-slate-500">Instrutor</span>
                  </span>
                </button>
              ))}
              {suggestions.bundles.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectBundle(b)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
                    {b.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{b.name}</span>
                    <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                      {b.kind === "resale" ? "Bundle à venda" : "Pacote do instrutor"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

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
              onClick={() =>
                f.key.startsWith("category:")
                  ? removeFilter("category", selectedCategories.filter((c) => c !== f.key.slice("category:".length)).join(","))
                  : removeFilter(f.key, "")
              }
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-400 bg-slate-200 px-3 py-1 text-xs font-medium text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
            >
              {f.label}
              <X size={12} />
            </button>
          ))}
          <button
            type="button"
            onClick={() => fadeNavigate(pathname)}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {panelOpen && (
        <FilterPanel
          categories={allCategories}
          values={{
            sort,
            resultType,
            categories: selectedCategories,
            level,
            maxPrice: maxPrice ? Number(maxPrice) : MAX_PRICE_CEIL,
            minDuration: minDuration ? Number(minDuration) : 0,
            minEnrollments: minEnrollments ? Number(minEnrollments) : 0,
          }}
          onApply={applyFilters}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
