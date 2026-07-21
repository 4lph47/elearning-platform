import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users, Star, Wallet, BookOpen, Plus, ArrowRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Área de instrutor</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gere os teus cursos e acompanha o desempenho.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/instructor/profile"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Perfil público
            </Link>
            <Link
              href="/instructor/courses/new"
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={15} /> Novo curso
            </Link>
          </div>
        </div>

        {courses.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-slate-500">
                <BookOpen size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Cursos</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{courses.length}</p>
              <p className="text-xs text-slate-500">{publishedCount} publicado{publishedCount !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-slate-500">
                <Users size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Alunos</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalStudents}</p>
              <p className="text-xs text-slate-500">matrículas totais</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-slate-500">
                <Wallet size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Receita</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalRevenue.toFixed(2)}€</p>
              <p className="text-xs text-slate-500">estimativa total</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-slate-500">
                <Star size={15} />
                <span className="text-xs font-medium uppercase tracking-wide">Avaliação</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{avgRating !== null ? avgRating.toFixed(1) : "—"}</p>
              <p className="text-xs text-slate-500">
                {ratedCourses.reduce((sum, c) => sum + c.ratingCount, 0)} avaliações
              </p>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-neutral-900">
            <p className="text-slate-500 dark:text-slate-400">Ainda não criaste nenhum curso.</p>
            <Link
              href="/instructor/courses/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus size={15} /> Criar o primeiro curso
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const lessonCount = course.modules.reduce((sum, m) => sum + m._count.lessons, 0);
              const revenue = course.price * course.enrollments.length;
              return (
                <Link key={course.id} href={`/instructor/courses/${course.id}`}>
                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/20">
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-16 w-24 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-400 dark:bg-slate-900 dark:text-slate-600">
                        {course.title.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-slate-900 dark:text-white">{course.title}</h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            course.published
                              ? "bg-green-600/15 text-green-700 dark:text-green-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {course.published ? "Publicado" : "Rascunho"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <BookOpen size={12} /> {lessonCount} aula{lessonCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {course.enrollments.length} aluno{course.enrollments.length !== 1 ? "s" : ""}
                        </span>
                        {course.ratingCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Star size={12} className="fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400" /> {course.rating.toFixed(1)} (
                            {course.ratingCount})
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Wallet size={12} /> {revenue.toFixed(2)}€
                        </span>
                      </div>
                    </div>

                    <ArrowRight size={16} className="shrink-0 text-slate-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
