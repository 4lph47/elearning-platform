import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users, Star, Wallet, BookOpen, Plus } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InstructorCourseList } from "@/components/instructor/InstructorCourseList";
import { FadeLink } from "@/components/course/FadeLink";

export const dynamic = "force-dynamic";

export default async function InstructorHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/instructor");
  const courses = await prisma.course.findMany({
    where: { OR: [{ instructorId: session.user.id }, { collaborators: { some: { id: session.user.id } } }] },
    include: { modules: { include: { _count: { select: { lessons: true } } } }, enrollments: true },
    orderBy: { createdAt: "desc" },
  });

  const publishedCount = courses.filter((c) => c.published).length;
  const totalStudents = courses.reduce((sum, c) => sum + c.enrollments.length, 0);
  const totalRevenue = courses.reduce((sum, c) => sum + c.price * c.enrollments.length, 0);
  const ratedCourses = courses.filter((c) => c.ratingCount > 0);
  const avgRating =
    ratedCourses.length > 0
      ? ratedCourses.reduce((sum, c) => sum + c.rating * c.ratingCount, 0) /
        ratedCourses.reduce((sum, c) => sum + c.ratingCount, 0)
      : null;

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Área de instrutor</h1>
            <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">Gere os teus cursos e acompanha o desempenho.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <FadeLink
                href="/instructor/analytics"
                className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Analytics
              </FadeLink>
              <FadeLink
                href="/instructor/profile"
                className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Perfil público
              </FadeLink>
            </div>
            <FadeLink
              href="/instructor/courses/new"
              className="flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={15} /> Novo curso
            </FadeLink>
          </div>
        </div>

        {courses.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FadeLink
              href="#cursos-list"
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-blue-500"
            >
              <div className="flex items-center gap-2 text-slate-500">
                <BookOpen size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Cursos</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{courses.length}</p>
              <p className="text-xs text-slate-500">{publishedCount} publicado{publishedCount !== 1 ? "s" : ""}</p>
            </FadeLink>
            <FadeLink
              href="/instructor/analytics?tile=enrollments"
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-blue-500"
            >
              <div className="flex items-center gap-2 text-slate-500">
                <Users size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Alunos</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalStudents}</p>
              <p className="text-xs text-slate-500">matrículas totais</p>
            </FadeLink>
            <FadeLink
              href="/instructor/analytics?tile=revenue"
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-blue-500"
            >
              <div className="flex items-center gap-2 text-slate-500">
                <Wallet size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Receita</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalRevenue.toFixed(2)}€</p>
              <p className="text-xs text-slate-500">estimativa total</p>
            </FadeLink>
            <FadeLink
              href="/instructor/analytics#rating"
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-blue-500"
            >
              <div className="flex items-center gap-2 text-slate-500">
                <Star size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Avaliação</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{avgRating !== null ? avgRating.toFixed(1) : "—"}</p>
              <p className="text-xs text-slate-500">
                {ratedCourses.reduce((sum, c) => sum + c.ratingCount, 0)} avaliações
              </p>
            </FadeLink>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-neutral-900">
            <p className="text-slate-500 dark:text-slate-400">Ainda não criaste nenhum curso.</p>
            <FadeLink
              href="/instructor/courses/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={15} /> Criar o primeiro curso
            </FadeLink>
          </div>
        ) : (
          <div id="cursos-list" className="scroll-mt-20">
          <InstructorCourseList
            courses={courses.map((course) => ({
              id: course.id,
              title: course.title,
              category: course.category,
              published: course.published,
              thumbnailUrl: course.thumbnailUrl,
              lessonCount: course.modules.reduce((sum, m) => sum + m._count.lessons, 0),
              studentCount: course.enrollments.length,
              rating: course.rating,
              ratingCount: course.ratingCount,
              revenue: course.price * course.enrollments.length,
            }))}
          />
          </div>
        )}
      </div>
    </div>
  );
}
