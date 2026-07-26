"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  MarketplaceFilterPanel,
  MARKETPLACE_TYPE_OPTIONS,
  MARKETPLACE_MAX_PRICE_CEIL,
  type MarketplaceFilterValues,
} from "@/components/resale/MarketplaceFilterPanel";
import { useFadeNav } from "@/components/course/FadeNavContext";

const SEARCH_DEBOUNCE_MS = 400;

// Mesma estrutura/interação do SearchBar do catálogo (components/course/SearchBar.tsx)
// — input + pastilha "Filtros" com painel de ecrã inteiro — só que sobre o
// conjunto de parâmetros mais pequeno do marketplace (tipo + preço).
export function MarketplaceSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { fadeNavigate } = useFadeNav();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const type = searchParams.get("type") ?? "";
  const maxPrice = searchParams.get("maxPrice");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    fadeNavigate(`${pathname}?${params.toString()}`);
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("q", q);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function applyFilters(values: MarketplaceFilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    set("type", values.type);
    set("maxPrice", values.maxPrice < MARKETPLACE_MAX_PRICE_CEIL ? String(values.maxPrice) : "");
    fadeNavigate(`${pathname}?${params.toString()}`);
  }

  const activeFilters = [
    type ? { key: "type", label: MARKETPLACE_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type } : null,
    maxPrice ? { key: "maxPrice", label: `Até ${maxPrice}€` } : null,
  ].filter((f): f is { key: string; label: string } => f !== null);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form onSubmit={submit} className="relative flex-1 sm:max-w-md">
          <input
            placeholder="Procurar cursos, bundles ou vendedores..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
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
              onClick={() => removeFilter(f.key)}
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
        <MarketplaceFilterPanel
          values={{ type, maxPrice: maxPrice ? Number(maxPrice) : MARKETPLACE_MAX_PRICE_CEIL }}
          onApply={applyFilters}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
