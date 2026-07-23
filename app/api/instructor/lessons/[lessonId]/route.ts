import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lessonSchema, validateLessonContent } from "@/lib/validations";
import { getOwnedLesson } from "@/lib/instructor-guard";
import { deleteQuiz } from "@/lib/quiz";
import { syncCourseThumbnail } from "@/lib/courseThumbnail";
import { needsTranscode, requeueTranscode } from "@/lib/videoTranscode";

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

  if (parsed.data.type === "TEXT" && lesson.type !== "TEXT") {
    await deleteQuiz("LESSON", lessonId);
  }

  const contentChanged = "contentUrl" in parsed.data && parsed.data.contentUrl !== lesson.contentUrl;
  if (contentChanged && needsTranscode(updated.type, updated.contentUrl)) {
    await requeueTranscode(updated.id, updated.contentUrl);
  }

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

  if ("thumbnailUrl" in parsed.data) {
    await syncCourseThumbnail(lesson.module.course.id);
  }

  revalidateTag("courses");
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await getOwnedLesson(lessonId, session);
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  await prisma.lesson.delete({ where: { id: lessonId } });
  await syncCourseThumbnail(lesson.module.course.id);
  revalidateTag("courses");
  return NextResponse.json({ ok: true });
}
