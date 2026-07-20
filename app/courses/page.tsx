import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CourseTile } from "@/components/course/CourseTile";
import { SearchBar } from "@/components/course/SearchBar";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string; price?: string }>;
}) {
  const { q, category, level, price } = await searchParams;
  const session = await getServerSession(authOptions);

  const [courses, categories, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: {
        published: true,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(category ? { category } : {}),
        ...(level ? { level } : {}),
        ...(price === "free" ? { price: 0 } : price === "paid" ? { price: { gt: 0 } } : {}),
      },
      include: {
        instructor: { select: { name: true } },
        modules: {
          include: {
            _count: { select: { lessons: true } },
            lessons: { orderBy: { order: "asc" }, select: { contentUrl: true, isFreePreview: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { published: true },
      distinct: ["category"],
      select: { category: true },
    }),
    session
      ? prisma.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } })
      : Promise.resolve([]),
  ]);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b border-white/10 bg-gradient-to-b from-slate-900 to-black px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Catálogo de Cursos</h1>
          <p className="mt-2 max-w-xl text-slate-400">
            Explora os cursos disponíveis e começa a aprender hoje.
          </p>
        </div>
      </div>

      <div className="border-b border-white/10 bg-slate-950/60 px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <SearchBar categories={categories.map((c) => c.category)} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="mb-6 text-sm text-slate-400">
          {courses.length} curso{courses.length !== 1 ? "s" : ""} encontrado{courses.length !== 1 ? "s" : ""}
        </p>
        {courses.length === 0 ? (
          <p className="text-slate-400">Nenhum curso encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course) => {
              const allLessons = course.modules.flatMap((m) => m.lessons);
              const trailerLesson = allLessons.find((l) => l.isFreePreview) ?? allLessons[0];
              return (
                <CourseTile
                  key={course.id}
                  course={{
                    slug: course.slug,
                    title: course.title,
                    description: course.description,
                    category: course.category,
                    level: course.level,
                    thumbnailUrl: course.thumbnailUrl,
                    instructorName: course.instructor.name,
                    lessonCount: allLessons.length,
                    price: course.price,
                    rating: course.rating,
                    ratingCount: course.ratingCount,
                    trailerUrl: course.trailerUrl ?? trailerLesson?.contentUrl ?? null,
                  }}
                  hidePrice={enrolledCourseIds.has(course.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
