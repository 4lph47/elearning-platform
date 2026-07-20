import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { CourseRow } from "@/components/course/CourseRow";
import { HeroCarousel } from "@/components/course/HeroCarousel";
import type { CourseCardData } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

type CourseWithRelations = Awaited<ReturnType<typeof fetchCourses>>[number];

function fetchCourses() {
  return prisma.course.findMany({
    where: { published: true },
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
    take: 60,
  });
}

function getTrailerUrl(course: CourseWithRelations): string | null {
  if (course.trailerUrl) return course.trailerUrl;
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const trailerLesson = allLessons.find((l) => l.isFreePreview) ?? allLessons[0];
  return trailerLesson?.contentUrl ?? null;
}

function toCardData(course: CourseWithRelations): CourseCardData {
  return {
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
    trailerUrl: getTrailerUrl(course),
  };
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  const [courses, courseCount, studentCount, instructorCount, enrollments] = await Promise.all([
    fetchCourses(),
    prisma.course.count({ where: { published: true } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "INSTRUCTOR" } }),
    session
      ? prisma.enrollment.findMany({
          where: { userId: session.user.id, course: { published: true } },
          include: {
            course: {
              include: {
                instructor: { select: { name: true } },
                modules: {
                  orderBy: { order: "asc" },
                  include: {
                    lessons: {
                      orderBy: { order: "asc" },
                      include: {
                        _count: { select: { resources: true } },
                        progress: { where: { userId: session.user.id } },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Aprende ao teu ritmo</h1>
        <p className="mt-4 text-slate-500">Ainda não há cursos publicados. Volta em breve.</p>
        <Link href="/register" className="mt-6 inline-block">
          <Button variant="primary">Começar a ensinar</Button>
        </Link>
      </div>
    );
  }

  const cards = courses.map(toCardData);

  const topRated = [...courses].filter((c) => c.ratingCount > 0).sort((a, b) => b.rating - a.rating).slice(0, 5);
  const featuredCourses = topRated.length > 0 ? topRated : courses.slice(0, 5);
  const featuredCandidates = featuredCourses.map((c) => ({ card: toCardData(c), videoUrl: getTrailerUrl(c) }));
  const popular = [...cards].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 20);
  const recent = cards.slice(0, 20);

  const categories = Array.from(new Set(cards.map((c) => c.category)));

  const byCategory = new Map<string, CourseCardData[]>();
  for (const c of cards) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  // Continue onde parou: matrículas com progresso incompleto, ordenadas por atividade recente.
  const continueItems: { card: CourseCardData; href: string; percent: number; lastActivity: number }[] = [];
  for (const enrollment of enrollments) {
    const course = enrollment.course;
    const allLessons = course.modules.flatMap((m) => m.lessons);
    if (allLessons.length === 0) continue;
    const completedLessons = allLessons.filter((l) => l.progress[0]?.completed);
    const percent = Math.round((completedLessons.length / allLessons.length) * 100);
    if (percent >= 100) continue;

    const nextLesson = allLessons.find((l) => !l.progress[0]?.completed) ?? allLessons[0];
    const lastActivity = Math.max(
      enrollment.enrolledAt.getTime(),
      ...allLessons.map((l) => l.progress[0]?.updatedAt.getTime() ?? 0)
    );

    continueItems.push({
      card: {
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
        trailerUrl: course.trailerUrl ?? (allLessons.find((l) => l.isFreePreview) ?? allLessons[0])?.contentUrl ?? null,
      },
      href: `/courses/${course.slug}/lessons/${nextLesson.id}`,
      percent,
      lastActivity,
    });
  }
  continueItems.sort((a, b) => b.lastActivity - a.lastActivity);
  const continueWatching = continueItems.slice(0, 15);
  const continueHrefBySlug = Object.fromEntries(continueWatching.map((i) => [i.card.slug, i.href]));
  const continueProgressBySlug = Object.fromEntries(continueWatching.map((i) => [i.card.slug, i.percent]));

  // Recomendado para ti: cursos ainda não matriculados, priorizando categorias já exploradas.
  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const enrolledCategories = new Set(enrollments.map((e) => e.course.category));
  const hidePriceBySlug = Object.fromEntries(enrollments.map((e) => [e.course.slug, true]));
  const recommended = courses
    .filter((c) => !enrolledCourseIds.has(c.id))
    .map(toCardData)
    .sort((a, b) => {
      const aMatch = enrolledCategories.has(a.category) ? 1 : 0;
      const bMatch = enrolledCategories.has(b.category) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.rating - a.rating;
    })
    .slice(0, 20);

  const firstName = session?.user.name?.split(" ")[0];

  return (
    <div className="-mt-16 bg-black pb-16">
      <HeroCarousel items={featuredCandidates} />

      <div className="relative z-10 -mt-10 sm:-mt-20">
        {firstName && (
          <p className="px-4 pt-4 text-sm text-slate-400 sm:px-8">Bem-vindo de volta, {firstName}.</p>
        )}
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-4 pt-4 sm:px-8">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/courses?category=${encodeURIComponent(category)}`}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-blue-600/10 hover:text-white"
            >
              {category}
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          {continueWatching.length > 0 && (
            <CourseRow
              title="Continuar onde paraste"
              courses={continueWatching.map((i) => i.card)}
              hrefBySlug={continueHrefBySlug}
              progressBySlug={continueProgressBySlug}
              hidePriceBySlug={hidePriceBySlug}
            />
          )}
          {recommended.length > 0 && <CourseRow title="Recomendado para ti" courses={recommended} />}
          <CourseRow title="Populares na plataforma" courses={popular} hidePriceBySlug={hidePriceBySlug} />
          <CourseRow title="Adicionados recentemente" courses={recent} hidePriceBySlug={hidePriceBySlug} />
          {Array.from(byCategory.entries()).map(([category, list]) => (
            <CourseRow key={category} title={category} courses={list} hidePriceBySlug={hidePriceBySlug} />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-6xl border-t border-white/10 px-4 pt-10 text-center sm:px-8">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-4">
          {[
            { label: "Cursos publicados", value: courseCount },
            { label: "Alunos inscritos", value: studentCount },
            { label: "Instrutores", value: instructorCount },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-white sm:text-3xl">{s.value}+</div>
              <div className="mt-1 text-xs text-slate-400 sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        <Link
          href="/courses"
          className="mt-8 inline-block text-sm font-medium text-blue-400 hover:underline"
        >
          Ver catálogo completo →
        </Link>
      </div>
    </div>
  );
}
