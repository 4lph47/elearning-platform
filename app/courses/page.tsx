import { prisma } from "@/lib/db";
import { CourseCard } from "@/components/course/CourseCard";
import { SearchBar } from "@/components/course/SearchBar";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;

  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      where: {
        published: true,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(category ? { category } : {}),
      },
      include: {
        instructor: { select: { name: true } },
        modules: { include: { _count: { select: { lessons: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { published: true },
      distinct: ["category"],
      select: { category: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Catálogo de Cursos</h1>
      <p className="mb-6 text-slate-500">Explora os cursos disponíveis e começa a aprender hoje.</p>

      <div className="mb-8">
        <SearchBar categories={categories.map((c) => c.category)} />
      </div>

      {courses.length === 0 ? (
        <p className="text-slate-500">Nenhum curso encontrado.</p>
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
    </div>
  );
}
