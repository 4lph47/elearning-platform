import { getServerSession } from "next-auth";
import { Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FadeLink } from "@/components/course/FadeLink";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { CommunityTile, type CommunityCardData } from "@/components/community/CommunityTile";
import { CommunitySearchBar } from "@/components/community/CommunitySearchBar";

export const dynamic = "force-dynamic";

type CommunitiesSearchParams = Promise<{ q?: string; category?: string }>;

// Listagem em filas horizontais por categoria, igual ao catálogo de cursos
// (app/courses/page.tsx) — só que de comunidades em vez de cursos, com a
// mesma busca+filtro por categoria (CommunitySearchBar espelha o SearchBar
// do catálogo).
export default async function CommunitiesPage({ searchParams }: { searchParams: CommunitiesSearchParams }) {
  const { q, category } = await searchParams;
  const session = await getServerSession(authOptions);
  const term = (q ?? "").trim();
  const selectedCategories = (category ?? "").split(",").filter(Boolean);

  const communities = await prisma.community.findMany({
    where: {
      ...(term
        ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } }] }
        : {}),
      ...(selectedCategories.length > 0 ? { category: { in: selectedCategories } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });

  const allCategories = (
    await prisma.community.findMany({ distinct: ["category"], select: { category: true } })
  ).map((c) => c.category);

  const cards: CommunityCardData[] = communities.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    coverImageUrl: c.coverImageUrl,
    memberCount: c._count.members,
  }));

  const myCommunityIds = session
    ? new Set(
        (await prisma.communityMember.findMany({ where: { userId: session.user.id }, select: { communityId: true } })).map(
          (m) => m.communityId
        )
      )
    : new Set<string>();
  const myCards = cards.filter((c) => myCommunityIds.has(c.id));

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

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/60 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <CommunitySearchBar categories={allCategories} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl py-3">
        {cards.length === 0 ? (
          <p className="px-4 text-slate-500 dark:text-slate-400 sm:px-8">
            {term || selectedCategories.length > 0
              ? "Nenhuma comunidade encontrada."
              : "Ainda não existe nenhuma comunidade — cria a primeira."}
          </p>
        ) : (
          <>
            {myCards.length > 0 && (
              <HorizontalScrollRow title="As tuas comunidades">
                {myCards.map((c) => (
                  <div key={c.id} className="w-64 shrink-0 sm:w-72">
                    <CommunityTile community={c} />
                  </div>
                ))}
              </HorizontalScrollRow>
            )}
            {Array.from(byCategory.entries()).map(([cat, list]) => (
              <HorizontalScrollRow key={cat} title={cat}>
                {list.map((c) => (
                  <div key={c.id} className="w-64 shrink-0 sm:w-72">
                    <CommunityTile community={c} />
                  </div>
                ))}
              </HorizontalScrollRow>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
