import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export function commentsTag(lessonId: string) {
  return `lesson-comments:${lessonId}`;
}

// Árvore de comentários (sem likedByMe — depende da sessão de quem lê, por
// isso fica de fora da cache) partilhada entre todos os pollers da mesma
// aula: sem isto, cada tab aberto (poll a cada 8s) ia direto à DB com um
// findMany aninhado (replies+likes) — N users × M tabs a martelar a mesma
// query. Cache curta (5s) + tag por lessonId, invalidada nas rotas de
// criar/apagar/like, absorve esse tráfego para no máx. 1 query real a cada
// 5s por aula, independente de quantos estão a ver.
export async function getRawLessonComments(lessonId: string) {
  return unstable_cache(
    async () =>
      prisma.lessonComment.findMany({
        where: { lessonId, parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
          likes: { select: { userId: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true } }, likes: { select: { userId: true } } },
          },
        },
      }),
    ["lesson-comments", lessonId],
    { revalidate: 5, tags: [commentsTag(lessonId)] }
  )();
}

export function toCommentTree(raw: Awaited<ReturnType<typeof getRawLessonComments>>, userId: string) {
  return raw.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: new Date(c.createdAt).toISOString(),
    user: c.user,
    likeCount: c.likes.length,
    likedByMe: c.likes.some((l) => l.userId === userId),
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: new Date(r.createdAt).toISOString(),
      user: r.user,
      likeCount: r.likes.length,
      likedByMe: r.likes.some((l) => l.userId === userId),
      replies: [] as never[],
    })),
  }));
}
