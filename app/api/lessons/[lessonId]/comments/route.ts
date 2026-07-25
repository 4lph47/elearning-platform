import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessLesson, getMentionableUsers } from "@/lib/lessonAccess";
import { extractMentionIds } from "@/lib/mentions";
import {
  commentsTag,
  getLessonCommentsCounts,
  getRawLessonComments,
  getTopLessonComments,
  toCommentTree,
  COMMENTS_PAGE_SIZE,
} from "@/lib/commentsCache";

const commentSchema = z.object({
  content: z.string().min(1, "Escreve um comentário").max(2000),
  parentId: z.string().optional().nullable(),
});

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await canAccessLesson(lessonId, session.user.id);
  if (!lesson) return NextResponse.json({ error: "Não tens acesso a esta aula" }, { status: 403 });

  const url = new URL(request.url);

  if (url.searchParams.get("sort") === "top") {
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("take")) || 5));
    const raw = await getTopLessonComments(lessonId, limit);
    return NextResponse.json({ comments: toCommentTree(raw, session.user.id), total: raw.length, hasMore: false });
  }

  const skip = Math.max(0, Number(url.searchParams.get("skip")) || 0);
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take")) || COMMENTS_PAGE_SIZE));

  const [raw, counts] = await Promise.all([
    getRawLessonComments(lessonId, skip, take),
    getLessonCommentsCounts(lessonId),
  ]);

  return NextResponse.json({
    comments: toCommentTree(raw, session.user.id),
    total: counts.all,
    hasMore: skip + raw.length < counts.topLevel,
  });
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

  // Só notifica quem realmente pode ver esta aula (participante do curso) —
  // um id de menção fabricado à mão no pedido nunca chega a criar Notification.
  const mentionable = await getMentionableUsers(lessonId);
  const mentionableIds = new Set(mentionable.map((u) => u.id));
  const mentionedUserIds = extractMentionIds(parsed.data.content).filter(
    (id) => id !== session.user.id && mentionableIds.has(id)
  );

  const comment = await prisma.lessonComment.create({
    data: {
      lessonId,
      userId: session.user.id,
      content: parsed.data.content,
      parentId: parsed.data.parentId ?? null,
      mentionedUserIds,
    },
    include: { user: { select: { id: true, name: true, username: true } } },
  });

  if (mentionedUserIds.length > 0) {
    await prisma.notification.createMany({
      data: mentionedUserIds.map((recipientId) => ({
        type: "MENTION" as const,
        recipientId,
        actorId: session.user.id,
        commentId: comment.id,
        courseSlug: lesson.module.course.slug,
        lessonId,
      })),
    });
  }

  revalidateTag(commentsTag(lessonId));
  return NextResponse.json(comment, { status: 201 });
}
