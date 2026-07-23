import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnedLesson } from "@/lib/instructor-guard";
import { LessonEditScreen } from "@/components/instructor/LessonEditScreen";

export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; lessonId: string }>;
}) {
  const { courseId, moduleId, lessonId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const lesson = await getOwnedLesson(lessonId, session);
  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) notFound();

  const [resources, quiz, contributors, course] = await Promise.all([
    prisma.lessonResource.findMany({ where: { lessonId }, orderBy: { createdAt: "asc" } }),
    prisma.quiz.findUnique({
      where: { lessonId },
      include: { questions: { include: { options: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
    }),
    prisma.lesson.findUnique({ where: { id: lessonId } }).contributors({ select: { id: true } }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        instructor: { select: { id: true, name: true } },
        collaborators: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!course) notFound();
  const courseAuthors = [course.instructor, ...course.collaborators];

  return (
    <LessonEditScreen
      courseId={courseId}
      moduleId={moduleId}
      nextOrder={lesson.order}
      courseAuthors={courseAuthors}
      lesson={{
        id: lesson.id,
        title: lesson.title,
        order: lesson.order,
        isFreePreview: lesson.isFreePreview,
        type: lesson.type,
        contentUrl: lesson.contentUrl,
        hlsMasterUrl: lesson.hlsMasterUrl,
        thumbnailUrl: lesson.thumbnailUrl,
        textContent: lesson.textContent,
        durationSeconds: lesson.durationSeconds,
        description: lesson.description,
        contributors: contributors ?? [],
        resources,
        quiz: quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              maxAttempts: quiz.maxAttempts,
              timeLimitMinutes: quiz.timeLimitMinutes,
              questions: quiz.questions,
            }
          : null,
      }}
    />
  );
}
