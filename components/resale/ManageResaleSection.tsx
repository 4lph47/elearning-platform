"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { ResaleListingTile, ResaleBundleTile } from "@/components/resale/ResaleTile";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

export interface EligibleCourse {
  id: string;
  title: string;
  minCommission: number;
}

function pillClass(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    active
      ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
  }`;
}

// Listas horizontais iguais ao catálogo, sem CollapsibleCard nenhum a
// esconder tudo atrás dum clique — só isto e o formulário de criar é que
// vivem aqui. Editar uma listagem ou bundle já existente é só clicar no
// tile: o link do ResaleListingTile já leva à própria página do curso
// (?resale=id), onde o dono vê o CRUD completo (ManageResaleListingCard);
// o do ResaleBundleTile leva à página do bundle, que mostra "Editar bundle"
// ao dono. Nenhum dos dois precisa de UI de edição duplicada aqui.
export function ManageResaleSection({
  eligibleCourses,
  listings,
  bundles,
  canCreateBundle,
}: {
  eligibleCourses: EligibleCourse[];
  listings: ResaleListingCardData[];
  bundles: ResaleBundleCardData[];
  canCreateBundle: boolean;
}) {
  const router = useRouter();
  const [priceByCourse, setPriceByCourse] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  const allCategories = useMemo(
    () =>
      Array.from(new Set([...listings.map((l) => l.courseCategory), ...bundles.map((b) => b.category ?? "Outros")])).sort(
        (a, b) => a.localeCompare(b)
      ),
    [listings, bundles]
  );

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter(
      (l) =>
        (!q || l.courseTitle.toLowerCase().includes(q)) && (categories.length === 0 || categories.includes(l.courseCategory))
    );
  }, [listings, query, categories]);

  const filteredBundles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bundles.filter(
      (b) =>
        (!q || b.name.toLowerCase().includes(q) || b.courseTitles.some((t) => t.toLowerCase().includes(q))) &&
        (categories.length === 0 || categories.includes(b.category ?? "Outros"))
    );
  }, [bundles, query, categories]);

  if (eligibleCourses.length === 0 && listings.length === 0 && bundles.length === 0) return null;

  async function handleError(res: Response) {
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Erro ao processar pedido");
  }

  async function createListing(courseId: string) {
    setError(null);
    const price = Number(priceByCourse[courseId]);
    if (!price || price <= 0) {
      setError("Indica um preço válido");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/resale/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, price }),
    });
    setBusy(false);
    if (!res.ok) return handleError(res);
    router.refresh();
  }

  const hasResults = filteredListings.length > 0 || filteredBundles.length > 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {eligibleCourses.length > 0 && (
        <div>
          <Label>Cursos que podes vender</Label>
          <div className="space-y-2">
            {eligibleCourses.map((course) => {
              const price = Number(priceByCourse[course.id]);
              const validPrice = price >= course.minCommission;
              const sellerCut = validPrice ? price - course.minCommission : null;
              return (
                <div key={course.id} className="rounded-md border border-slate-200 p-2 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{course.title}</span>
                    <Input
                      type="number"
                      min={course.minCommission}
                      step="0.01"
                      placeholder="Preço"
                      value={priceByCourse[course.id] ?? ""}
                      onChange={(e) => setPriceByCourse((prev) => ({ ...prev, [course.id]: e.target.value }))}
                      className="w-24"
                    />
                    <Button type="button" variant="outline" disabled={busy} onClick={() => createListing(course.id)}>
                      Colocar à venda
                    </Button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Comissão do instrutor (fixa): <span className="font-medium text-slate-700 dark:text-slate-200">{course.minCommission.toFixed(2)}€</span>
                    </span>
                    <span>
                      A tua parte:{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {sellerCut !== null ? `${sellerCut.toFixed(2)}€` : "—"}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(bundles.length > 0 || listings.length > 0) && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar nas tuas revendas..."
                className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
              />
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            <div ref={panelRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className={`flex h-full shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  categories.length > 0
                    ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                <SlidersHorizontal size={15} />
                Filtros
                {categories.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                    {categories.length}
                  </span>
                )}
              </button>
              {panelOpen && allCategories.length > 0 && (
                <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-neutral-900">
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
            </div>
          </div>

          {categories.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {categories.map((c) => (
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
                onClick={() => setCategories([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Limpar tudo
              </button>
            </div>
          )}

          {!hasResults ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum resultado encontrado.</p>
          ) : (
            <div className="-mx-4 space-y-1 sm:-mx-8">
              {filteredBundles.length > 0 && (
                <HorizontalScrollRow title="Os teus bundles">
                  {filteredBundles.map((b) => (
                    <div key={b.id} className="w-64 shrink-0 sm:w-72">
                      <ResaleBundleTile bundle={b} />
                    </div>
                  ))}
                </HorizontalScrollRow>
              )}
              {filteredListings.length > 0 && (
                <HorizontalScrollRow title="As tuas listagens">
                  {filteredListings.map((l) => (
                    <div key={l.id} className="relative w-64 shrink-0 sm:w-72">
                      {l.active === false && (
                        <span className="absolute left-2 top-2 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Desativada
                        </span>
                      )}
                      <ResaleListingTile listing={l} />
                    </div>
                  ))}
                </HorizontalScrollRow>
              )}
            </div>
          )}
        </div>
      )}

      {canCreateBundle && (
        <FadeLink
          href="/resale/bundles/new"
          className="flex w-fit items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
        >
          <Plus size={14} /> Criar bundle
        </FadeLink>
      )}
    </div>
  );
}
