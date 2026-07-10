import Link from "next/link";
import { prisma } from "@/lib/db";
import { CourseCard } from "@/components/course/CourseCard";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [courses, categories, courseCount, studentCount, instructorCount] = await Promise.all([
    prisma.course.findMany({
      where: { published: true },
      include: {
        instructor: { select: { name: true } },
        modules: { include: { _count: { select: { lessons: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.course.findMany({
      where: { published: true },
      distinct: ["category"],
      select: { category: true },
    }),
    prisma.course.count({ where: { published: true } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "INSTRUCTOR" } }),
  ]);

  const stats = [
    { label: "Cursos publicados", value: courseCount },
    { label: "Alunos inscritos", value: studentCount },
    { label: "Instrutores", value: instructorCount },
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-slate-900 py-24 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Aprende ao teu ritmo</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Cursos criados por instrutores reais — vídeo, documentos e materiais de apoio, tudo numa
            só plataforma.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/courses">
              <Button variant="light">
                Explorar cursos
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Começar a ensinar
              </Button>
            </Link>
          </div>

          <div className="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-4 border-t border-white/20 pt-8">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold sm:text-3xl">{s.value}+</div>
                <div className="mt-1 text-xs text-slate-400 sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map(({ category }) => (
              <Link
                key={category}
                href={`/courses?category=${encodeURIComponent(category)}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
              >
                {category}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Cursos em destaque</h2>
          <Link href="/courses" className="text-sm font-medium text-slate-900 hover:underline">
            Ver todos →
          </Link>
        </div>

        {courses.length === 0 ? (
          <p className="text-slate-500">Ainda não há cursos publicados.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={{
                  slug: course.slug,
                  title: course.title,
                  description: course.description,
                  category: course.category,
                  level: course.level,
                  thumbnailUrl: course.thumbnailUrl,
                  instructorName: course.instructor.name,
                  lessonCount: course.modules.reduce((sum, m) => sum + m._count.lessons, 0),
                  price: course.price,
                  rating: course.rating,
                  ratingCount: course.ratingCount,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
