import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Sugestões ao vivo do dropdown do MarketplaceSearchBar — atalho direto para
// uma listagem/bundle/vendedor específico, por cima da grelha que já vai
// encolhendo sozinha por baixo (mesma ideia do /api/courses/search).
export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!term) return NextResponse.json({ listings: [], bundles: [], sellers: [] });

  const [listings, bundles, sellers] = await Promise.all([
    prisma.resaleListing.findMany({
      where: {
        active: true,
        resaleBundleId: null,
        OR: [
          { course: { title: { contains: term, mode: "insensitive" } } },
          { seller: { name: { contains: term, mode: "insensitive" } } },
        ],
      },
      select: { id: true, course: { select: { slug: true, title: true, thumbnailUrl: true } } },
      take: 6,
    }),
    prisma.resaleBundle.findMany({
      where: {
        listings: { some: { active: true } },
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { seller: { name: { contains: term, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        coverImageUrl: true,
        listings: { where: { active: true }, select: { course: { select: { thumbnailUrl: true } } }, take: 1 },
      },
      take: 4,
    }),
    prisma.user.findMany({
      where: {
        AND: [
          { OR: [{ name: { contains: term, mode: "insensitive" } }, { username: { contains: term, mode: "insensitive" } }] },
          {
            OR: [
              { resaleListingsSold: { some: { active: true } } },
              { resaleBundlesSold: { some: { listings: { some: { active: true } } } } },
            ],
          },
        ],
      },
      select: { id: true, name: true, username: true, image: true, role: true },
      take: 4,
    }),
  ]);

  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id,
      courseSlug: l.course.slug,
      courseTitle: l.course.title,
      courseThumbnailUrl: l.course.thumbnailUrl,
    })),
    bundles: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      thumbnailUrl: b.coverImageUrl ?? b.listings[0]?.course.thumbnailUrl ?? null,
    })),
    sellers,
  });
}
