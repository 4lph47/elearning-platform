import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCachedCourseBySlug } from "@/lib/courseCache";
import { buildCourseSequence, hrefFor } from "@/lib/courseSequence";
import { QuizPlayer } from "@/components/course/QuizPlayer";
import { LessonLayoutShell } from "@/components/course/LessonLayoutShell";
import { CourseProgressSidebar } from "@/components/course/CourseProgressSidebar";
import { SwipeNavShell } from "@/components/course/SwipeNavShell";

export const dynamic = "force-dynamic";

export default async function CourseQuizPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/courses/${slug}/quiz/${quizId}`)}`);
  }

  const [course, quiz] = await Promise.all([
    getCachedCourseBySlug(slug),
    prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    }),
  ]);
  if (!course) notFound();

  const isOwner = course.instructorId === session.user.id;
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const moduleQuizIds = course.modules.flatMap((m) => m.quizzes.map((q) => q.id));
  const lessonQuizIds = allLessons.map((l) => l.quiz?.id).filter((id): id is string => Boolean(id));
  const allQuizIds = [...moduleQuizIds, ...lessonQuizIds, ...(course.quiz ? [course.quiz.id] : [])];

  if (!quiz || !allQuizIds.includes(quiz.id)) notFound();

  const [enrollment, attemptsUsed, progressRows, doneQuizAttempts, lastAttempt] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
    prisma.quizAttempt.count({ where: { quizId: quiz.id, userId: session.user.id } }),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
    }),
    allQuizIds.length
      ? prisma.quizAttempt.findMany({
          where: { quizId: { in: allQuizIds }, userId: session.user.id },
          select: { quizId: true },
        })
      : Promise.resolve([]),
    quiz.retryAfterHours != null
      ? prisma.quizAttempt.findFirst({
          where: { quizId: quiz.id, userId: session.user.id },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);

  const isEnrolled = Boolean(enrollment);
  if (!isOwner && !isEnrolled) {
    redirect(`/courses/${slug}`);
  }

  const progressByLessonId = Object.fromEntries(progressRows.map((p) => [p.lessonId, p.completed]));
  const completedLessonsCount = Object.values(progressByLessonId).filter(Boolean).length;
  const doneQuizIds = new Set(doneQuizAttempts.map((a) => a.quizId));

  // Quiz só fica acessível depois das aulas anteriores concluídas (quiz de
  // aula: essa aula; de módulo: aulas do módulo com order menor; exame
  // final: todas as aulas do curso) — dono do curso ignora este bloqueio.
  if (!isOwner) {
    const parentModule = quiz.moduleId ? course.modules.find((m) => m.id === quiz.moduleId) : null;
    const prerequisiteLessons =
      quiz.scope === "LESSON"
        ? allLessons.filter((l) => l.id === quiz.lessonId)
        : quiz.scope === "MODULE"
          ? (parentModule?.lessons.filter((l) => l.order < quiz.order) ?? [])
          : allLessons;
    const prerequisitesComplete = prerequisiteLessons.every((l) => progressByLessonId[l.id]);
    if (!prerequisitesComplete) {
      redirect(`/courses/${slug}`);
    }
  }

  const totalItems = allLessons.length + allQuizIds.length;
  const completedCount = completedLessonsCount + doneQuizIds.size;
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const sequence = buildCourseSequence(
    course.modules.map((m) => ({
      title: m.title,
      quizzes: m.quizzes.map((q) => ({ id: q.id, title: q.title, order: q.order })),
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        isFreePreview: l.isFreePreview,
        order: l.order,
        quizId: l.quiz?.id ?? null,
      })),
    })),
    course.quiz ? { id: course.quiz.id } : null,
    { isOwner, isEnrolled },
    progressByLessonId
  );
  const currentSeqIndex = sequence.findIndex((it) => it.type === "quiz" && it.id === quiz.id);
  const previousItem = currentSeqIndex > 0 ? sequence[currentSeqIndex - 1] : null;
  const nextItem = currentSeqIndex >= 0 ? sequence[currentSeqIndex + 1] : null;
  const previousHref = previousItem?.accessible ? hrefFor(slug, previousItem) : null;
  const nextHref = nextItem?.accessible ? hrefFor(slug, nextItem) : null;

  return (
    <LessonLayoutShell
      courseSlug={slug}
      courseTitle={course.title}
      sidebar={
        <CourseProgressSidebar
          slug={slug}
          modules={course.modules.map((m) => ({
            id: m.id,
            title: m.title,
            quizzes: m.quizzes.map((q) => ({ id: q.id, title: q.title, order: q.order })),
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              isFreePreview: l.isFreePreview,
              durationSeconds: l.durationSeconds,
              type: l.type,
              order: l.order,
              quizId: l.quiz?.id ?? null,
            })),
          }))}
          progressByLessonId={progressByLessonId}
          doneQuizIds={Array.from(doneQuizIds)}
          finalQuizId={course.quiz?.id ?? null}
          isOwner={isOwner}
          isEnrolled={isEnrolled}
          currentQuizId={quizId}
          percent={percent}
          completedCount={completedCount}
          totalLessons={totalItems}
        />
      }
    >
      <SwipeNavShell
        previousHref={previousHref}
        previousTitle={previousItem?.title ?? null}
        nextHref={nextHref}
        nextTitle={nextItem?.title ?? null}
      >
        <QuizPlayer
          quizId={quiz.id}
          title={quiz.title}
          scope={quiz.scope}
          maxAttempts={quiz.maxAttempts}
          timeLimitMinutes={quiz.timeLimitMinutes}
          showCountdown={quiz.showCountdown}
          retryAfterHours={quiz.retryAfterHours}
          nextAvailableAt={
            lastAttempt && quiz.retryAfterHours != null
              ? new Date(lastAttempt.createdAt.getTime() + quiz.retryAfterHours * 60 * 60 * 1000).toISOString()
              : null
          }
          attemptsUsed={attemptsUsed}
          questions={quiz.questions.map((q) => ({
            id: q.id,
            text: q.text,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
          }))}
        />
      </SwipeNavShell>
    </LessonLayoutShell>
  );
}
