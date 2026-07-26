import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { MarketplaceSearchBar } from "@/components/resale/MarketplaceSearchBar";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { ResaleListingTile, ResaleBundleTile } from "@/components/resale/ResaleTile";
import { PeopleRow, type PersonResult } from "@/components/course/SearchExtras";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

export const dynamic = "force-dynamic";

type MarketplaceSearchParams = Promise<{ q?: string; type?: string; maxPrice?: string }>;

// Descoberta pública de revendas — sem isto, uma listagem só era alcançável
// via URL do perfil do vendedor (ver app/students/[id]/page.tsx e
// app/instructors/[id]/page.tsx, que já mostram as revendas de cada um na
// aba "À venda"). Aqui agrega todas, de todos os vendedores, com a mesma
// disposição em secções horizontais do catálogo (app/courses/page.tsx).
export default function MarketplacePage({ searchParams }: { searchParams: MarketplaceSearchParams }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-100 to-white px-4 py-5 dark:border-white/10 dark:from-slate-900 dark:to-black sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">Marketplace de Revenda</h1>
          <p className="mt-2 hidden max-w-xl text-slate-600 dark:text-slate-400 sm:block">
            Cursos e bundles revendidos por alunos e instrutores que já os terminaram.
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/60 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <MarketplaceSearchBar />
        </div>
      </div>

      <Suspense fallback={<MarketplaceSkeleton />}>
        <MarketplaceResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-6 sm:px-8">
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-video rounded-lg bg-slate-200 dark:bg-white/10" />
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function MarketplaceResults({ searchParams }: { searchParams: MarketplaceSearchParams }) {
  const { q, type, maxPrice } = await searchParams;
  const term = (q ?? "").trim();
  const resultType = type ?? "";
  const maxPriceNum = maxPrice ? Number(maxPrice) : null;

  const showListings = resultType === "" || resultType === "listings";
  const showBundlesSection = resultType === "" || resultType === "bundles";
  const roleFilter = resultType === "students" ? "STUDENT" : resultType === "instructors" ? "INSTRUCTOR" : null;

  const [listings, resaleBundles, activeListingSellers, activeBundleSellers] = await Promise.all([
    showListings
      ? prisma.resaleListing.findMany({
          where: {
            active: true,
            bundles: { none: {} },
            ...(term
              ? { OR: [{ course: { title: { contains: term, mode: "insensitive" } } }, { seller: { name: { contains: term, mode: "insensitive" } } }] }
              : {}),
            ...(maxPriceNum !== null ? { price: { lte: maxPriceNum } } : {}),
          },
          orderBy: { createdAt: "desc" },
          include: {
            course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } },
            seller: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    showBundlesSection
      ? prisma.resaleBundle.findMany({
          where: {
            listings: { some: { listing: { active: true } } },
            ...(term
              ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { seller: { name: { contains: term, mode: "insensitive" } } }] }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          include: {
            seller: { select: { id: true, name: true } },
            listings: {
              where: { listing: { active: true } },
              include: { listing: { include: { course: { select: { title: true, thumbnailUrl: true, category: true } } } } },
            },
          },
        })
      : Promise.resolve([]),
    prisma.resaleListing.findMany({ where: { active: true }, select: { sellerId: true }, distinct: ["sellerId"] }),
    prisma.resaleBundle.findMany({
      where: { listings: { some: { listing: { active: true } } } },
      select: { sellerId: true },
      distinct: ["sellerId"],
    }),
  ]);

  const listingCards: ResaleListingCardData[] = listings.map((listing) => ({
    id: listing.id,
    price: listing.price,
    courseSlug: listing.course.slug,
    courseTitle: listing.course.title,
    courseThumbnailUrl: listing.course.thumbnailUrl,
    courseCategory: listing.course.category,
    courseLevel: listing.course.level,
    sellerId: listing.seller.id,
    sellerName: listing.seller.name,
  }));

  const bundleCards: ResaleBundleCardData[] = resaleBundles
    .map((bundle) => ({ ...bundle, listings: bundle.listings.map((bl) => bl.listing) }))
    .filter((bundle) => bundle.listings.length > 0)
    .map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      coverImageUrl: bundle.coverImageUrl ?? bundle.listings[0]?.course.thumbnailUrl ?? null,
      price: bundle.listings.reduce((sum, l) => sum + l.price, 0),
      listingCount: bundle.listings.length,
      courseTitles: bundle.listings.map((l) => l.course.title),
      sellerId: bundle.seller.id,
      sellerName: bundle.seller.name,
      // Bundle não tem categoria própria — agrupa pela do primeiro curso
      // incluído, só para conseguir juntar-se à secção certa por baixo.
      category: bundle.listings[0]?.course.category ?? "Outros",
    }))
    .filter((b) => maxPriceNum === null || b.price <= maxPriceNum);

  // Pessoas: sempre computada, independente do filtro de tipo (mesmo sem
  // "Alunos"/"Instrutores" selecionado já aparece, ordenada por "status" —
  // vendas de revenda + reputação de instrutor/conclusões de aluno).
  const sellerIds = Array.from(new Set([...activeListingSellers, ...activeBundleSellers].map((s) => s.sellerId)));

  const [sellers, sales] = await Promise.all([
    sellerIds.length > 0
      ? prisma.user.findMany({
          where: {
            id: { in: sellerIds },
            ...(roleFilter ? { role: roleFilter } : {}),
            ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { username: { contains: term, mode: "insensitive" } }] } : {}),
          },
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            role: true,
            coursesTaught: { where: { published: true }, select: { rating: true, ratingCount: true, _count: { select: { enrollments: true } } } },
            _count: { select: { enrollments: { where: { completedAt: { not: null } } } } },
          },
        })
      : Promise.resolve([]),
    sellerIds.length > 0
      ? prisma.resaleSale.findMany({ where: { listing: { sellerId: { in: sellerIds } } }, select: { listing: { select: { sellerId: true } } } })
      : Promise.resolve([]),
  ]);

  const salesCountBySeller = new Map<string, number>();
  for (const sale of sales) {
    const id = sale.listing.sellerId;
    salesCountBySeller.set(id, (salesCountBySeller.get(id) ?? 0) + 1);
  }

  function statusScore(u: (typeof sellers)[number]) {
    const salesScore = (salesCountBySeller.get(u.id) ?? 0) * 5;
    const instructorScore = u.coursesTaught.reduce(
      (sum, c) => sum + c.rating * 20 + c.ratingCount * 2 + c._count.enrollments,
      0
    );
    const studentScore = u._count.enrollments * 3;
    return salesScore + (u.role === "INSTRUCTOR" ? instructorScore : studentScore);
  }

  const peopleResults: PersonResult[] = [...sellers]
    .sort((a, b) => statusScore(b) - statusScore(a))
    .map((u) => ({ id: u.id, name: u.name, username: u.username, image: u.image, role: u.role }));

  const isEmpty = listingCards.length === 0 && bundleCards.length === 0 && peopleResults.length === 0;

  // Cursos e bundles à venda, separados por categoria (Fotografia, Negócios,
  // ...) tal como o catálogo — cada secção junta os bundles dessa categoria
  // (categoria do 1º curso incluído) com os cursos individuais dela.
  const categoriesInOrder = Array.from(
    new Set([...listingCards.map((l) => l.courseCategory), ...bundleCards.map((b) => b.category ?? "Outros")])
  );

  return (
    <div className="mx-auto max-w-6xl py-3">
      {isEmpty ? (
        <p className="px-4 text-slate-500 dark:text-slate-400 sm:px-8">Ainda não há nada à venda no marketplace.</p>
      ) : (
        <>
          <PeopleRow people={peopleResults} />
          {categoriesInOrder.map((cat) => {
            const catBundles = showBundlesSection ? bundleCards.filter((b) => (b.category ?? "Outros") === cat) : [];
            const catListings = showListings ? listingCards.filter((l) => l.courseCategory === cat) : [];
            if (catBundles.length === 0 && catListings.length === 0) return null;
            return (
              <HorizontalScrollRow key={cat} title={cat}>
                {catBundles.map((b) => (
                  <div key={b.id} className="w-64 shrink-0 sm:w-72">
                    <ResaleBundleTile bundle={b} showSeller />
                  </div>
                ))}
                {catListings.map((listing) => (
                  <div key={listing.id} className="w-64 shrink-0 sm:w-72">
                    <ResaleListingTile listing={listing} showSeller />
                  </div>
                ))}
              </HorizontalScrollRow>
            );
          })}
        </>
      )}
    </div>
  );
}
