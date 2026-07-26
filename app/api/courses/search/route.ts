import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// Prefixo "@" muda o modo: em vez de cursos/instrutores/bundles, pesquisa
// pessoas (por nome OU username). Sem "@", cursos (também por nome do
// instrutor), instrutores e bundles à venda (revenda no marketplace E
// bundles do próprio instrutor) que combinem com o termo.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!raw) return NextResponse.json({ courses: [], bundles: [], users: [], instructors: [] });

  if (raw.startsWith("@")) {
    const term = raw.slice(1).trim();
    if (!term) return NextResponse.json({ courses: [], bundles: [], users: [], instructors: [] });

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
    return NextResponse.json({ courses: [], bundles: [], users, instructors: [] });
  }

  const [courses, instructors, resaleBundles, instructorBundles] = await Promise.all([
    prisma.course.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: raw, mode: "insensitive" } },
          { instructor: { name: { contains: raw, mode: "insensitive" } } },
          { instructor: { username: { contains: raw, mode: "insensitive" } } },
        ],
      },
      select: { id: true, slug: true, title: true, thumbnailUrl: true },
      orderBy: { ratingCount: "desc" },
      take: 6,
    }),
    prisma.user.findMany({
      where: {
        role: "INSTRUCTOR",
        OR: [
          { name: { contains: raw, mode: "insensitive" } },
          { username: { contains: raw, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, username: true, image: true, role: true },
      take: 3,
    }),
    prisma.resaleBundle.findMany({
      where: { name: { contains: raw, mode: "insensitive" }, listings: { some: { listing: { active: true } } } },
      select: {
        id: true,
        name: true,
        listings: {
          where: { listing: { active: true } },
          select: { listing: { select: { course: { select: { thumbnailUrl: true } } } } },
          take: 1,
        },
      },
      take: 3,
    }),
    prisma.bundle.findMany({
      where: { name: { contains: raw, mode: "insensitive" }, courses: { some: { published: true } } },
      select: {
        id: true,
        name: true,
        instructorId: true,
        courses: { where: { published: true }, select: { thumbnailUrl: true } },
      },
      take: 3,
    }),
  ]);

  const bundles = [
    ...resaleBundles.map((b) => ({
      id: b.id,
      name: b.name,
      thumbnailUrl: b.listings[0]?.listing.course.thumbnailUrl ?? null,
      kind: "resale" as const,
      instructorId: null as string | null,
    })),
    ...instructorBundles.map((b) => ({
      id: b.id,
      name: b.name,
      thumbnailUrl: b.courses[0]?.thumbnailUrl ?? null,
      kind: "instructor" as const,
      instructorId: b.instructorId,
    })),
  ];

  return NextResponse.json({ courses, bundles, users: [], instructors });
}
