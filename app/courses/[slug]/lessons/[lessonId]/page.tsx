import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LessonBody } from "@/components/course/LessonBody";
import { LessonLayoutShell } from "@/components/course/LessonLayoutShell";
import { CourseProgressSidebar } from "@/components/course/CourseProgressSidebar";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/courses/${slug}/lessons/${lessonId}`)}`);
  }

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      quiz: { select: { id: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          quiz: { select: { id: true } },
          lessons: {
            orderBy: { order: "asc" },
            include: {
              quiz: {
                include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const lesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!lesson) notFound();

  const isOwner = course.instructorId === session.user.id;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  const isEnrolled = Boolean(enrollment);

  if (!isOwner && !isEnrolled && !lesson.isFreePreview) {
    redirect(`/courses/${slug}`);
  }

  const [resources, progress, quizAttemptsUsed] = await Promise.all([
    prisma.lessonResource.findMany({ where: { lessonId: lesson.id } }),
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId: lesson.id } },
    }),
    lesson.quiz
      ? prisma.quizAttempt.count({ where: { quizId: lesson.quiz.id, userId: session.user.id } })
      : Promise.resolve(0),
  ]);

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = allLessons[currentIndex + 1];
  const progressByLessonId = isEnrolled
    ? Object.fromEntries(
        (
          await prisma.lessonProgress.findMany({
            where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
          })
        ).map((p) => [p.lessonId, p.completed])
      )
    : {};
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
    <>
      <LessonLayoutShell
        chat={{ courseId: course.id, lessonId: lesson.id, courseTitle: course.title }}
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
            currentLessonId={lesson.id}
            percent={percent}
            completedCount={completedCount}
            totalLessons={totalItems}
          />
        }
      >
        <LessonBody
          header={
            <>
              <div className="flex items-center justify-between">
                {previousLesson && (isOwner || isEnrolled || previousLesson.isFreePreview) ? (
                  <Link
                    href={`/courses/${slug}/lessons/${previousLesson.id}`}
                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
                  >
                    <ArrowLeft size={14} /> Aula anterior: {previousLesson.title}
                  </Link>
                ) : (
                  <Link href={`/courses/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={14} /> Voltar ao curso
                  </Link>
                )}
                {nextLesson && (isOwner || isEnrolled || nextLesson.isFreePreview) && (
                  <Link
                    href={`/courses/${slug}/lessons/${nextLesson.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:underline"
                  >
                    Próxima aula: {nextLesson.title} <ArrowRight size={14} />
                  </Link>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{lesson.title}</h1>
            </>
          }
          lessonId={lesson.id}
          contentUrl={lesson.contentUrl}
          initialCompleted={progress?.completed ?? false}
          initialWatchedSeconds={progress?.watchedSeconds ?? 0}
          overview={course.description}
          resources={resources.map((r) => ({ id: r.id, name: r.name, url: r.url, type: r.type }))}
          quiz={
            lesson.quiz
              ? {
                  id: lesson.quiz.id,
                  title: lesson.quiz.title,
                  maxAttempts: lesson.quiz.maxAttempts,
                  timeLimitMinutes: lesson.quiz.timeLimitMinutes,
                  attemptsUsed: quizAttemptsUsed,
                  questions: lesson.quiz.questions.map((q) => ({
                    id: q.id,
                    text: q.text,
                    options: q.options.map((o) => ({ id: o.id, text: o.text })),
                  })),
                }
              : null
          }
        />
      </LessonLayoutShell>
    </>
  );
}
