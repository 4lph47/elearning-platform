import { prisma } from "@/lib/db";

export const COURSE_COMMENTS_PAGE_SIZE = 15;
const REPLIES_LIMIT = 20;

// Sem cache/tags (ao contrário de lib/commentsCache.ts) — página do curso já
// é force-dynamic e o volume esperado aqui é bem menor que nas aulas.
export async function getRawCourseComments(courseId: string, skip = 0, take = COURSE_COMMENTS_PAGE_SIZE) {
  return prisma.courseComment.findMany({
    where: { courseId, parentId: null },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: {
      user: { select: { id: true, name: true } },
      likes: { select: { userId: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        take: REPLIES_LIMIT,
        include: { user: { select: { id: true, name: true } }, likes: { select: { userId: true } } },
      },
    },
  });
}

export async function getCourseCommentsCounts(courseId: string) {
  const [topLevel, all] = await Promise.all([
    prisma.courseComment.count({ where: { courseId, parentId: null } }),
    prisma.courseComment.count({ where: { courseId } }),
  ]);
  return { topLevel, all };
}

export function toCourseCommentTree(raw: Awaited<ReturnType<typeof getRawCourseComments>>, userId: string | null) {
  return raw.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    user: c.user,
    likeCount: c.likes.length,
    likedByMe: userId !== null && c.likes.some((l) => l.userId === userId),
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      user: r.user,
      likeCount: r.likes.length,
      likedByMe: userId !== null && r.likes.some((l) => l.userId === userId),
      replies: [] as never[],
    })),
  }));
}
