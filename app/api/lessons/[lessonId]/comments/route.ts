import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentsTag, getRawLessonComments, toCommentTree } from "@/lib/commentsCache";

const commentSchema = z.object({
  content: z.string().min(1, "Escreve um comentário").max(2000),
  parentId: z.string().optional().nullable(),
});

async function canAccessLesson(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { include: { collaborators: { select: { id: true } } } } } } },
  });
  if (!lesson) return null;

  const course = lesson.module.course;
  const isOwner = course.instructorId === userId || course.collaborators.some((c) => c.id === userId);
  if (isOwner || lesson.isFreePreview) return lesson;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });
  return enrollment ? lesson : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await canAccessLesson(lessonId, session.user.id);
  if (!lesson) return NextResponse.json({ error: "Não tens acesso a esta aula" }, { status: 403 });

  const raw = await getRawLessonComments(lessonId);
  return NextResponse.json(toCommentTree(raw, session.user.id));
}

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { lessonId } = await params;
  const parsed = commentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const lesson = await canAccessLesson(lessonId, session.user.id);
  if (!lesson) return NextResponse.json({ error: "Não tens acesso a esta aula" }, { status: 403 });

  if (parsed.data.parentId) {
    const parent = await prisma.lessonComment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.lessonId !== lessonId) {
      return NextResponse.json({ error: "Comentário original não encontrado" }, { status: 404 });
    }
  }

  const comment = await prisma.lessonComment.create({
    data: {
      lessonId,
      userId: session.user.id,
      content: parsed.data.content,
      parentId: parsed.data.parentId ?? null,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  revalidateTag(commentsTag(lessonId));
  return NextResponse.json(comment, { status: 201 });
}
