import { prisma } from "@/lib/db";
import { getCourseCompletionStatus } from "@/lib/courseCompletion";

/**
 * Ao concluir 100% de um curso (aulas + quizzes), gera uma avaliação
 * predefinida com base no engajamento do aluno (likes e comentários
 * dados nas aulas). O aluno pode depois editar essa avaliação através
 * do ReviewForm normal. Não faz nada se já existir uma avaliação.
 */
export async function maybeCreateAutoReview(userId: string, courseId: string) {
  const status = await getCourseCompletionStatus(userId, courseId);
  if (!status?.complete) return;
  const { lessonIds } = status;

  const [existingReview, likedLessons, commentedLessons] = await Promise.all([
    prisma.review.findUnique({ where: { userId_courseId: { userId, courseId } } }),
    prisma.lessonReaction.findMany({
      where: { userId, type: "LIKE", lessonId: { in: lessonIds } },
      select: { lessonId: true },
    }),
    prisma.lessonComment.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
      distinct: ["lessonId"],
    }),
  ]);

  if (existingReview) return;

  const likedFraction = likedLessons.length / lessonIds.length;
  const commentedFraction = commentedLessons.length / lessonIds.length;
  const engagementScore = (likedFraction + commentedFraction) / 2;
  const autoRating = Math.min(5, Math.max(1, Math.round(1 + engagementScore * 4)));

  await prisma.review.create({
    data: { userId, courseId, rating: autoRating, comment: "" },
  });

  const agg = await prisma.review.aggregate({ where: { courseId }, _avg: { rating: true }, _count: true });
  await prisma.course.update({
    where: { id: courseId },
    data: { rating: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
}
