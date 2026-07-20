import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCachedCourseBySlug } from "@/lib/courseCache";
import { QuizPlayer } from "@/components/course/QuizPlayer";
import { LessonLayoutShell } from "@/components/course/LessonLayoutShell";
import { CourseProgressSidebar } from "@/components/course/CourseProgressSidebar";

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
          percent={percent}
          completedCount={completedCount}
          totalLessons={totalItems}
        />
      }
    >
      <div>
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
      </div>
    </LessonLayoutShell>
  );
}
