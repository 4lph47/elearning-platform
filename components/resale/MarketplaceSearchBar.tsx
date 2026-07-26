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
const SUGGEST_DEBOUNCE_MS = 250;

interface ListingSuggestion {
  id: string;
  courseSlug: string;
  courseTitle: string;
  courseThumbnailUrl: string | null;
}
interface BundleSuggestion {
  id: string;
  name: string;
  thumbnailUrl: string | null;
}
interface SellerSuggestion {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}
interface Suggestions {
  listings: ListingSuggestion[];
  bundles: BundleSuggestion[];
  sellers: SellerSuggestion[];
}
const EMPTY_SUGGESTIONS: Suggestions = { listings: [], bundles: [], sellers: [] };

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
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY_SUGGESTIONS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLFormElement>(null);

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
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  useEffect(() => {
    if (!focused) return;
    const term = q.trim();
    if (!term) {
      setSuggestions(EMPTY_SUGGESTIONS);
      return;
    }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => {
      fetch(`/api/marketplace/search?q=${encodeURIComponent(term)}`)
        .then((res) => (res.ok ? res.json() : EMPTY_SUGGESTIONS))
        .then((data) =>
          setSuggestions({ listings: data.listings ?? [], bundles: data.bundles ?? [], sellers: data.sellers ?? [] })
        )
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

  function selectListing(item: ListingSuggestion) {
    closeSuggestions();
    fadeNavigate(`/courses/${item.courseSlug}?resale=${item.id}`);
  }

  function selectBundle(item: BundleSuggestion) {
    closeSuggestions();
    fadeNavigate(`/resale/bundles/${item.id}`);
  }

  function selectSeller(item: SellerSuggestion) {
    closeSuggestions();
    fadeNavigate(item.role === "STUDENT" ? `/students/${item.id}` : `/instructors/${item.id}`);
  }

  const hasSuggestions =
    suggestions.listings.length > 0 || suggestions.bundles.length > 0 || suggestions.sellers.length > 0;

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
        <form ref={wrapRef} onSubmit={submit} className="relative flex-1 sm:max-w-md">
          <input
            placeholder="Procurar cursos, bundles ou vendedores..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />

          {focused && hasSuggestions && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
              {suggestions.listings.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectListing(item)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
                    {item.courseThumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.courseThumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.courseTitle}</span>
                </button>
              ))}
              {suggestions.sellers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSeller(u)}
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
                    <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                      {u.role === "STUDENT" ? "Aluno" : "Instrutor"}
                    </span>
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
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{b.name}</span>
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
