import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnedModule } from "@/lib/instructor-guard";
import { LessonEditScreen } from "@/components/instructor/LessonEditScreen";

export const dynamic = "force-dynamic";

export default async function NewLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { courseId, moduleId } = await params;
  const { type } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule || courseModule.courseId !== courseId) notFound();

  const [lessonCount, quizCount, course] = await Promise.all([
    prisma.lesson.count({ where: { moduleId } }),
    prisma.quiz.count({ where: { moduleId } }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        instructor: { select: { id: true, name: true } },
        collaborators: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!course) notFound();

  return (
    <LessonEditScreen
      courseId={courseId}
      moduleId={moduleId}
      initialType={type === "TEXT" ? "TEXT" : "VIDEO"}
      nextOrder={lessonCount + quizCount}
      courseAuthors={[course.instructor, ...course.collaborators]}
    />
  );
}
