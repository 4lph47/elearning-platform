import { prisma } from "@/lib/db";

export interface CourseCompletionStatus {
  complete: boolean;
  lessonIds: string[];
}

// Curso 100% concluído = todas as aulas marcadas como completas E todas as
// tentativas de quiz (de aula, de módulo ou do curso) submetidas pelo menos
// uma vez. Usado quer para gerar a review automática (lib/autoReview.ts)
// quer para libertar a revenda de um curso (lib/resale.ts via Enrollment.completedAt).
export async function getCourseCompletionStatus(
  userId: string,
  courseId: string
): Promise<CourseCompletionStatus | null> {
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
  if (!course) return null;

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length === 0) return null;

  const quizIds = [
    ...course.modules.flatMap((m) => m.quizzes.map((q) => q.id)),
    ...course.modules.flatMap((m) => m.lessons.map((l) => l.quiz?.id)).filter((id): id is string => Boolean(id)),
    ...(course.quiz ? [course.quiz.id] : []),
  ];

  const [doneLessonsCount, doneQuizAttempts] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, lessonId: { in: lessonIds }, completed: true } }),
    quizIds.length
      ? prisma.quizAttempt.findMany({
          where: { userId, quizId: { in: quizIds } },
          select: { quizId: true },
          distinct: ["quizId"],
        })
      : Promise.resolve([]),
  ]);

  const totalItems = lessonIds.length + quizIds.length;
  const completedCount = doneLessonsCount + doneQuizAttempts.length;

  return { complete: completedCount >= totalItems, lessonIds };
}

// Idempotente: o guard completedAt:null no where evita sobrescrever a data
// da primeira conclusão em chamadas repetidas (ex.: repetir um quiz depois
// de já ter terminado o curso).
export async function maybeMarkEnrollmentCompleted(userId: string, courseId: string) {
  const status = await getCourseCompletionStatus(userId, courseId);
  if (!status?.complete) return;

  await prisma.enrollment.updateMany({
    where: { userId, courseId, completedAt: null },
    data: { completedAt: new Date() },
  });
}
