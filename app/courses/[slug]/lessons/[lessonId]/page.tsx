import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LessonBody } from "@/components/course/LessonBody";
import { LessonLayoutShell } from "@/components/course/LessonLayoutShell";
import { CourseProgressSidebar } from "@/components/course/CourseProgressSidebar";
import { LessonEngagementBar } from "@/components/course/LessonEngagementBar";
import { LessonComments, type CommentData } from "@/components/course/LessonComments";

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

  const [course, resources, progress] = await Promise.all([
    prisma.course.findUnique({
      where: { slug },
      include: {
        instructor: { select: { id: true, name: true } },
        collaborators: { select: { id: true, name: true } },
        quiz: { select: { id: true } },
        modules: {
          orderBy: { order: "asc" },
          include: {
            quiz: { select: { id: true } },
            lessons: {
              orderBy: { order: "asc" },
              include: {
                quiz: { select: { id: true, title: true, maxAttempts: true, timeLimitMinutes: true } },
                contributors: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.lessonResource.findMany({ where: { lessonId } }),
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
    }),
  ]);
  if (!course) notFound();

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const lesson = allLessons.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  const isOwner =
    course.instructorId === session.user.id || course.collaborators.some((c) => c.id === session.user.id);
  const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = allLessons[currentIndex + 1];

  const moduleQuizIds = course.modules.map((m) => m.quiz?.id).filter((id): id is string => Boolean(id));
  const lessonQuizIds = allLessons.map((l) => l.quiz?.id).filter((id): id is string => Boolean(id));
  const allQuizIds = [...moduleQuizIds, ...lessonQuizIds, ...(course.quiz ? [course.quiz.id] : [])];

  const [
    enrollment,
    fullQuiz,
    quizAttemptsUsed,
    progressRows,
    doneQuizAttempts,
    topLevelComments,
    likeReactions,
    myReaction,
    updatedLesson,
  ] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
    lesson.quiz
      ? prisma.quiz.findUnique({
          where: { id: lesson.quiz.id },
          include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
        })
      : Promise.resolve(null),
    lesson.quiz
      ? prisma.quizAttempt.count({ where: { quizId: lesson.quiz.id, userId: session.user.id } })
      : Promise.resolve(0),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
    }),
    allQuizIds.length
      ? prisma.quizAttempt.findMany({
          where: { quizId: { in: allQuizIds }, userId: session.user.id },
          select: { quizId: true },
        })
      : Promise.resolve([]),
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
    prisma.lessonReaction.count({ where: { lessonId, type: "LIKE" } }),
    prisma.lessonReaction.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
      select: { type: true },
    }),
    prisma.lesson.update({
      where: { id: lessonId },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    }),
  ]);

  const isEnrolled = Boolean(enrollment);
  if (!isOwner && !isEnrolled && !lesson.isFreePreview) {
    redirect(`/courses/${slug}`);
  }

  const progressByLessonId = Object.fromEntries(progressRows.map((p) => [p.lessonId, p.completed]));
  const completedLessonsCount = Object.values(progressByLessonId).filter(Boolean).length;
  const doneQuizIds = new Set(doneQuizAttempts.map((a) => a.quizId));

  const authors = [course.instructor, ...course.collaborators];
  const commentTree: CommentData[] = topLevelComments.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    user: c.user,
    likeCount: c.likes.length,
    likedByMe: c.likes.some((l) => l.userId === session.user.id),
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      likeCount: r.likes.length,
      likedByMe: r.likes.some((l) => l.userId === session.user.id),
      replies: [],
    })),
  }));

  const totalItems = allLessons.length + allQuizIds.length;
  const completedCount = completedLessonsCount + doneQuizIds.size;
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const progressSidebar = (
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
        })),
      }))}
      progressByLessonId={progressByLessonId}
      doneQuizIds={doneQuizIds}
      finalQuizId={course.quiz?.id ?? null}
      isOwner={isOwner}
      isEnrolled={isEnrolled}
      currentLessonId={lesson.id}
      percent={percent}
      completedCount={completedCount}
      totalLessons={totalItems}
    />
  );

  return (
    <>
      <LessonLayoutShell
        courseSlug={slug}
        courseTitle={course.title}
        chat={{ courseId: course.id, lessonId: lesson.id, courseTitle: course.title }}
        sidebar={progressSidebar}
      >
        <LessonBody
          nav={
            <div className="flex items-center justify-between">
              {previousLesson && (isOwner || isEnrolled || previousLesson.isFreePreview) && (
                <Link
                  href={`/courses/${slug}/lessons/${previousLesson.id}`}
                  className="inline-flex min-w-0 items-center gap-1 text-sm text-slate-400 hover:text-white"
                >
                  <ArrowLeft size={14} className="shrink-0" />
                  <span className="truncate">
                    Aula anterior<span className="hidden sm:inline">: {previousLesson.title}</span>
                  </span>
                </Link>
              )}
              {nextLesson && (isOwner || isEnrolled || nextLesson.isFreePreview) && (
                <Link
                  href={`/courses/${slug}/lessons/${nextLesson.id}`}
                  className="ml-auto inline-flex min-w-0 items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  <span className="truncate">
                    Próxima aula<span className="hidden sm:inline">: {nextLesson.title}</span>
                  </span>
                  <ArrowRight size={14} className="shrink-0" />
                </Link>
              )}
            </div>
          }
          title={
            <>
              <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
              {lesson.contributors.length > 0 && (
                <p className="mt-1 text-sm text-slate-400">
                  Envolvidos nesta aula: {lesson.contributors.map((c) => c.name).join(", ")}
                </p>
              )}
            </>
          }
          lessonId={lesson.id}
          type={lesson.type}
          contentUrl={lesson.contentUrl}
          textContent={lesson.textContent}
          initialCompleted={progress?.completed ?? false}
          initialWatchedSeconds={progress?.watchedSeconds ?? 0}
          overview={lesson.description || course.description}
          resources={resources.map((r) => ({ id: r.id, name: r.name, url: r.url, type: r.type }))}
          progress={progressSidebar}
          engagement={
            <LessonEngagementBar
              lessonId={lesson.id}
              authors={authors}
              viewCount={updatedLesson.viewCount}
              createdAt={lesson.createdAt.toISOString()}
              initialLikeCount={likeReactions}
              initialReaction={myReaction?.type ?? null}
              isAuthenticated={Boolean(session)}
            />
          }
          comments={
            <LessonComments
              lessonId={lesson.id}
              comments={commentTree}
              currentUserId={session.user.id}
              currentUserName={session.user.name ?? null}
              canModerate={isOwner}
              isAuthenticated={Boolean(session)}
            />
          }
          quiz={
            fullQuiz
              ? {
                  id: fullQuiz.id,
                  title: fullQuiz.title,
                  maxAttempts: fullQuiz.maxAttempts,
                  timeLimitMinutes: fullQuiz.timeLimitMinutes,
                  attemptsUsed: quizAttemptsUsed,
                  questions: fullQuiz.questions.map((q) => ({
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
