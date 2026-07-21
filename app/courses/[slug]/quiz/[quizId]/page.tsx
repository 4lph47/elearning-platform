import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  const moduleQuizIds = course.modules.map((m) => m.quiz?.id).filter((id): id is string => Boolean(id));
  const lessonQuizIds = allLessons.map((l) => l.quiz?.id).filter((id): id is string => Boolean(id));
  const allQuizIds = [...moduleQuizIds, ...lessonQuizIds, ...(course.quiz ? [course.quiz.id] : [])];

  if (!quiz || !allQuizIds.includes(quiz.id)) notFound();

  const [enrollment, attemptsUsed, progressRows, doneQuizAttempts] = await Promise.all([
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
  ]);

  const isEnrolled = Boolean(enrollment);
  if (!isOwner && !isEnrolled) {
    redirect(`/courses/${slug}`);
  }

  const progressByLessonId = Object.fromEntries(progressRows.map((p) => [p.lessonId, p.completed]));
  const completedLessonsCount = Object.values(progressByLessonId).filter(Boolean).length;
  const doneQuizIds = new Set(doneQuizAttempts.map((a) => a.quizId));

  const totalItems = allLessons.length + allQuizIds.length;
  const completedCount = completedLessonsCount + doneQuizIds.size;
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const sequence = buildCourseSequence(
    course.modules.map((m) => ({
      title: m.title,
      quizId: m.quiz?.id ?? null,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        isFreePreview: l.isFreePreview,
        quizId: l.quiz?.id ?? null,
      })),
    })),
    course.quiz ? { id: course.quiz.id } : null,
    { isOwner, isEnrolled }
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
            quizId: m.quiz?.id ?? null,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              isFreePreview: l.isFreePreview,
              durationSeconds: l.durationSeconds,
              type: l.type,
              quizId: l.quiz?.id ?? null,
            })),
          }))}
          progressByLessonId={progressByLessonId}
          doneQuizIds={doneQuizIds}
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
        nextHref={nextHref}
        nav={
          <div className="mb-4 flex items-center justify-between">
            {previousHref && previousItem && (
              <Link
                href={previousHref}
                prefetch
                className="inline-flex min-w-0 items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft size={14} className="shrink-0" />
                <span className="truncate">
                  Aula anterior<span className="hidden sm:inline">: {previousItem.title}</span>
                </span>
              </Link>
            )}
            {nextHref && nextItem && (
              <Link
                href={nextHref}
                prefetch
                className="ml-auto inline-flex min-w-0 items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                <span className="truncate">
                  Próxima aula<span className="hidden sm:inline">: {nextItem.title}</span>
                </span>
                <ArrowRight size={14} className="shrink-0" />
              </Link>
            )}
          </div>
        }
      >
        <QuizPlayer
          quizId={quiz.id}
          title={quiz.title}
          maxAttempts={quiz.maxAttempts}
          timeLimitMinutes={quiz.timeLimitMinutes}
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
