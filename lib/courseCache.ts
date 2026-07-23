import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

// Estrutura do curso (módulos, aulas, quizzes, reviews) não depende da sessão —
// partilhada entre visitantes, cache invalidado via revalidateTag("courses")
// sempre que o instrutor edita curso/módulo/aula/quiz.
export const getCachedCourseBySlug = unstable_cache(
  async (slug: string) =>
    prisma.course.findUnique({
      where: { slug },
      include: {
        instructor: { select: { id: true, name: true, bio: true } },
        collaborators: { select: { id: true, name: true, bio: true } },
        quiz: { select: { id: true } },
        bundle: {
          include: {
            courses: {
              where: { published: true },
              include: { instructor: { select: { name: true } } },
            },
          },
        },
        modules: {
          orderBy: { order: "asc" },
          include: {
            quizzes: { select: { id: true, title: true, order: true }, orderBy: { order: "asc" } },
            lessons: {
              orderBy: { order: "asc" },
              include: {
                _count: { select: { resources: true } },
                quiz: { select: { id: true } },
                contributors: { select: { id: true, name: true } },
              },
            },
          },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        },
        _count: { select: { enrollments: true } },
      },
    }),
  ["course-by-slug"],
  { revalidate: 60, tags: ["courses"] }
);

export type CachedCourse = NonNullable<Awaited<ReturnType<typeof getCachedCourseBySlug>>>;

const relatedCourseInclude = {
  instructor: { select: { name: true } },
  modules: {
    include: {
      _count: { select: { lessons: true } },
      lessons: { orderBy: { order: "asc" as const }, select: { contentUrl: true, isFreePreview: true } },
    },
  },
};

// Cursos relacionados/recomendados/do mesmo instrutor: não dependem da sessão
// de quem vê a página, só do próprio curso — mesma tag/invalidação do curso.
export const getCachedRelatedCourses = unstable_cache(
  async (courseId: string, category: string, instructorId: string) => {
    const [relatedCourses, instructorCourses, instructorOtherCourses, recommendedCourses] = await Promise.all([
      prisma.course.findMany({
        where: { published: true, category, id: { not: courseId } },
        include: relatedCourseInclude,
        orderBy: { ratingCount: "desc" },
        take: 12,
      }),
      prisma.course.findMany({
        where: { instructorId, published: true },
        select: { rating: true, ratingCount: true, _count: { select: { enrollments: true } } },
      }),
      prisma.course.findMany({
        where: { instructorId, published: true, id: { not: courseId } },
        include: relatedCourseInclude,
        orderBy: { ratingCount: "desc" },
        take: 8,
      }),
      prisma.course.findMany({
        where: { published: true, category: { not: category }, instructorId: { not: instructorId } },
        include: relatedCourseInclude,
        orderBy: { ratingCount: "desc" },
        take: 12,
      }),
    ]);
    return { relatedCourses, instructorCourses, instructorOtherCourses, recommendedCourses };
  },
  ["related-courses"],
  { revalidate: 60, tags: ["courses"] }
);
