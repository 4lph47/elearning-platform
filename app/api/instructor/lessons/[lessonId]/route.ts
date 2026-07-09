import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lessonSchema } from "@/lib/validations";
import { getOwnedLesson } from "@/lib/instructor-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await getOwnedLesson(lessonId, session);
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  const body = await request.json();
  const parsed = lessonSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.lesson.update({ where: { id: lessonId }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await getOwnedLesson(lessonId, session);
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  await prisma.lesson.delete({ where: { id: lessonId } });
  return NextResponse.json({ ok: true });
}
