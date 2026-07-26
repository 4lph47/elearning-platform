"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { CommunityTile, type CommunityCardData } from "@/components/community/CommunityTile";

// Fila de comunidades com busca embutida — usada onde quer que uma lista de
// comunidades apareça fora da página /communities (que já tem o seu próprio
// CommunitySearchBar): perfis públicos de aluno/instrutor, por agora.
export function CommunityRow({ title, communities }: { title: string; communities: CommunityCardData[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [communities, query]);

  if (communities.length === 0) return null;

  return (
    <HorizontalScrollRow
      title={title}
      titleExtra={
        communities.length > 1 ? (
          <div className="relative w-full max-w-[200px] shrink-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Procurar comunidade..."
              className="w-full rounded-full border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
            />
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        ) : undefined
      }
    >
      {filtered.length === 0 ? (
        <p className="px-1 text-sm text-slate-500 dark:text-slate-400">Nenhuma comunidade encontrada.</p>
      ) : (
        filtered.map((c) => (
          <div key={c.id} className="w-64 shrink-0 sm:w-72">
            <CommunityTile community={c} />
          </div>
        ))
      )}
    </HorizontalScrollRow>
  );
}
