import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CourseRow } from "@/components/course/CourseRow";
import { SearchBar } from "@/components/course/SearchBar";
import type { CourseCardData } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

interface EngagementRow {
  courseId: string;
  commentCount: bigint;
  likeCount: bigint;
}

type CoursesSearchParams = Promise<{
  q?: string;
  category?: string;
  level?: string;
  sort?: string;
  maxPrice?: string;
  minDuration?: string;
  minEnrollments?: string;
}>;

// Título/header nunca ficam à espera da BD — só o resto (que depende de
// searchParams + queries) fica atrás do Suspense. Sem isto, a página inteira
// (Navbar incluído, que vem do layout) bloqueava até as queries todas
// resolverem, porque não havia nenhuma fronteira de streaming na rota.
export default function CoursesPage({ searchParams }: { searchParams: CoursesSearchParams }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-100 to-white px-4 py-5 dark:border-white/10 dark:from-slate-900 dark:to-black sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">Catálogo de Cursos</h1>
          <p className="mt-2 hidden max-w-xl text-slate-600 dark:text-slate-400 sm:block">
            Explora os cursos disponíveis e começa a aprender hoje.
          </p>
        </div>
      </div>

      <Suspense fallback={<CoursesSkeleton />}>
        <CoursesResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function CoursesSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/60 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="h-9 w-full max-w-md rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-video rounded-lg bg-slate-200 dark:bg-white/10" />
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function CoursesResults({ searchParams }: { searchParams: CoursesSearchParams }) {
  const { q, category, level, sort, maxPrice, minDuration, minEnrollments } = await searchParams;
  const selectedCategories = (category ?? "").split(",").filter(Boolean);
  const session = await getServerSession(authOptions);

  const [courses, categories, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: {
        published: true,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(selectedCategories.length > 0 ? { category: { in: selectedCategories } } : {}),
        ...(level ? { level } : {}),
        ...(maxPrice ? { price: { lte: Number(maxPrice) } } : {}),
      },
      include: {
        instructor: { select: { name: true } },
        _count: { select: { enrollments: true } },
        modules: {
          include: {
            _count: { select: { lessons: true } },
            lessons: {
              orderBy: { order: "asc" },
              select: { contentUrl: true, isFreePreview: true, durationSeconds: true },
            },
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

  // Comentários e likes ficam a Course->Module->Lesson->LessonComment->CommentLike
  // — Prisma não agrega através de tantos saltos num orderBy/_count só, por
  // isso uma query SQL própria. Só corre quando a ordenação realmente precisa
  // disto ("favoritos"/"comentados") — sem isto, corria SEMPRE, mesmo com
  // ordenação por defeito, deixando a página inteira mais lenta à toa.
  const needsEngagement = sort === "favorites" || sort === "comments";
  const courseIds = courses.map((c) => c.id);
  const engagementRows =
    needsEngagement && courseIds.length > 0
      ? await prisma.$queryRaw<EngagementRow[]>`
          SELECT m."courseId" as "courseId",
                 COUNT(DISTINCT lc.id) as "commentCount",
                 COUNT(cl.id) as "likeCount"
          FROM "Module" m
          JOIN "Lesson" l ON l."moduleId" = m.id
          LEFT JOIN "LessonComment" lc ON lc."lessonId" = l.id
          LEFT JOIN "CommentLike" cl ON cl."commentId" = lc.id
          WHERE m."courseId" IN (${Prisma.join(courseIds)})
          GROUP BY m."courseId"
        `
      : [];
  const engagementByCourseId = new Map(
    engagementRows.map((r) => [r.courseId, { commentCount: Number(r.commentCount), likeCount: Number(r.likeCount) }])
  );

  const enriched = courses.map((course) => {
    const allLessons = course.modules.flatMap((m) => m.lessons);
    const trailerLesson = allLessons.find((l) => l.isFreePreview) ?? allLessons[0];
    const totalDurationSeconds = allLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
    const engagement = engagementByCourseId.get(course.id) ?? { commentCount: 0, likeCount: 0 };

    // "Mais favoritos": não existe um like/favorito a nível de curso — é uma
    // combinação de avaliação, nº de avaliações, comentários e likes nas
    // aulas. Pesos arbitrários (rating pesa mais, é o sinal de qualidade;
    // comentários/likes são só engagement) — não há "fórmula certa", serve
    // para dar uma ordenação razoável.
    const favoriteScore =
      course.rating * 20 + course.ratingCount * 2 + engagement.commentCount * 3 + engagement.likeCount;

    const card: CourseCardData = {
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
    };

    return {
      card,
      courseId: course.id,
      enrollmentCount: course._count.enrollments,
      totalDurationSeconds,
      commentCount: engagement.commentCount,
      likeCount: engagement.likeCount,
      favoriteScore,
      createdAt: course.createdAt,
    };
  });

  const minDurationSeconds = minDuration ? Number(minDuration) * 3600 : 0;
  const minEnrollmentsCount = minEnrollments ? Number(minEnrollments) : 0;
  const filtered = enriched.filter(
    (c) => c.totalDurationSeconds >= minDurationSeconds && c.enrollmentCount >= minEnrollmentsCount
  );

  const sorted = [...filtered];
  switch (sort) {
    case "recent":
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case "rating":
      sorted.sort((a, b) => b.card.rating - a.card.rating);
      break;
    case "reviews":
      sorted.sort((a, b) => b.card.ratingCount - a.card.ratingCount);
      break;
    case "popular":
      sorted.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
      break;
    case "favorites":
      sorted.sort((a, b) => b.favoriteScore - a.favoriteScore);
      break;
    case "comments":
      sorted.sort((a, b) => b.commentCount - a.commentCount);
      break;
    case "price_asc":
      sorted.sort((a, b) => a.card.price - b.card.price);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.card.price - a.card.price);
      break;
    default:
      break;
  }

  const cards = sorted.map((s) => s.card);
  const hidePriceBySlug = Object.fromEntries(
    courses.filter((c) => enrolledCourseIds.has(c.id)).map((c) => [c.slug, true])
  );
  const rankBySlug: Record<string, number> =
    sort === "favorites" ? Object.fromEntries(sorted.map((s, i) => [s.card.slug, i + 1])) : {};

  // Uma ordenação ativa mostra UMA lista só, #1 até ao último — separar por
  // categoria (como a página principal) só faz sentido sem ordenação
  // explícita, senão a progressão #1→último fica partida por várias rows.
  const byCategory = new Map<string, CourseCardData[]>();
  for (const c of cards) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-900/60 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <SearchBar categories={categories.map((c) => c.category)} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl py-3">
        <p className="mb-1 px-4 text-sm text-slate-500 dark:text-slate-400 sm:px-8">
          {cards.length} curso{cards.length !== 1 ? "s" : ""} encontrado{cards.length !== 1 ? "s" : ""}
        </p>
        {cards.length === 0 ? (
          <p className="px-4 text-slate-500 dark:text-slate-400 sm:px-8">Nenhum curso encontrado.</p>
        ) : sort ? (
          <CourseRow title="Resultados" courses={cards} hidePriceBySlug={hidePriceBySlug} rankBySlug={rankBySlug} />
        ) : (
          <div className="space-y-1">
            {Array.from(byCategory.entries()).map(([cat, list]) => (
              <CourseRow key={cat} title={cat} courses={list} hidePriceBySlug={hidePriceBySlug} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
