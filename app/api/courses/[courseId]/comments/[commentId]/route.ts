import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const editSchema = z.object({ content: z.string().min(1, "Escreve um comentário").max(2000) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId, commentId } = await params;
  const parsed = editSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const comment = await prisma.courseComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.courseId !== courseId) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }
  if (comment.userId !== session.user.id) {
    return NextResponse.json({ error: "Só podes editar os teus próprios comentários" }, { status: 403 });
  }

  const updated = await prisma.courseComment.update({
    where: { id: commentId },
    data: { content: parsed.data.content },
    include: { user: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId, commentId } = await params;
  const comment = await prisma.courseComment.findUnique({
    where: { id: commentId },
    include: { course: { select: { instructorId: true, collaborators: { select: { id: true } } } } },
  });
  if (!comment || comment.courseId !== courseId) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }

  const isOwner =
    comment.course.instructorId === session.user.id || comment.course.collaborators.some((c) => c.id === session.user.id);
  if (comment.userId !== session.user.id && !isOwner) {
    return NextResponse.json({ error: "Não podes eliminar este comentário" }, { status: 403 });
  }

  await prisma.courseComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
