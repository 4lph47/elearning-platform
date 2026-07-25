import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Prefixo "@" muda o modo: em vez de cursos/bundles, pesquisa pessoas (por
// nome OU username). Sem "@", comportamento de sempre (cursos + bundles de
// revenda à venda que combinam com o termo).
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!raw) return NextResponse.json({ courses: [], bundles: [], users: [] });

  if (raw.startsWith("@")) {
    const term = raw.slice(1).trim();
    if (!term) return NextResponse.json({ courses: [], bundles: [], users: [] });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { username: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, username: true, image: true, role: true },
      take: 6,
    });
    return NextResponse.json({ courses: [], bundles: [], users });
  }

  const [courses, bundles] = await Promise.all([
    prisma.course.findMany({
      where: { published: true, title: { contains: raw, mode: "insensitive" } },
      select: { slug: true, title: true, thumbnailUrl: true },
      orderBy: { ratingCount: "desc" },
      take: 6,
    }),
    prisma.resaleBundle.findMany({
      where: { name: { contains: raw, mode: "insensitive" }, listings: { some: { active: true } } },
      select: {
        id: true,
        name: true,
        listings: { where: { active: true }, select: { course: { select: { thumbnailUrl: true } } }, take: 1 },
      },
      take: 3,
    }),
  ]);

  const bundleResults = bundles.map((b) => ({
    id: b.id,
    name: b.name,
    thumbnailUrl: b.listings[0]?.course.thumbnailUrl ?? null,
  }));

  return NextResponse.json({ courses, bundles: bundleResults, users: [] });
}
