"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useFadeNav } from "@/components/course/FadeNavContext";

const SEARCH_DEBOUNCE_MS = 400;

function pillClass(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    active
      ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
  }`;
}

// Mesma estrutura do SearchBar do catálogo (components/course/SearchBar.tsx)
// — input com debounce + pastilha "Filtros" com categorias — só que sobre
// comunidades (nome/descrição + categoria), sem sort/nível/preço.
export function CommunitySearchBar({ categories: allCategories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { fadeNavigate } = useFadeNav();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedCategories = (searchParams.get("category") ?? "").split(",").filter(Boolean);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (q === (searchParams.get("q") ?? "")) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", q), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!panelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("q", q);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function toggleCategory(c: string) {
    const next = selectedCategories.includes(c) ? selectedCategories.filter((x) => x !== c) : [...selectedCategories, c];
    fadeNavigate(`${pathname}?${(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length > 0) params.set("category", next.join(","));
      else params.delete("category");
      return params.toString();
    })()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form onSubmit={submit} className="relative flex-1 sm:max-w-md">
          <input
            placeholder="Procurar comunidades..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </form>

        <div ref={panelRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className={`flex h-full shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategories.length > 0
                ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {selectedCategories.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                {selectedCategories.length}
              </span>
            )}
          </button>

          {panelOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-neutral-900">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</h3>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((c) => (
                  <button key={c} type="button" onClick={() => toggleCategory(c)} className={pillClass(selectedCategories.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedCategories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-400 bg-slate-200 px-3 py-1 text-xs font-medium text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
            >
              {c}
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
    </div>
  );
}
