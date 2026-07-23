import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  const courses = await prisma.course.findMany({
    where: { published: true, title: { contains: q, mode: "insensitive" } },
    select: { slug: true, title: true, thumbnailUrl: true },
    orderBy: { ratingCount: "desc" },
    take: 6,
  });

  return NextResponse.json(courses);
}
