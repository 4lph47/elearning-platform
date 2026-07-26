"use client";

import { useMemo } from "react";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { CommunityTile, type CommunityCardData } from "@/components/community/CommunityTile";

// Fila de comunidades — usada onde quer que uma lista de comunidades apareça
// fora da página /communities (que já tem o seu próprio CommunitySearchBar):
// perfis públicos de aluno/instrutor, por agora. Filtra pela mesma busca da
// grelha de cursos da página (query vem do componente pai) — só uma barra de
// pesquisa no ecrã, sem uma segunda só para comunidades.
export function CommunityRow({
  title,
  communities,
  query = "",
}: {
  title: string;
  communities: CommunityCardData[];
  query?: string;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [communities, query]);

  if (communities.length === 0) return null;

  return (
    <HorizontalScrollRow title={title}>
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
