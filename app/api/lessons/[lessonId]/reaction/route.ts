import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const reactionSchema = z.object({
  type: z.enum(["LIKE", "DISLIKE"]).nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { lessonId } = await params;
  const parsed = reactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  if (parsed.data.type === null) {
    await prisma.lessonReaction.deleteMany({ where: { userId: session.user.id, lessonId } });
  } else {
    await prisma.lessonReaction.upsert({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
      update: { type: parsed.data.type },
      create: { userId: session.user.id, lessonId, type: parsed.data.type },
    });
  }

  const [likeCount, dislikeCount] = await Promise.all([
    prisma.lessonReaction.count({ where: { lessonId, type: "LIKE" } }),
    prisma.lessonReaction.count({ where: { lessonId, type: "DISLIKE" } }),
  ]);

  return NextResponse.json({ likeCount, dislikeCount, myReaction: parsed.data.type });
}
