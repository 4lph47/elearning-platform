import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCachedCourseBySlug } from "@/lib/courseCache";
import {
  getRawLessonComments,
  getLessonCommentsCounts,
  getTopLessonComments,
  toCommentTree,
  COMMENTS_PAGE_SIZE,
} from "@/lib/commentsCache";
import { buildCourseSequence, hrefFor } from "@/lib/courseSequence";
import { LessonBody } from "@/components/course/LessonBody";
import { LessonLayoutShell } from "@/components/course/LessonLayoutShell";
import { LessonTitleHeading } from "@/components/course/LessonTitleHeading";
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

  const [course, resources, progress, videoRenditions] = await Promise.all([
    getCachedCourseBySlug(slug),
    prisma.lessonResource.findMany({ where: { lessonId } }),
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
    }),
    prisma.lessonVideoRendition.findMany({
      where: { lessonId },
      orderBy: { height: "desc" },
      select: { quality: true, url: true, width: true, height: true },
    }),
  ]);
  if (!course) notFound();

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const lesson = allLessons.find((l) => l.id === lessonId);
  if (!lesson) notFound();
  // lesson vem de dados em cache (unstable_cache serializa para JSON), por isso
  // createdAt pode chegar já como string em vez de Date — normalizar sempre.
  const lessonCreatedAt = new Date(lesson.createdAt).toISOString();

  const isOwner =
    course.instructorId === session.user.id || course.collaborators.some((c) => c.id === session.user.id);

  const moduleQuizIds = course.modules.flatMap((m) => m.quizzes.map((q) => q.id));
  const lessonQuizIds = allLessons.map((l) => l.quiz?.id).filter((id): id is string => Boolean(id));
  const allQuizIds = [...moduleQuizIds, ...lessonQuizIds, ...(course.quiz ? [course.quiz.id] : [])];

  const [
    enrollment,
    progressRows,
    doneQuizAttempts,
    topLevelComments,
    commentCounts,
    topComments,
    likeReactions,
    myReaction,
    updatedLesson,
  ] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
    }),
    allQuizIds.length
      ? prisma.quizAttempt.findMany({
          where: { quizId: { in: allQuizIds }, userId: session.user.id },
          select: { quizId: true },
        })
      : Promise.resolve([]),
    getRawLessonComments(lessonId, 0, COMMENTS_PAGE_SIZE),
    getLessonCommentsCounts(lessonId),
    getTopLessonComments(lessonId, 5),
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
    { isOwner, isEnrolled }
  );
  const currentSeqIndex = sequence.findIndex((it) => it.type === "lesson" && it.id === lesson.id);
  const previousItem = currentSeqIndex > 0 ? sequence[currentSeqIndex - 1] : null;
  const nextItem = currentSeqIndex >= 0 ? sequence[currentSeqIndex + 1] : null;
  const previousHref = previousItem?.accessible ? hrefFor(slug, previousItem) : null;
  const nextHref = nextItem?.accessible ? hrefFor(slug, nextItem) : null;

  const progressByLessonId = Object.fromEntries(progressRows.map((p) => [p.lessonId, p.completed]));
  const completedLessonsCount = Object.values(progressByLessonId).filter(Boolean).length;
  const doneQuizIds = new Set(doneQuizAttempts.map((a) => a.quizId));

  const authors = [course.instructor, ...course.collaborators];
  const commentTree: CommentData[] = toCommentTree(topLevelComments, session.user.id);
  const topCommentTree: CommentData[] = toCommentTree(topComments, session.user.id);

  const totalItems = allLessons.length + allQuizIds.length;
  const completedCount = completedLessonsCount + doneQuizIds.size;
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const progressSidebar = (
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
          courseSlug={slug}
          previousTitle={previousItem?.title ?? null}
          nextTitle={nextItem?.title ?? null}
          title={
            <>
              <LessonTitleHeading lessonId={lessonId} title={lesson.title} />
              {lesson.contributors.length > 0 && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Envolvidos nesta aula: {lesson.contributors.map((c) => c.name).join(", ")}
                </p>
              )}
            </>
          }
          lessonId={lesson.id}
          type={lesson.type}
          contentUrl={lesson.contentUrl}
          hlsMasterUrl={lesson.hlsMasterUrl}
          videoRenditions={videoRenditions}
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
              createdAt={lessonCreatedAt}
              initialLikeCount={likeReactions}
              initialReaction={myReaction?.type ?? null}
              isAuthenticated={Boolean(session)}
            />
          }
          comments={
            <LessonComments
              lessonId={lesson.id}
              comments={commentTree}
              initialTopComments={topCommentTree}
              initialTotal={commentCounts.all}
              initialHasMore={topLevelComments.length < commentCounts.topLevel}
              currentUserId={session.user.id}
              currentUserName={session.user.name ?? null}
              canModerate={isOwner}
              isAuthenticated={Boolean(session)}
            />
          }
          videoMeta={{
            authors,
            viewCount: updatedLesson.viewCount,
            likeCount: likeReactions,
            createdAt: lessonCreatedAt,
          }}
          previousHref={previousHref}
          nextHref={nextHref}
        />
      </LessonLayoutShell>
    </>
  );
}
