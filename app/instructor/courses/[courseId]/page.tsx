import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CourseDetailsForm } from "@/components/instructor/CourseDetailsForm";
import { AddModuleForm } from "@/components/instructor/AddModuleForm";
import { ModuleList } from "@/components/instructor/ModuleList";
import { QuizEditor } from "@/components/instructor/QuizEditor";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const quizInclude = { questions: { include: { options: { orderBy: { order: "asc" as const } } }, orderBy: { order: "asc" as const } } };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      collaborators: { select: { id: true, name: true, email: true } },
      quiz: { include: quizInclude },
      bundle: { include: { courses: { select: { id: true } } } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          quizzes: { include: quizInclude, orderBy: { order: "asc" } },
          lessons: {
            orderBy: { order: "asc" },
            include: {
              resources: true,
              quiz: { include: quizInclude },
              contributors: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!course) notFound();
  const isAuthor =
    course.instructorId === session.user.id || course.collaborators.some((c) => c.id === session.user.id);
  if (!isAuthor && session.user.role !== "ADMIN") {
    redirect("/instructor");
  }

  const otherCourses = await prisma.course.findMany({
    where: { instructorId: course.instructorId, published: true, id: { not: course.id } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="mx-auto max-w-[90rem] px-1 py-10 sm:px-2">
      {/* Lado-a-lado no desktop (como os cards da própria página da aula),
          uma coluna só no mobile. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <CourseDetailsForm course={course} otherCourses={otherCourses} />

        <div>
          <h2 className="mb-4 text-lg font-semibold">Módulos e aulas</h2>
          <ModuleList courseId={course.id} courseSlug={course.slug} modules={course.modules} />
          <div className="mt-4">
            <AddModuleForm courseId={course.id} nextOrder={course.modules.length} />
          </div>

          <Card className="mt-4 p-6">
            <h2 className="mb-3 font-medium">Quiz final do curso</h2>
            <QuizEditor scope="COURSE" parentId={course.id} label="Quiz final do curso" existingQuiz={course.quiz} />
          </Card>
        </div>
      </div>
    </div>
  );
}
