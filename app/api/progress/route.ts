import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { progressSchema } from "@/lib/validations";
import { maybeCreateAutoReview } from "@/lib/autoReview";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { lessonId, watchedSeconds, completed } = parsed.data;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  }

  const course = lesson.module.course;
  const isOwner = course.instructorId === session.user.id;

  if (!isOwner && !lesson.isFreePreview) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Não tens acesso a esta aula" }, { status: 403 });
    }
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    update: {
      ...(watchedSeconds !== undefined ? { watchedSeconds } : {}),
      ...(completed !== undefined
        ? { completed, completedAt: completed ? new Date() : null }
        : {}),
    },
    create: {
      userId: session.user.id,
      lessonId,
      watchedSeconds: watchedSeconds ?? 0,
      completed: completed ?? false,
      completedAt: completed ? new Date() : null,
    },
  });

  if (completed) {
    await maybeCreateAutoReview(session.user.id, course.id);
  }

  return NextResponse.json(progress);
}
