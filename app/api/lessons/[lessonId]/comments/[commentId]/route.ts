import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentsTag } from "@/lib/commentsCache";
import { getMentionableUsers } from "@/lib/lessonAccess";
import { extractMentionIds } from "@/lib/mentions";

const editSchema = z.object({ content: z.string().min(1, "Escreve um comentário").max(2000) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId, commentId } = await params;
  const parsed = editSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const comment = await prisma.lessonComment.findUnique({
    where: { id: commentId },
    include: { lesson: { include: { module: { include: { course: { select: { slug: true } } } } } } },
  });
  if (!comment || comment.lessonId !== lessonId) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }
  if (comment.userId !== session.user.id) {
    return NextResponse.json({ error: "Só podes editar os teus próprios comentários" }, { status: 403 });
  }

  const mentionable = await getMentionableUsers(lessonId);
  const mentionableIds = new Set(mentionable.map((u) => u.id));
  const mentionedUserIds = extractMentionIds(parsed.data.content).filter(
    (id) => id !== session.user.id && mentionableIds.has(id)
  );
  // Só notifica quem foi mencionado de novo — reeditar sem mudar as menções
  // não deve re-disparar notificação pra quem já tinha recebido a 1ª vez.
  const newlyMentioned = mentionedUserIds.filter((id) => !comment.mentionedUserIds.includes(id));

  const updated = await prisma.lessonComment.update({
    where: { id: commentId },
    data: { content: parsed.data.content, mentionedUserIds },
    include: { user: { select: { id: true, name: true, username: true } } },
  });

  if (newlyMentioned.length > 0) {
    await prisma.notification.createMany({
      data: newlyMentioned.map((recipientId) => ({
        type: "MENTION" as const,
        recipientId,
        actorId: session.user.id,
        commentId: updated.id,
        courseSlug: comment.lesson.module.course.slug,
        lessonId,
      })),
    });
  }

  revalidateTag(commentsTag(lessonId));
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId, commentId } = await params;
  const comment = await prisma.lessonComment.findUnique({
    where: { id: commentId },
    include: { lesson: { include: { module: { include: { course: true } } } } },
  });
  if (!comment || comment.lessonId !== lessonId) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }

  const isOwner = comment.lesson.module.course.instructorId === session.user.id;
  if (comment.userId !== session.user.id && !isOwner) {
    return NextResponse.json({ error: "Não podes eliminar este comentário" }, { status: 403 });
  }

  await prisma.lessonComment.delete({ where: { id: commentId } });
  revalidateTag(commentsTag(lessonId));
  return NextResponse.json({ ok: true });
}
