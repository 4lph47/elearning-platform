import { getServerSession } from "next-auth";
import { Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FadeLink } from "@/components/course/FadeLink";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { CommunityTile, type CommunityCardData } from "@/components/community/CommunityTile";

export const dynamic = "force-dynamic";

// Listagem em filas horizontais por categoria, igual ao catálogo de cursos
// (app/courses/page.tsx) — só que de comunidades em vez de cursos.
export default async function CommunitiesPage() {
  const session = await getServerSession(authOptions);

  const communities = await prisma.community.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });

  const cards: CommunityCardData[] = communities.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    coverImageUrl: c.coverImageUrl,
    memberCount: c._count.members,
  }));

  const byCategory = new Map<string, CommunityCardData[]>();
  for (const c of cards) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-100 to-white px-4 py-5 dark:border-white/10 dark:from-slate-900 dark:to-black sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">Comunidades</h1>
            <p className="mt-2 hidden max-w-xl text-slate-600 dark:text-slate-400 sm:block">
              Junta-te a grupos de alunos e instrutores para debater, partilhar recursos e ficheiros.
            </p>
          </div>
          {session && (
            <FadeLink
              href="/communities/new"
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={15} /> Criar comunidade
            </FadeLink>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl py-3">
        {cards.length === 0 ? (
          <p className="px-4 text-slate-500 dark:text-slate-400 sm:px-8">
            Ainda não existe nenhuma comunidade — cria a primeira.
          </p>
        ) : (
          Array.from(byCategory.entries()).map(([cat, list]) => (
            <HorizontalScrollRow key={cat} title={cat}>
              {list.map((c) => (
                <div key={c.id} className="w-64 shrink-0 sm:w-72">
                  <CommunityTile community={c} />
                </div>
              ))}
            </HorizontalScrollRow>
          ))
        )}
      </div>
    </div>
  );
}
