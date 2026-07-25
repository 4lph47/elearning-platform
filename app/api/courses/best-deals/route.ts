import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Maiores descontos do catálogo (originalPrice vs price) — mostrado como
// sugestão fixa na searchbar quando o campo está vazio, ao lado de
// "recentes". Filtro por originalPrice > price precisa de acontecer em JS
// (Prisma não compara duas colunas entre si na cláusula where).
export async function GET() {
  const candidates = await prisma.course.findMany({
    where: { published: true, originalPrice: { not: null } },
    select: { slug: true, title: true, thumbnailUrl: true, price: true, originalPrice: true },
    orderBy: { ratingCount: "desc" },
    take: 40,
  });

  const deals = candidates
    .filter((c) => c.originalPrice !== null && c.originalPrice > c.price)
    .map((c) => ({ ...c, discountPct: Math.round((1 - c.price / c.originalPrice!) * 100) }))
    .sort((a, b) => b.discountPct - a.discountPct)
    .slice(0, 6);

  return NextResponse.json(deals);
}
