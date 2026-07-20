import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CourseDetailsForm } from "@/components/instructor/CourseDetailsForm";
import { AddModuleForm } from "@/components/instructor/AddModuleForm";
import { ModuleSection } from "@/components/instructor/ModuleSection";

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
          quiz: { include: quizInclude },
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

  const courseAuthors = [course.instructor, ...course.collaborators];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <CourseDetailsForm course={course} otherCourses={otherCourses} />

      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Módulos e aulas</h2>
        <div className="space-y-4">
          {course.modules.map((module) => (
            <ModuleSection key={module.id} module={module} courseSlug={course.slug} courseAuthors={courseAuthors} />
          ))}
        </div>
        <div className="mt-4">
          <AddModuleForm courseId={course.id} nextOrder={course.modules.length} />
        </div>
      </div>
    </div>
  );
}
