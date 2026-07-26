import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Todas as categorias já usadas em qualquer curso (não só publicados) —
// alimenta o CategoryPicker do instrutor ao criar/editar um curso, para
// reaproveitar nomes já criados por outros em vez de duplicar variações
// ("Programação" vs "programacao").
export async function GET() {
  const rows = await prisma.course.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return NextResponse.json({ categories: rows.map((r) => r.category) });
}
