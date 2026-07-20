import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  return NextResponse.json({ ok: true });
}
