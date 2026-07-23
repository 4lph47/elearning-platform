import { prisma } from "@/lib/db";

/**
 * Ao concluir 100% de um curso (aulas + quizzes), gera uma avaliação
 * predefinida com base no engajamento do aluno (likes e comentários
 * dados nas aulas). O aluno pode depois editar essa avaliação através
 * do ReviewForm normal. Não faz nada se já existir uma avaliação.
 */
export async function maybeCreateAutoReview(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      quiz: { select: { id: true } },
      modules: {
        include: {
          quizzes: { select: { id: true } },
          lessons: { select: { id: true, quiz: { select: { id: true } } } },
        },
      },
    },
  });
  if (!course) return;

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length === 0) return;

  const quizIds = [
    ...course.modules.flatMap((m) => m.quizzes.map((q) => q.id)),
    ...course.modules.flatMap((m) => m.lessons.map((l) => l.quiz?.id)).filter((id): id is string => Boolean(id)),
    ...(course.quiz ? [course.quiz.id] : []),
  ];

  const [doneLessonsCount, doneQuizAttempts, existingReview, likedLessons, commentedLessons] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, lessonId: { in: lessonIds }, completed: true } }),
    quizIds.length
      ? prisma.quizAttempt.findMany({
          where: { userId, quizId: { in: quizIds } },
          select: { quizId: true },
          distinct: ["quizId"],
        })
      : Promise.resolve([]),
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

  const totalItems = lessonIds.length + quizIds.length;
  const completedCount = doneLessonsCount + doneQuizAttempts.length;
  if (completedCount < totalItems) return;
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
