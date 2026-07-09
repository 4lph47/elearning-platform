import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, Badge } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (session!.user.role !== "STUDENT") {
    redirect("/instructor");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session!.user.id },
    include: {
      course: {
        include: {
          modules: { include: { lessons: true }, orderBy: { order: "asc" } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const allProgress = await prisma.lessonProgress.findMany({
    where: { userId: session!.user.id },
  });
  const progressByLesson = new Map(allProgress.map((p) => [p.lessonId, p]));

  const courseSummaries = enrollments.map(({ course }) => {
    const lessons = course.modules.flatMap((m) => m.lessons);
    const completedCount = lessons.filter((l) => progressByLesson.get(l.id)?.completed).length;
    const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    const nextLesson =
      lessons.find((l) => !progressByLesson.get(l.id)?.completed) ?? lessons[0];

    return { course, lessons, completedCount, percent, nextLesson };
  });

  const inProgress = courseSummaries.filter((c) => c.percent > 0 && c.percent < 100).length;
  const completed = courseSummaries.filter((c) => c.percent === 100).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Os meus cursos</h1>
      <p className="mt-1 text-sm text-slate-500">Acompanha o teu progresso e continua a aprender.</p>

      {courseSummaries.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{courseSummaries.length}</div>
            <div className="text-xs text-slate-500">Cursos matriculados</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-700">{inProgress}</div>
            <div className="text-xs text-slate-500">Em progresso</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{completed}</div>
            <div className="text-xs text-slate-500">Concluídos</div>
          </Card>
        </div>
      )}

      {courseSummaries.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-slate-500">
            Ainda não estás matriculado em nenhum curso.{" "}
            <Link href="/courses" className="font-medium text-slate-900 hover:underline">
              Explorar catálogo
            </Link>
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {courseSummaries.map(({ course, lessons, completedCount, percent, nextLesson }) => (
            <Card key={course.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Link href={`/courses/${course.slug}`} className="font-medium text-slate-900 hover:underline">
                    {course.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge>{course.category}</Badge>
                    {percent === 100 && <Badge tone="success">Concluído</Badge>}
                  </div>
                </div>
                {nextLesson && (
                  <Link
                    href={`/courses/${course.slug}/lessons/${nextLesson.id}`}
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    {percent === 0 ? "Começar" : percent === 100 ? "Rever" : "Continuar"}
                  </Link>
                )}
              </div>

              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-slate-800 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {completedCount} de {lessons.length} aulas concluídas ({percent}%)
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
