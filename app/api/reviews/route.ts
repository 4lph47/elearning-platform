import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const reviewSchema = z.object({
  courseId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3, "Escreve um comentário com pelo menos 3 caracteres").max(2000),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });
  }

  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { courseId, rating, comment } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Precisas de estar inscrito para avaliar este curso" }, { status: 403 });
  }

  await prisma.review.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: { rating, comment },
    create: { userId: session.user.id, courseId, rating, comment },
  });

  const agg = await prisma.review.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: true,
  });

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      rating: agg._avg.rating ?? 0,
      ratingCount: agg._count,
    },
  });

  return NextResponse.json({ rating: updated.rating, ratingCount: updated.ratingCount }, { status: 201 });
}
