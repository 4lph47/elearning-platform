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

  const [maxLessonOrder, maxQuizOrder, course] = await Promise.all([
    prisma.lesson.aggregate({ where: { moduleId }, _max: { order: true } }),
    prisma.quiz.aggregate({ where: { moduleId }, _max: { order: true } }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        instructor: { select: { id: true, name: true } },
        collaborators: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!course) notFound();

  // Próxima posição livre no espaço partilhado (aulas + quizzes) — usar o
  // maior `order` existente + 1, não a contagem, porque aulas/quizzes
  // apagados deixam buracos e a contagem colidiria com um order já em uso.
  const nextOrder = Math.max(maxLessonOrder._max.order ?? -1, maxQuizOrder._max.order ?? -1) + 1;

  return (
    <LessonEditScreen
      courseId={courseId}
      moduleId={moduleId}
      initialType={type === "TEXT" ? "TEXT" : "VIDEO"}
      nextOrder={nextOrder}
      courseAuthors={[course.instructor, ...course.collaborators]}
    />
  );
}
