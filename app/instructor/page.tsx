import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function InstructorHomePage() {
  const session = await getServerSession(authOptions);
  const courses = await prisma.course.findMany({
    where: { instructorId: session!.user.id },
    include: { modules: { include: { _count: { select: { lessons: true } } } }, enrollments: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Os meus cursos</h1>
        <Link href="/instructor/courses/new">
          <Button>+ Novo curso</Button>
        </Link>
      </div>

      {courses.length === 0 ? (
        <p className="text-slate-500">Ainda não criaste nenhum curso.</p>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/instructor/courses/${course.id}`}>
              <Card className="flex items-center justify-between p-4 hover:shadow-md">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{course.title}</h3>
                    <Badge tone={course.published ? "success" : "warning"}>
                      {course.published ? "Publicado" : "Rascunho"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {course.modules.reduce((sum, m) => sum + m._count.lessons, 0)} aulas ·{" "}
                    {course.enrollments.length} alunos matriculados
                  </p>
                </div>
                <span className="text-sm text-slate-500">Editar →</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
