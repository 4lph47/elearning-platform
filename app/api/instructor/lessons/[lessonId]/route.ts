import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lessonSchema, validateLessonContent } from "@/lib/validations";
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
  if ("type" in parsed.data || "contentUrl" in parsed.data || "textContent" in parsed.data) {
    const contentError = validateLessonContent({ type: lesson.type, contentUrl: lesson.contentUrl, textContent: lesson.textContent, ...parsed.data });
    if (contentError) {
      return NextResponse.json({ error: contentError }, { status: 400 });
    }
  }

  const updated = await prisma.lesson.update({ where: { id: lessonId }, data: parsed.data });

  if ("contributorIds" in body) {
    const authorIds = new Set([
      lesson.module.course.instructorId,
      ...lesson.module.course.collaborators.map((c) => c.id),
    ]);
    const contributorIds: string[] = Array.isArray(body.contributorIds)
      ? body.contributorIds.filter((id: unknown): id is string => typeof id === "string" && authorIds.has(id))
      : [];

    await prisma.lesson.update({
      where: { id: lessonId },
      data: { contributors: { set: contributorIds.map((id) => ({ id })) } },
    });
  }

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
