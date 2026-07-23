import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const COMMENTS_PAGE_SIZE = 15;
const REPLIES_LIMIT = 20;

export function commentsTag(lessonId: string) {
  return `lesson-comments:${lessonId}`;
}

// Árvore de comentários (sem likedByMe — depende da sessão de quem lê, por
// isso fica de fora da cache) partilhada entre todos os pollers da mesma
// aula: sem isto, cada tab aberto (poll a cada 8s) ia direto à DB com um
// findMany aninhado (replies+likes) — N users × M tabs a martelar a mesma
// query. Cache curta (5s) + tag por lessonId, invalidada nas rotas de
// criar/apagar/like, absorve esse tráfego para no máx. 1 query real a cada
// 5s por página pedida (a mesma página, ex. a 1ª, repete-se na maioria dos
// pollers — cada página extra só custa quando alguém pede mesmo mais).
//
// Paginado (skip/take) — uma aula com milhares de comentários nunca envia
// nem processa mais do que o cliente pediu para ver; replies por comentário
// também têm um teto (REPLIES_LIMIT) pela mesma razão.
export async function getRawLessonComments(lessonId: string, skip = 0, take = COMMENTS_PAGE_SIZE) {
  return unstable_cache(
    async () =>
      prisma.lessonComment.findMany({
        where: { lessonId, parentId: null },
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
      }),
    ["lesson-comments", lessonId, String(skip), String(take)],
    { revalidate: 5, tags: [commentsTag(lessonId)] }
  )();
}

// Prévia (carrossel fechado antes de expandir) — os N comentários de topo
// mais gostados. Cache própria (chave/tag separadas do resto) porque é uma
// ordenação diferente (likes, não createdAt) e um conjunto pequeno e fixo.
export async function getTopLessonComments(lessonId: string, limit = 5) {
  return unstable_cache(
    async () =>
      prisma.lessonComment.findMany({
        where: { lessonId, parentId: null },
        orderBy: { likes: { _count: "desc" } },
        take: limit,
        include: {
          user: { select: { id: true, name: true } },
          likes: { select: { userId: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            take: REPLIES_LIMIT,
            include: { user: { select: { id: true, name: true } }, likes: { select: { userId: true } } },
          },
        },
      }),
    ["lesson-comments-top", lessonId, String(limit)],
    { revalidate: 5, tags: [commentsTag(lessonId)] }
  )();
}

// topLevel: quantos comentários de topo existem (governa hasMore da
// paginação). all: topo + replies, só para o "N comentários" no cabeçalho —
// contagens, não os registos em si, por isso continuam O(1) mesmo com
// milhares de linhas.
export async function getLessonCommentsCounts(lessonId: string) {
  return unstable_cache(
    async () => {
      const [topLevel, all] = await Promise.all([
        prisma.lessonComment.count({ where: { lessonId, parentId: null } }),
        prisma.lessonComment.count({ where: { lessonId } }),
      ]);
      return { topLevel, all };
    },
    ["lesson-comments-count", lessonId],
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
