"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ResaleListingTile, ResaleBundleTile } from "@/components/resale/ResaleTile";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

// Igual em espírito ao StudentCourseGrid/InstructorCourseGrid (pesquisa
// local, sem router/URL) — aqui sobre revendas de TODOS os vendedores, não
// só de um perfil.
export function MarketplaceGrid({
  listings,
  bundles,
}: {
  listings: ResaleListingCardData[];
  bundles: ResaleBundleCardData[];
}) {
  const [query, setQuery] = useState("");

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter(
      (l) => l.courseTitle.toLowerCase().includes(q) || l.courseCategory.toLowerCase().includes(q) || l.sellerName.toLowerCase().includes(q)
    );
  }, [listings, query]);

  const filteredBundles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bundles;
    return bundles.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.sellerName.toLowerCase().includes(q) ||
        b.courseTitles.some((t) => t.toLowerCase().includes(q))
    );
  }, [bundles, query]);

  const isEmpty = listings.length === 0 && bundles.length === 0;
  const noResults = !isEmpty && filteredListings.length === 0 && filteredBundles.length === 0;

  return (
    <div>
      {!isEmpty && (
        <div className="relative mb-6 max-w-xl">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar cursos, bundles ou vendedores..."
            className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      )}

      {isEmpty ? (
        <p className="text-slate-500 dark:text-slate-400">Ainda não há nada à venda no marketplace.</p>
      ) : noResults ? (
        <p className="text-slate-500 dark:text-slate-400">Nenhum resultado encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBundles.map((bundle) => (
            <ResaleBundleTile key={bundle.id} bundle={bundle} showSeller />
          ))}
          {filteredListings.map((listing) => (
            <ResaleListingTile key={listing.id} listing={listing} showSeller />
          ))}
        </div>
      )}
    </div>
  );
}
