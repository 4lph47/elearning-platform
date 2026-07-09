import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      quiz: { select: { id: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          quiz: { select: { id: true } },
          lessons: { orderBy: { order: "asc" }, include: { quiz: { select: { id: true } } } },
        },
      },
    },
  });
  if (!course) notFound();

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  });
  if (!quiz || (quiz.moduleId === null && quiz.courseId !== course.id)) notFound();

  const isOwner = course.instructorId === session.user.id;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  const isEnrolled = Boolean(enrollment);

  if (!isOwner && !isEnrolled) {
    redirect(`/courses/${slug}`);
  }

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const [attemptsUsed, progressRows] = await Promise.all([
    prisma.quizAttempt.count({ where: { quizId: quiz.id, userId: session.user.id } }),
    isEnrolled
      ? prisma.lessonProgress.findMany({
          where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
        })
      : Promise.resolve([]),
  ]);
  const progressByLessonId = Object.fromEntries(progressRows.map((p) => [p.lessonId, p.completed]));
  const completedLessonsCount = Object.values(progressByLessonId).filter(Boolean).length;

  const moduleQuizIds = course.modules.map((m) => m.quiz?.id).filter((id): id is string => Boolean(id));
  const lessonQuizIds = allLessons.map((l) => l.quiz?.id).filter((id): id is string => Boolean(id));
  const allQuizIds = [...moduleQuizIds, ...lessonQuizIds, ...(course.quiz ? [course.quiz.id] : [])];
  const doneQuizIds = allQuizIds.length
    ? new Set(
        (
          await prisma.quizAttempt.findMany({
            where: { quizId: { in: allQuizIds }, userId: session.user.id },
            select: { quizId: true },
          })
        ).map((a) => a.quizId)
      )
    : new Set<string>();

  const totalItems = allLessons.length + allQuizIds.length;
  const completedCount = completedLessonsCount + doneQuizIds.size;
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <LessonLayoutShell
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
            })),
          }))}
          progressByLessonId={progressByLessonId}
          doneQuizIds={doneQuizIds}
          isOwner={isOwner}
          isEnrolled={isEnrolled}
          percent={percent}
          completedCount={completedCount}
          totalLessons={totalItems}
        />
      }
    >
      <Link href={`/courses/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Voltar ao curso
      </Link>
      <div className="mt-4">
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
